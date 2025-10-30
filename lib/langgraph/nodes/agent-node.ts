import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { buildSystemPrompt } from '../system-prompt';
import { csvTools } from '../tools';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { AgentState } from '../agent-state';

/**
 * Node: Agent (Single LLM Node)
 * Processes user query with CSV tools and generates response
 */
export async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
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

  // Convert state messages to LangChain messages
  const langchainMessages = [
    new SystemMessage(systemPrompt),
    ...state.messages.map((msg) => {
      if (msg.role === 'user') {
        // Handle multimodal content with images
        if (msg.images && msg.images.length > 0) {
          const imageContent = msg.images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          }));

          return new HumanMessage({
            content: [{ type: 'text' as const, text: msg.content }, ...imageContent],
          });
        } else {
          return new HumanMessage(msg.content);
        }
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        return new SystemMessage(msg.content);
      }
    }),
    // Handle current query with images if present
    state.currentQueryImages && state.currentQueryImages.length > 0
      ? (() => {
          console.log('📸 Processing message with images:', {
            queryText: state.currentQuery,
            imageCount: state.currentQueryImages.length,
            firstImageMimeType: state.currentQueryImages[0]?.mimeType,
            firstImageDataLength: state.currentQueryImages[0]?.data?.length,
          });

          const imageContents = state.currentQueryImages.map((img) => {
            // Ensure base64 data is clean (no whitespace)
            const cleanData = img.data?.trim() || img.data;
            const imageUrl = `data:${img.mimeType};base64,${cleanData}`;

            return {
              type: 'image_url' as const,
              image_url: { url: imageUrl },
            };
          });

          // Ensure we have at least some text - Google Gemini may need non-empty text
          const queryText = state.currentQuery?.trim() || 'Please analyze the image(s) I uploaded.';

          const content = [
            // Text must come first for Google Gemini
            { type: 'text' as const, text: queryText },
            ...imageContents,
          ];

          console.log('📸 Created HumanMessage with content:', {
            textLength: content[0] && 'text' in content[0] ? content[0].text.length : 0,
            imageCount: imageContents.length,
          });

          return new HumanMessage({ content });
        })()
      : new HumanMessage(state.currentQuery || ''),
  ];

  // Invoke LLM with tools - loop to handle tool calls
  let messages: Array<SystemMessage | HumanMessage | AIMessage | ToolMessage> = langchainMessages;
  let responseContent = '';
  let maxIterations = 5; // Prevent infinite loops
  let iteration = 0;

  while (iteration < maxIterations) {
    const response = await llm.invoke(messages);
    messages.push(response);

    // Check if response has tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Execute tool calls
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
          const toolCallId = toolCall.id ?? `tool_call_${Date.now()}_${Math.random()}`;
          const tool = csvTools.find((t) => t.name === toolCall.name) as StructuredToolInterface | undefined;
          if (!tool) {
            return new ToolMessage({
              content: `Tool ${toolCall.name} not found`,
              tool_call_id: toolCallId,
            });
          }

          try {
            const result = await tool.invoke(toolCall.args);
            return new ToolMessage({
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCallId,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new ToolMessage({
              content: `Error executing tool: ${errorMessage}`,
              tool_call_id: toolCallId,
            });
          }
        })
      );

      messages.push(...toolResults);
      iteration++;
      continue; // Loop back to get final response
    } else {
      // No tool calls, we have the final response
      // For streaming, we use invoke() which LangGraph will intercept and stream
      // The response content will be streamed via LangGraph's streamEvents
      responseContent = response.content as string;
      break;
    }
  }

  // If we hit max iterations, use the last response
  if (iteration >= maxIterations && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage instanceof AIMessage) {
      responseContent = lastMessage.content as string;
    }
  }

  // Add user message and assistant response to messages
  const userMessage: AgentState['messages'][number] = {
    role: 'user' as const,
    content: state.currentQuery || '',
    ...(state.currentQueryImages &&
      state.currentQueryImages.length > 0 && {
        images: state.currentQueryImages,
      }),
  };

  const newMessages: AgentState['messages'] = [
    ...state.messages,
    userMessage,
    {
      role: 'assistant' as const,
      content: responseContent,
    },
  ];

  return {
    messages: newMessages,
  };
}
