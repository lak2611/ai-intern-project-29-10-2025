import { initializeGraph } from './langgraph/graph';
import { AgentState } from './langgraph/agent-state';
import { sessionService } from './session-service';
import { checkpointer } from './langgraph/checkpointer';

export interface AgentResponse {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
  };
  metadata?: Record<string, any>;
}

export class LangGraphAgentService {
  private graph = initializeGraph();

  /**
   * Stream agent response (for SSE)
   * Streams LLM tokens as they are generated
   */
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
}

export const langGraphAgentService = new LangGraphAgentService();
