import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import path from 'path';

/**
 * Initialize SqliteSaver checkpointer
 *
 * Uses a SEPARATE SQLite database for checkpoints to avoid conflicts with Prisma.
 * This is safer than sharing the same DB file because:
 * - Prisma and LangGraph use different table schemas
 * - Avoids potential locking conflicts
 * - Easier to manage and backup separately
 *
 * Why better-sqlite3?
 * - Required by @langchain/langgraph-checkpoint-sqlite (SqliteSaver constructor expects Database instance)
 * - High-performance synchronous SQLite interface
 * - Simpler than async alternatives for checkpoint operations
 *
 * Uses lazy initialization to avoid loading better-sqlite3 bindings at module load time.
 * This prevents errors in Next.js when native modules aren't built yet.
 */
let checkpointerInstance: SqliteSaver | null = null;

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
