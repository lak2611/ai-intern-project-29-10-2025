"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkpointer = void 0;
var langgraph_checkpoint_sqlite_1 = require("@langchain/langgraph-checkpoint-sqlite");
var path_1 = require("path");
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
var checkpointerInstance = null;
function getCheckpointer() {
    if (!checkpointerInstance) {
        // Lazy import to avoid loading native module at module load time
        // Use dynamic require to delay loading until actually needed
        var Database = require('better-sqlite3');
        var dbPath = path_1.default.join(process.cwd(), 'checkpoints.sqlite');
        var db = new Database(dbPath);
        // SqliteSaver constructor takes a Database instance
        checkpointerInstance = new langgraph_checkpoint_sqlite_1.SqliteSaver(db);
    }
    return checkpointerInstance;
}
// Create a proxy that delegates all calls to the actual checkpointer instance
exports.checkpointer = new Proxy({}, {
    get: function (_target, prop) {
        var instance = getCheckpointer();
        var value = instance[prop];
        if (typeof value === 'function') {
            return value.bind(instance);
        }
        return value;
    },
});
