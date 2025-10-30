/**
 * Shared Message Types
 *
 * This file provides a single source of truth for Message interfaces
 * used across the application (frontend components and agent state).
 */

/**
 * Image data structure for messages
 */
export interface MessageImage {
  /** Base64 encoded image data */
  data: string;
  /** MIME type of the image */
  mimeType: string;
  /** Original filename (optional, used in frontend) */
  originalName?: string;
}

/**
 * Message interface for frontend components
 * Includes database fields (id, timestamp) and display fields (images with originalName)
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp when message was created */
  timestamp: Date;
  /** Optional images attached to the message */
  images?: MessageImage[];
}

/**
 * Message interface for LangGraph agent state
 * Does not include database fields (id, timestamp) as those are handled separately
 * Images don't include originalName as it's not needed in agent processing
 */
export interface AgentMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Optional images attached to the message (without originalName) */
  images?: Array<{
    data: string;
    mimeType: string;
  }>;
}
