/**
 * Agent State Types for LangGraph CSV Analysis Agent
 *
 * This file defines the core types used throughout the LangGraph agent implementation,
 * including the main AgentState interface and CsvResourceMetadata type.
 */

/**
 * Metadata for a CSV resource attached to a session
 */
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

/**
 * Message structure for conversation history
 */
export interface Message {
  /** Message role: user, assistant, or system */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Optional images for multimodal messages */
  images?: Array<{
    data: string; // base64 string
    mimeType: string;
  }>;
}

/**
 * Main state interface for the LangGraph agent
 *
 * This state is passed between nodes in the LangGraph execution flow:
 * 1. loadCsvMetadataNode - populates csvResourcesMetadata
 * 2. agentNode - uses all state to process user query
 * 3. saveMessageNode - persists messages to database
 */
export interface AgentState {
  /** Session ID for this conversation */
  sessionId: string;

  /** Conversation history (all previous messages) */
  messages: Message[];

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

/**
 * Type guard to check if a value is a valid CsvResourceMetadata
 */
export function isCsvResourceMetadata(value: any): value is CsvResourceMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.originalName === 'string' &&
    typeof value.storedPath === 'string' &&
    typeof value.sizeBytes === 'number' &&
    (value.columns === undefined || Array.isArray(value.columns)) &&
    (value.rowCount === undefined || typeof value.rowCount === 'number')
  );
}

/**
 * Type guard to check if a value is a valid Message
 */
export function isMessage(value: any): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    typeof value.content === 'string' &&
    (value.images === undefined ||
      (Array.isArray(value.images) &&
        value.images.every(
          (img: any) => typeof img === 'object' && img !== null && typeof img.data === 'string' && typeof img.mimeType === 'string'
        )))
  );
}

/**
 * Type guard to check if a value is a valid AgentState
 */
export function isAgentState(value: any): value is AgentState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.sessionId === 'string' &&
    Array.isArray(value.messages) &&
    Array.isArray(value.csvResourcesMetadata) &&
    typeof value.currentQuery === 'string' &&
    value.messages.every(isMessage) &&
    value.csvResourcesMetadata.every(isCsvResourceMetadata)
  );
}
