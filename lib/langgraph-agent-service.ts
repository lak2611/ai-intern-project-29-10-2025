import { initializeGraph } from './langgraph/graph';
import { AgentState } from './langgraph/agent-state';
import { sessionService } from './session-service';
import { messageService } from './message-service';

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

    // Load conversation history
    const history = await messageService.listBySession(sessionId);
    const messages = history.map((msg: any) => {
      const message: any = {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
      // Extract images from metadata if present
      if (msg.metadata && msg.metadata.images && Array.isArray(msg.metadata.images)) {
        message.images = msg.metadata.images.map((img: any) => ({
          data: img.data,
          mimeType: img.mimeType,
        }));
      }
      return message;
    });

    // Initialize state
    const initialState: AgentState = {
      sessionId,
      messages,
      csvResourcesMetadata: [],
      currentQuery: userMessage,
      currentQueryImages: images?.map((img) => ({
        data: img.data,
        mimeType: img.mimeType,
      })),
    };

    // Create user message with images if provided
    if (images && images.length > 0) {
      await messageService.create({
        sessionId,
        role: 'user',
        content: userMessage,
        metadata: { images },
      });
    } else {
      await messageService.create({
        sessionId,
        role: 'user',
        content: userMessage,
      });
    }

    // Stream the graph execution with events to get token-level streaming
    const stream = this.graph.streamEvents(initialState, {
      version: 'v2',
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
