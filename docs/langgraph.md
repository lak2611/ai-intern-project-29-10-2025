## LangGraph Architecture

This document describes how the LangGraph-based agent is structured in this project, the roles of its components, and the execution flow from a user query to a streamed LLM response and message persistence.

### Overview

- **Goal**: Provide a streaming, tool-using agent that can analyze CSV files and optional images within a chat session.
- **Core pieces**:
  - Graph definition and state schema: `lib/langgraph/graph.ts`
  - Agent state types/guards: `lib/langgraph/agent-state.ts`
  - Execution nodes: `lib/langgraph/nodes/*`
  - System prompt and CSV metadata loader: `lib/langgraph/system-prompt.ts`
  - CSV tools exposed to the LLM: `lib/langgraph/tools/*`
  - Checkpointing for state persistence: `lib/langgraph/checkpointer.ts`
  - Service that runs and streams the graph: `lib/langgraph-agent-service.ts`

### High-level Data Flow

1. A user sends a message (optionally with images) in a session.
2. The `LangGraphAgentService` constructs the initial state and starts the graph with `streamEvents`.
3. The graph runs nodes in a loop:
   - `loadCsvMetadata` → enrich state with CSV metadata (runs once)
   - `model` → LLM reasoning with tools (may loop through tool calls)
   - `shouldContinue` → conditional routing based on tool calls
   - `tools` → automatic tool execution via ToolNode (if needed)
   - Loop back to `model` if tools were called, otherwise END
4. While the `model` node runs, token chunks are streamed back to the client.
5. State is automatically persisted after each node via the checkpointer.

### State Schema and Graph

The graph uses an annotated state to define the shared data passed between nodes. Messages use LangChain's `BaseMessage[]` with a reducer that appends new messages.

```15:39:lib/langgraph/graph.ts
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => {
      // MessagesAnnotation reducer: append new messages to existing ones
      return [...(x || []), ...(y || [])];
    },
    default: () => [],
  }),
  sessionId: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  csvResourcesMetadata: Annotation<CsvResourceMetadata[]>({
    reducer: (x: CsvResourceMetadata[], y: CsvResourceMetadata[]) => y ?? x,
    default: () => [],
  }),
  currentQuery: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  currentQueryImages: Annotation<Array<{ data: string; mimeType: string }>>({
    reducer: (x: Array<{ data: string; mimeType: string }>, y: Array<{ data: string; mimeType: string }> | undefined) => y ?? x,
    default: () => [],
  }),
});
```

```45:62:lib/langgraph/graph.ts
export function initializeGraph() {
  const toolNode = new ToolNode(csvTools, {
    handleToolErrors: true,
  });

  return new StateGraph(StateAnnotation)
    .addNode('loadCsvMetadata', loadCsvMetadataNode)
    .addNode('model', modelNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'loadCsvMetadata')
    .addEdge('loadCsvMetadata', 'model')
    .addConditionalEdges('model', shouldContinue, {
      tools: 'tools',
      [END as string]: END, // Directly end - checkpointing handles persistence
    })
    .addEdge('tools', 'model') // Loop back to model after tools
    .compile({ checkpointer });
}
```

Key differences from a simple linear flow:

- **Messages reducer**: Appends new messages (`[...x, ...y]`) instead of "last writer wins", allowing conversation history to accumulate.
- **Conditional routing**: After the `model` node, `shouldContinue` checks if tool calls were made and routes accordingly.
- **ToolNode**: Uses LangGraph's built-in `ToolNode` for automatic tool execution, eliminating manual tool call handling.
- **Checkpointing**: The graph is compiled with a checkpointer that automatically persists state after each node execution.

### Agent State Types

The strongly-typed state passed through the graph is defined in `agent-state.ts` with runtime guards for safety.

```14:32:lib/langgraph/agent-state.ts
export interface CsvResourceMetadata {
  /** Unique identifier for the resource */
  id: string;

  /** Original filename when uploaded */
  originalName: string;

  /** Path where the file is stored on disk */
  storedPath: string;

  /** File size in bytes */
  sizeBytes: number;

  /** Column names extracted from CSV header (optional, loaded on-demand) */
  columns?: string[];

  /** Total number of rows in the CSV (optional, loaded on-demand) */
  rowCount?: number;
}
```

```43:61:lib/langgraph/agent-state.ts
export interface AgentState {
  /** Session ID for this conversation */
  sessionId: string;

  /** Conversation history (all previous messages) - now uses LangChain BaseMessage[] */
  messages: BaseMessage[];

  /** Metadata for CSV resources available in this session */
  csvResourcesMetadata: CsvResourceMetadata[];

  /** Current user query being processed */
  currentQuery: string;

  /** Optional images for current query (multimodal input) */
  currentQueryImages?: Array<{
    data: string; // base64 string
    mimeType: string;
  }>;
}
```

**Important**: The `messages` field uses LangChain's `BaseMessage[]` instead of a custom `AgentMessage[]`. This enables:

- Automatic serialization/deserialization by the checkpointer
- Native tool call support
- Integration with LangChain's message handling

### Nodes

1. **Load CSV Metadata** (`loadCsvMetadataNode`)

```9:38:lib/langgraph/nodes/load-csv-metadata-node.ts
export async function loadCsvMetadataNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Fetch all CSV resources for the session
    const resources = await resourceService.listBySession(state.sessionId);

    // Filter to CSV files only
    const csvResources = resources.filter(
      (r: any) => r.mimeType === 'text/csv' || r.mimeType === 'application/csv' || r.originalName.toLowerCase().endsWith('.csv')
    );

    // Load CSV metadata (columns, row count)
    const csvMetadata = await loadCsvMetadata(
      csvResources.map((r: any) => ({
        id: r.id,
        storedPath: r.storedPath,
        originalName: r.originalName,
        sizeBytes: r.sizeBytes,
      }))
    );

    return {
      csvResourcesMetadata: csvMetadata,
    };
  } catch (error: any) {
    console.error('Error loading CSV metadata:', error);
    return {
      csvResourcesMetadata: [],
    };
  }
}
```

This node runs once at the start of each graph execution to populate CSV metadata.

2. **Model** (`modelNode`)

```12:114:lib/langgraph/nodes/model-node.ts
export async function modelNode(state: AgentState): Promise<Partial<AgentState>> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or LLM_API_KEY environment variable is required');
  }

  const llm = new ChatGoogleGenerativeAI({
    model: modelName,
    temperature: 0,
    apiKey: apiKey,
    streaming: true, // Enable streaming for token-by-token responses
  }).bindTools(csvTools);

  // Build system prompt with CSV resource information
  const systemPrompt = buildSystemPrompt(state.csvResourcesMetadata);

  // Build message array: system prompt + history + current query
  const langchainMessages = [
    new SystemMessage(systemPrompt),
    ...state.messages, // History already contains LangChain messages
  ];

  // Add current query to messages if present (only on first call, not when looping from tools)
  let currentQueryMessage: HumanMessage | null = null;
  if (state.currentQuery) {
    const timestamp = new Date().toISOString();
    currentQueryMessage =
      state.currentQueryImages && state.currentQueryImages.length > 0
        ? (() => {
            // ... handle images ...
            return new HumanMessage({
              content: [/* text + images */],
              additional_kwargs: { timestamp },
            });
          })()
        : new HumanMessage({
            content: state.currentQuery || '',
            additional_kwargs: { timestamp },
          });

    langchainMessages.push(currentQueryMessage);
  }

  // Invoke LLM - ToolNode will handle tool execution automatically
  const response = await llm.invoke(langchainMessages);

  // Add timestamp to AI response
  const aiMessageWithTimestamp = new AIMessage({
    content: response.content,
    tool_calls: response.tool_calls,
    additional_kwargs: {
      ...response.additional_kwargs,
      timestamp: new Date().toISOString(),
    },
  });

  // Return the HumanMessage (for current query) + AIMessage (response)
  // Clear currentQuery after processing
  const messagesToAdd = currentQueryMessage ? [currentQueryMessage, aiMessageWithTimestamp] : [aiMessageWithTimestamp];

  return {
    messages: messagesToAdd, // Append HumanMessage + AIMessage to state (MessagesAnnotation handles merging)
    currentQuery: '', // Clear current query after processing
    currentQueryImages: [], // Clear images after processing
  };
}
```

The `model` node:

- Builds a system prompt customized with available CSVs.
- Converts conversation history (from checkpoints) and the current query (including images) into LangChain messages.
- Invokes the LLM with bound CSV tools.
- Returns the user message (if first call) and AI response, clearing `currentQuery`.
- May include `tool_calls` in the AI response, which triggers routing to the `tools` node.

3. **Should Continue** (`shouldContinue`)

```8:22:lib/langgraph/nodes/should-continue.ts
export function shouldContinue(state: { messages: any[] }): 'tools' | typeof END {
  const { messages } = state;
  if (!messages || messages.length === 0) {
    return END;
  }

  const lastMessage = messages[messages.length - 1];

  // Check if last message is AIMessage with tool calls
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }

  return END;
}
```

This conditional routing function checks if the last AI message contains tool calls. If yes, routes to `tools`; otherwise, ends the graph.

4. **Tools** (`toolNode`)

The `tools` node is a prebuilt `ToolNode` from LangGraph that:

- Automatically executes tool calls from the last AI message
- Handles tool errors gracefully
- Returns tool results as `ToolMessage` instances
- Appends tool results to the state messages

After tools execute, the graph loops back to `model` so the LLM can process the tool results.

### Checkpointing

The graph uses `SqliteSaver` from `@langchain/langgraph-checkpoint-sqlite` for automatic state persistence:

```23:47:lib/langgraph/checkpointer.ts
function getCheckpointer(): SqliteSaver {
  if (!checkpointerInstance) {
    // Lazy import to avoid loading native module at module load time
    // Use dynamic require to delay loading until actually needed
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'checkpoints.sqlite');
    const db = new Database(dbPath);
    // SqliteSaver constructor takes a Database instance
    checkpointerInstance = new SqliteSaver(db);
  }
  return checkpointerInstance;
}

// Create a proxy that delegates all calls to the actual checkpointer instance
export const checkpointer = new Proxy({} as SqliteSaver, {
  get(_target, prop) {
    const instance = getCheckpointer();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
}) as SqliteSaver;
```

**Key features**:

- **Separate database**: Uses `checkpoints.sqlite` (separate from Prisma's database) to avoid conflicts
- **Lazy initialization**: Uses a proxy pattern to delay loading `better-sqlite3` until needed (important for Next.js)
- **Automatic persistence**: State is saved after each node execution
- **Thread-based**: Uses `sessionId` as `thread_id` to maintain separate conversation histories

**Message persistence**: Messages are automatically saved to checkpoints after each node. There is no separate `saveMessage` node—the checkpointer handles all persistence.

### System Prompt and Metadata Loading

`system-prompt.ts` builds the system prompt (listing available CSVs and tool usage guidance) and provides `loadCsvMetadata`, which enriches resource entries with columns and row counts via the CSV analysis service.

```8:76:lib/langgraph/system-prompt.ts
export function buildSystemPrompt(csvResourcesMetadata: CsvResourceMetadata[]): string {
  let prompt = 'You are a helpful AI assistant that can analyze CSV files and images. ';
  prompt += 'You have access to CSV analysis tools to help users understand their data. ';
  prompt += 'You can also analyze images that users upload with their messages using your vision capabilities.\n\n';

  if (csvResourcesMetadata.length === 0) {
    prompt += 'No CSV resources are currently available in this session.\n';
    prompt += 'If the user asks about CSV data, inform them that no CSV files have been uploaded yet.\n';
  } else {
    prompt += `The current session has ${csvResourcesMetadata.length} CSV resource(s) available:\n\n`;

    csvResourcesMetadata.forEach((resource, index) => {
      prompt += `[CSV Resource ${index + 1}]\n`;
      prompt += `- ID: ${resource.id}\n`;
      prompt += `- Filename: ${resource.originalName}\n`;
      prompt += `- Size: ${formatBytes(resource.sizeBytes)}\n`;
      if (resource.columns && resource.columns.length > 0) {
        prompt += `- Columns: ${resource.columns.join(', ')}\n`;
      }
      if (resource.rowCount !== undefined) {
        prompt += `- Row Count: ${resource.rowCount.toLocaleString()}\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += '\nYou have access to the following CSV analysis tools:\n';
  prompt += '- load_csv_data: Load and parse a CSV file (use this first to inspect schema)\n';
  prompt +=
    '- execute_sql_query: Execute SQL SELECT queries on CSV data - USE THIS for all filtering, aggregation, searching, and complex analysis\n';
  prompt += '  * Table name: "csv_data"\n';
  prompt += '  * Quote column names with spaces: SELECT "First Name", Age FROM csv_data\n';
  prompt += '  * Supports: WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, JOINs, subqueries, and all SQLite functions\n';
  prompt += '  * Examples:\n';
  prompt += '    - Filter: SELECT * FROM csv_data WHERE Age > 25 AND Department = "Sales"\n';
  prompt += '    - Aggregate: SELECT Department, AVG(CAST(Salary AS REAL)) as avg_salary FROM csv_data GROUP BY Department\n';
  prompt += '    - Search: SELECT * FROM csv_data WHERE "First Name" LIKE "%John%"\n';
  prompt +=
    '    - Statistics: SELECT COUNT(*) as count, AVG(CAST(Age AS REAL)) as avg_age, MIN(CAST(Age AS REAL)) as min_age, MAX(CAST(Age AS REAL)) as max_age FROM csv_data\n';

  prompt += 'When a user asks about CSV data:\n';
  prompt += '1. Use load_csv_data first to inspect the schema (columns and row count)\n';
  prompt += '2. Use execute_sql_query for all data analysis tasks (filtering, aggregation, searching, etc.)\n';
  prompt += "3. Write SQL queries that match the user's request - SQL is powerful and can handle complex queries\n";
  prompt += '4. Quote column names with spaces or special characters: "Column Name"\n';
  prompt += '5. Use CAST(column AS REAL) for numeric operations on text columns\n';
  prompt += '6. Provide clear, natural language explanations of your findings\n';
  prompt += "7. If multiple CSVs are available, clarify which one you're analyzing\n";
  prompt += '8. Use LIMIT to avoid returning too many rows\n\n';

  prompt += 'Image Analysis:\n';
  prompt += '- Users can upload images (JPEG, PNG, WebP, GIF) along with their messages\n';
  prompt += '- You can analyze images using your vision capabilities to understand their content\n';
  prompt += '- When images are provided, describe what you see and answer questions about the images\n';
  prompt += '- You can combine image analysis with CSV data analysis if both are relevant\n';
  prompt += '- If multiple images are provided, analyze each one and note relationships between them\n\n';

  prompt += 'Important guidelines:\n';
  prompt += '- If no CSV resources are available, inform the user and suggest uploading a CSV file\n';
  prompt += "- If the user's query is unclear, ask clarifying questions\n";
  prompt += "- Always provide context about which CSV file and columns you're analyzing\n";
  prompt += '- Prefer execute_sql_query over individual filter/aggregate tools - SQL is more flexible\n';
  prompt += '- Use quoted identifiers for column names with spaces: "First Name" not First Name\n';
  prompt += '- Be concise but thorough in your analysis\n';
  prompt += '- When analyzing images, provide detailed descriptions and insights\n';
  prompt += '- If users upload images without text, analyze the images and describe what you see\n';

  return prompt;
}
```

```81:107:lib/langgraph/system-prompt.ts
export async function loadCsvMetadata(
  resources: Array<{ id: string; storedPath: string; originalName: string; sizeBytes: number }>
): Promise<CsvResourceMetadata[]> {
  const metadataPromises = resources.map(async (resource) => {
    try {
      const schema = await csvAnalysisService.getCsvSchema(resource.id);
      return {
        id: resource.id,
        originalName: resource.originalName,
        storedPath: resource.storedPath,
        sizeBytes: resource.sizeBytes,
        columns: schema.columns,
        rowCount: schema.rowCount,
      };
    } catch (error) {
      // If schema loading fails, return basic metadata
      return {
        id: resource.id,
        originalName: resource.originalName,
        storedPath: resource.storedPath,
        sizeBytes: resource.sizeBytes,
      };
    }
  });

  return Promise.all(metadataPromises);
}
```

### Tooling Layer

The agent binds a suite of CSV tools implemented with `DynamicStructuredTool` and `zod` schemas. These are discoverable and callable by the LLM.

```251:260:lib/langgraph/tools/csv-tools.ts
export const csvTools = [
  loadCsvDataTool,
  executeSqlQueryTool,
  // Deprecated tools - replaced by execute_sql_query
  // filterCsvRowsTool,        // Use: SELECT * FROM csv_data WHERE ...
  // aggregateCsvDataTool,     // Use: SELECT SUM(column), AVG(column) FROM csv_data
  // filterAndAggregateCsvDataTool, // Use: SELECT ... WHERE ... GROUP BY ...
  // searchCsvTextTool,         // Use: SELECT * FROM csv_data WHERE column LIKE '%term%'
  // getCsvStatisticsTool,      // Use SQL with aggregate functions and subqueries
];
```

**Note**: The tool list has been simplified to focus on SQL-based analysis. The `execute_sql_query` tool replaces the individual filter, aggregate, search, and statistics tools, providing more flexibility and power through SQL queries. The `load_csv_data` tool is kept for convenience to inspect CSV schemas.

Each tool validates inputs, calls into `csvAnalysisService`, and returns JSON-encoded results tailored for agent reasoning (often with limited rows for efficiency).

### Service: Running and Streaming the Graph

`LangGraphAgentService` owns a compiled graph instance and provides `streamAgent(sessionId, userMessage, images?)` to:

- Validate the session
- Build initial `AgentState` (messages are loaded from checkpoint automatically)
- Start the graph with `streamEvents` and yield token chunks as they arrive

```23:88:lib/langgraph-agent-service.ts
async *streamAgent(
  sessionId: string,
  userMessage: string,
  images?: Array<{ data: string; mimeType: string; originalName: string }>
): AsyncGenerator<string> {
  // Validate session exists
  const session = await sessionService.getById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Initialize state - LangGraph will load messages from checkpoint if it exists
  // If no checkpoint exists, messages will be empty (new session)
  const initialState: AgentState = {
    sessionId,
    messages: [], // Messages are loaded from checkpoint automatically by LangGraph
    csvResourcesMetadata: [],
    currentQuery: userMessage,
    currentQueryImages: images?.map((img) => ({
      data: img.data,
      mimeType: img.mimeType,
    })),
  };

  // User message is now included in initial state and persisted automatically via checkpointer
  // No need to manually create it

  // Stream the graph execution with events to get token-level streaming
  const stream = this.graph.streamEvents(initialState, {
    version: 'v2',
    configurable: {
      thread_id: sessionId, // Use sessionId as thread_id for checkpointing
    },
  });

  let accumulatedContent = '';

  for await (const event of stream) {
    // Handle streaming events from LangGraph
    // Stream LLM token chunks
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk;
      if (chunk?.content) {
        const content = typeof chunk.content === 'string' ? chunk.content : '';
        if (content) {
          accumulatedContent += content;
          yield content;
        }
      }
    } else if (event.event === 'on_chat_model_end') {
      // Final message from LLM - check if there's any remaining content
      const message = event.data?.output;
      if (message?.content) {
        const content = typeof message.content === 'string' ? message.content : '';
        if (content && content !== accumulatedContent) {
          // Yield any remaining content that wasn't streamed
          const remaining = content.slice(accumulatedContent.length);
          if (remaining) {
            accumulatedContent = content;
            yield remaining;
          }
        }
      }
    }
  }
}
```

**Key points**:

- Messages are automatically loaded from checkpoints using `thread_id: sessionId`
- No manual message persistence needed—checkpointer handles it
- Streaming listens for `on_chat_model_stream` events and yields incremental content

### Message Service

The `messageService` loads messages from LangGraph checkpoints (not Prisma):

```136:177:lib/message-service.ts
listBySession = async (sessionId: string) => {
  try {
    const checkpoint = await checkpointer.get({
      configurable: { thread_id: sessionId },
    });

    if (checkpoint && checkpoint.channel_values.messages) {
      const messages = checkpoint.channel_values.messages as any[];

      // Filter and convert LangChain messages to API-compatible format
      // Filter out AI messages that only have tool calls but no text content
      return messages
        .filter(isMessageType)
        .filter((message) => !shouldFilterAIMessage(message))
        .map((message, index) => {
          const role = getMessageType(message);
          if (!role) {
            // This should never happen since we filtered with isMessageType, but handle it safely
            throw new Error(`Invalid message type at index ${index}`);
          }

          const content = extractContent(message);
          const images = role === 'user' ? extractImages(message) : undefined;
          const timestamp = extractTimestamp(message);

          return {
            id: `msg-${sessionId}-${index}`,
            sessionId,
            role,
            content,
            createdAt: timestamp,
            metadata: images ? { images } : null,
          };
        });
    }
  } catch (error) {
    console.error('Error loading from checkpoints:', error);
  }

  // Return empty array if no checkpoint or messages found
  return [];
};
```

The service:

- Reads from checkpoints using `thread_id` (sessionId)
- Converts LangChain `BaseMessage` objects to API-compatible format
- Filters out AI messages that only contain tool calls (no text content)
- Extracts images from `HumanMessage` content arrays
- Extracts timestamps from `additional_kwargs`

### Environment Variables

- `GOOGLE_API_KEY` or `LLM_API_KEY`: API key for Google Generative AI.
- `LLM_MODEL` (optional): model name (default: `gemini-2.5-flash`).

### Extensibility

- **Add a new tool**: implement a `DynamicStructuredTool` with a `zod` schema in `lib/langgraph/tools`, export it via `index.ts`, and add it to the `csvTools` array. It will be automatically bound in `modelNode`.
- **Add a new node**: create a function with signature `(state: AgentState) => Promise<Partial<AgentState>>` and wire it into `initializeGraph()` with appropriate edges.
- **Change state shape**: update `AgentState` and the `StateAnnotation` in `graph.ts` to include the new field.
- **Customize system prompt**: edit `buildSystemPrompt` to reflect new tools or behaviors.
- **Modify checkpointing**: adjust `checkpointer.ts` to use a different storage backend (e.g., Redis, Postgres).

### Related Docs

- Sessions: see `docs/session.md` for session lifecycle and APIs.
- CSV Resources: see `docs/csv-resources.md` for upload, storage, and schema extraction.
