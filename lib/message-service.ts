import { checkpointer } from './langgraph/checkpointer';
import { HumanMessage, AIMessage, AIMessageChunk } from '@langchain/core/messages';

/**
 * Check if a message is a HumanMessage or AIMessage/AIMessageChunk
 * LangChain checkpointer returns deserialized message objects, not serialized format
 */
function isMessageType(message: any): message is HumanMessage | AIMessage {
  if (!message || typeof message !== 'object') return false;

  // Check if it's an instance of LangChain message classes
  if (message instanceof HumanMessage || message instanceof AIMessage || message instanceof AIMessageChunk) {
    return true;
  }
  return false;
}

/**
 * Get message type from LangChain message object
 */
function getMessageType(message: any): 'user' | 'assistant' | null {
  if (!message || typeof message !== 'object') return null;

  // Check instanceof first (most reliable)
  if (message instanceof HumanMessage) return 'user';
  if (message instanceof AIMessage || message instanceof AIMessageChunk) return 'assistant';

  // Check constructor name
  const constructorName = message.constructor?.name || '';
  if (constructorName === 'HumanMessage') return 'user';
  if (constructorName === 'AIMessage' || constructorName === 'AIMessageChunk') return 'assistant';

  // Check getType() method
  if (typeof message.getType === 'function') {
    const type = message.getType();
    if (type === 'human') return 'user';
    if (type === 'ai') return 'assistant';
  }

  return null;
}

/**
 * Extract content from LangChain message object
 */
function extractContent(message: any): string {
  if (!message || typeof message !== 'object') return '';

  const content = message.content;

  // Content can be string or array of content blocks
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c?.type === 'text' && typeof c.text === 'string') return c.text;
        return '';
      })
      .join('');
  }

  return '';
}

/**
 * Extract images from HumanMessage content array
 */
function extractImages(message: any): Array<{ data: string; mimeType: string }> | undefined {
  if (!message || typeof message !== 'object') return undefined;

  const content = message.content;
  if (!Array.isArray(content)) return undefined;

  const images = content
    .filter((c) => c?.type === 'image_url' && c?.image_url?.url)
    .map((c) => {
      const url = c.image_url.url;
      const base64Match = url.match(/^data:(.*);base64,(.+)$/);
      if (base64Match) {
        return {
          data: base64Match[2],
          mimeType: base64Match[1] || 'image/png',
        };
      }
      return null;
    })
    .filter((img): img is { data: string; mimeType: string } => img !== null);

  return images.length > 0 ? images : undefined;
}

/**
 * Extract timestamp from message additional_kwargs
 */
function extractTimestamp(message: any): Date {
  if (message?.additional_kwargs?.timestamp) {
    const ts = message.additional_kwargs.timestamp;
    if (typeof ts === 'string' || typeof ts === 'number') {
      return new Date(ts);
    }
  }
  return new Date();
}

/**
 * Check if a message has tool calls
 */
function hasToolCalls(message: any): boolean {
  if (!message || typeof message !== 'object') return false;

  // Check if message has tool_calls array with items
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return true;
  }

  // Check if content array contains functionCall blocks
  if (Array.isArray(message.content)) {
    return message.content.some((c: any) => c?.type === 'functionCall');
  }

  return false;
}

class MessageService {
  /**
   * List all messages for a session
   * Loads messages from LangGraph checkpoints only
   */
  listBySession = async (sessionId: string) => {
    try {
      const checkpoint = await checkpointer.get({
        configurable: { thread_id: sessionId },
      });

      if (checkpoint && checkpoint.channel_values.messages) {
        const messages = checkpoint.channel_values.messages as any[];

        // Filter and convert LangChain messages to API-compatible format
        // Filter out messages that have tool calls
        return messages
          .filter(isMessageType)
          .filter((message) => !hasToolCalls(message))
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

  getById = async (id: string) => {
    // Extract sessionId from message ID format: `msg-{sessionId}-{index}`
    const match = id.match(/^msg-(.+)-(\d+)$/);
    if (!match) {
      // Invalid message ID format
      return null;
    }

    const [, sessionId, indexStr] = match;
    const index = parseInt(indexStr, 10);

    try {
      const checkpoint = await checkpointer.get({
        configurable: { thread_id: sessionId },
      });

      if (checkpoint && checkpoint.channel_values.messages) {
        const messages = checkpoint.channel_values.messages as any[];

        // Filter to only message types we support, and filter out messages with tool calls
        const validMessages = messages.filter(isMessageType).filter((message) => !hasToolCalls(message));

        if (validMessages[index]) {
          const message = validMessages[index];
          const role = getMessageType(message);
          if (!role) {
            // This should never happen since we filtered with isMessageType, but handle it safely
            return null;
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
        }
      }
    } catch (error) {
      console.error('Error loading from checkpoints:', error);
    }

    // Return null if message not found
    return null;
  };
}

export const messageService = new MessageService();
