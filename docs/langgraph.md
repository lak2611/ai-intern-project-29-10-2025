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
  - Service that runs and streams the graph: `lib/langgraph-agent-service.ts`

### High-level Data Flow

1. A user sends a message (optionally with images) in a session.
2. The `LangGraphAgentService` constructs the initial state and starts the graph with `streamEvents`.
3. The graph runs three nodes in order:
   - `loadCsvMetadata` → enrich state with CSV metadata
   - `agent` → LLM reasoning with tools (may loop through tool calls)
   - `saveMessage` → persist user and assistant messages
4. While the `agent` node runs, token chunks are streamed back to the client.

### State Schema and Graph

The graph uses an annotated state to define the shared data passed between nodes.

```1:12:lib/langgraph/graph.ts
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { loadCsvMetadataNode, agentNode, saveMessageNode } from './nodes';
import { CsvResourceMetadata } from './agent-state';
import { AgentMessage } from '@/lib/types/message';
```

```9:30:lib/langgraph/graph.ts
const StateAnnotation = Annotation.Root({
  sessionId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  messages: Annotation<AgentMessage[]>({ reducer: (x, y) => y ?? x, default: () => [] }),
  csvResourcesMetadata: Annotation<CsvResourceMetadata[]>({ reducer: (x, y) => y ?? x, default: () => [] }),
  currentQuery: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
  currentQueryImages: Annotation<Array<{ data: string; mimeType: string }>>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
});
```

```35:45:lib/langgraph/graph.ts
export function initializeGraph() {
  return new StateGraph(StateAnnotation)
    .addNode('loadCsvMetadata', loadCsvMetadataNode)
    .addNode('agent', agentNode)
    .addNode('saveMessage', saveMessageNode)
    .addEdge(START, 'loadCsvMetadata')
    .addEdge('loadCsvMetadata', 'agent')
    .addEdge('agent', 'saveMessage')
    .addEdge('saveMessage', END)
    .compile();
}
```

The reducer for each field is set to "last writer wins" (`y ?? x`) so nodes can update parts of the state without merging.

### Agent State Types and Guards

The strongly-typed state passed through the graph is defined in `agent-state.ts` with lightweight runtime guards for safety.

```13:31:lib/langgraph/agent-state.ts
export interface CsvResourceMetadata {
  id: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  columns?: string[];
  rowCount?: number;
}
```

```41:59:lib/langgraph/agent-state.ts
export interface AgentState {
  sessionId: string;
  messages: AgentMessage[];
  csvResourcesMetadata: CsvResourceMetadata[];
  currentQuery: string;
  currentQueryImages?: Array<{ data: string; mimeType: string }>;
}
```

### Nodes

1. Load CSV Metadata (`loadCsvMetadataNode`)

```9:21:lib/langgraph/nodes/load-csv-metadata-node.ts
export async function loadCsvMetadataNode(state: AgentState): Promise<Partial<AgentState>> {
  const resources = await resourceService.listBySession(state.sessionId);
  const csvResources = resources.filter(
    (r: any) => r.mimeType === 'text/csv' || r.mimeType === 'application/csv' || r.originalName.toLowerCase().endsWith('.csv')
  );
  const csvMetadata = await loadCsvMetadata(
    csvResources.map((r: any) => ({ id: r.id, storedPath: r.storedPath, originalName: r.originalName, sizeBytes: r.sizeBytes }))
  );
  return { csvResourcesMetadata: csvMetadata };
}
```

2. Agent (`agentNode`)

```12:26:lib/langgraph/nodes/agent-node.ts
export async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL || 'gemini-2.5-flash';
  const llm = new ChatGoogleGenerativeAI({ model: modelName, temperature: 0, apiKey, streaming: true }).bindTools(csvTools);
  const systemPrompt = buildSystemPrompt(state.csvResourcesMetadata);
  const langchainMessages = [ new SystemMessage(systemPrompt), .../* prior messages */, /* current query (with optional images) */ ];
  // Tool-call loop (max 5 iterations) then return updated messages
}
```

The `agent` node:

- Builds a system prompt customized with available CSVs.
- Converts chat history and the current query (including images) into LangChain messages.
- Invokes the LLM with bound CSV tools and iterates through tool calls until a final response is produced.
- Appends the user message and assistant response to the state `messages`.

3. Save Message (`saveMessageNode`)

```8:20:lib/langgraph/nodes/save-message-node.ts
export async function saveMessageNode(state: AgentState): Promise<Partial<AgentState>> {
  const messagesToSave = state.messages.slice(-2);
  for (const msg of messagesToSave) {
    const existing = await (prisma as any).message.findFirst({ where: { sessionId: state.sessionId, role: msg.role, content: msg.content } });
    if (!existing) {
      const metadata = msg.images && msg.images.length > 0 ? { images: msg.images } : null;
      await (prisma as any).message.create({ data: { sessionId: state.sessionId, role: msg.role, content: msg.content, metadata } });
    }
  }
  await (prisma as any).session.update({ where: { id: state.sessionId }, data: { updatedAt: new Date() } });
  return {};
}
```

### System Prompt and Metadata Loading

`system-prompt.ts` both builds the system prompt (listing available CSVs and tool usage guidance) and provides `loadCsvMetadata`, which enriches resource entries with columns and row counts via the CSV analysis service.

```18:27:lib/langgraph/system-prompt.ts
export function buildSystemPrompt(csvResourcesMetadata: CsvResourceMetadata[]): string {
  let prompt = 'You are a helpful AI assistant that can analyze CSV files and images. ';
  // ... adds per-resource details and tool guidelines ...
  return prompt;
}
```

```82:109:lib/langgraph/system-prompt.ts
export async function loadCsvMetadata(resources: Array<{ id: string; storedPath: string; originalName: string; sizeBytes: number }>): Promise<CsvResourceMetadata[]> {
  const schema = await csvAnalysisService.getCsvSchema(resource.id);
  // ... returns metadata including columns and rowCount when available ...
}
```

### Tooling Layer

The agent binds a suite of CSV tools implemented with `DynamicStructuredTool` and `zod` schemas. These are discoverable and callable by the LLM.

```272:281:lib/langgraph/tools/csv-tools.ts
export const csvTools = [
  loadCsvDataTool,
  filterCsvRowsTool,
  aggregateCsvDataTool,
  filterAndAggregateCsvDataTool,
  getCsvStatisticsTool,
  searchCsvTextTool,
  compareCsvDataTool,
];
```

Each tool validates inputs, calls into `csvAnalysisService`, and returns JSON-encoded results tailored for agent reasoning (often with limited rows for efficiency).

### Service: Running and Streaming the Graph

`LangGraphAgentService` owns a compiled graph instance and provides `streamAgent(sessionId, userMessage, images?)` to:

- Validate the session and load prior messages
- Build initial `AgentState`
- Persist the new user message immediately
- Start the graph with `streamEvents` and yield token chunks as they arrive

```16:33:lib/langgraph-agent-service.ts
export class LangGraphAgentService {
  private graph = initializeGraph();
  async *streamAgent(sessionId: string, userMessage: string, images?: Array<{ data: string; mimeType: string; originalName: string }>) {
    const session = await sessionService.getById(sessionId);
    const history = await messageService.listBySession(sessionId);
    const initialState: AgentState = { sessionId, messages, csvResourcesMetadata: [], currentQuery: userMessage, currentQueryImages: images?.map(...) };
    // persist user message then stream graph events
  }
}
```

Streaming is handled by listening for `on_chat_model_stream` events and yielding incremental content, then reconciling any remaining delta upon `on_chat_model_end`.

### Environment Variables

- `GOOGLE_API_KEY` or `LLM_API_KEY`: API key for Google Generative AI.
- `LLM_MODEL` (optional): model name (default: `gemini-2.5-flash`).

### Extensibility

- **Add a new tool**: implement a `DynamicStructuredTool` with a `zod` schema in `lib/langgraph/tools`, export it via `index.ts`, and it will be available once bound in `agent-node`.
- **Add a new node**: create a function with signature `(state: AgentState) => Promise<Partial<AgentState>>` and wire it into `initializeGraph()` with appropriate edges.
- **Change state shape**: update `AgentState` and the `StateAnnotation` in `graph.ts` to include the new field.
- **Customize system prompt**: edit `buildSystemPrompt` to reflect new tools or behaviors.

### Related Docs

- Sessions: see `docs/session.md` for session lifecycle and APIs.
- CSV Resources: see `docs/csv-resources.md` for upload, storage, and schema extraction.
