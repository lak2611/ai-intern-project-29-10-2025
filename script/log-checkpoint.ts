#!/usr/bin/env tsx
/**
 * Script to log the newest checkpoint state of a session ID to a JSON file
 *
 * Usage:
 *   pnpm tsx script/log-checkpoint.ts <sessionId> [outputFile]
 *   # or
 *   npx tsx script/log-checkpoint.ts <sessionId> [outputFile]
 *   # or if tsx is installed globally
 *   tsx script/log-checkpoint.ts <sessionId> [outputFile]
 *
 * Example:
 *   pnpm tsx script/log-checkpoint.ts cmhca53080004czunw33zonhw
 *   pnpm tsx script/log-checkpoint.ts cmhca53080004czunw33zonhw checkpoint.json
 *
 * Note: If tsx is not installed, you can install it with:
 *   pnpm add -D tsx
 */

import { checkpointer } from '../lib/langgraph/checkpointer';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function logCheckpoint(sessionId: string, outputFile?: string): Promise<void> {
  try {
    console.log(`Fetching checkpoint for session: ${sessionId}`);

    // Try to get all checkpoints using list() to find the newest one
    // If list() is not available, fall back to get() which returns the latest checkpoint
    let checkpoint: any = null;

    try {
      // Try to list all checkpoints for this thread to find the newest one
      if (typeof (checkpointer as any).list === 'function') {
        const checkpoints = await (checkpointer as any).list({
          configurable: { thread_id: sessionId },
        });

        if (checkpoints && checkpoints.length > 0) {
          // Find the newest checkpoint (highest checkpoint_id or most recent)
          checkpoint = checkpoints.reduce((newest: any, current: any) => {
            if (!newest) return current;
            // Compare checkpoint_ids (they should be sequential/incremental)
            const newestId = newest.checkpoint_id || '';
            const currentId = current.checkpoint_id || '';
            return currentId > newestId ? current : newest;
          });
          console.log(`Found ${checkpoints.length} checkpoint(s), using the newest one`);
        }
      }
    } catch (listError) {
      // If list() fails or doesn't exist, continue to use get()
      console.log('Using get() method to fetch latest checkpoint');
    }

    // If list() didn't work or returned no results, use get() to get the latest checkpoint
    if (!checkpoint) {
      checkpoint = await checkpointer.get({
        configurable: { thread_id: sessionId },
      });
    }

    if (!checkpoint) {
      console.error(`No checkpoint found for session: ${sessionId}`);
      process.exit(1);
    }

    // Serialize the checkpoint to JSON
    // Convert to a plain object to handle any non-serializable values
    const checkpointData = {
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_ns: checkpoint.checkpoint_ns,
      checkpoint_ns_type: checkpoint.checkpoint_ns_type,
      thread_id: sessionId,
      channel_values: checkpoint.channel_values,
      channel_versions: checkpoint.channel_versions,
      versions_seen: checkpoint.versions_seen,
      parent_checkpoint_id: checkpoint.parent_checkpoint_id,
    };

    // Determine output file path
    const outputPath = outputFile ? join(process.cwd(), outputFile) : join(process.cwd(), `checkpoint-${sessionId}.json`);

    // Write to JSON file with pretty formatting
    await writeFile(outputPath, JSON.stringify(checkpointData, null, 2), 'utf-8');

    console.log(`✓ Checkpoint state written to: ${outputPath}`);
    console.log(`  Checkpoint ID: ${checkpoint.checkpoint_id}`);
    console.log(`  Thread ID: ${sessionId}`);

    // Print summary of channel values
    if (checkpoint.channel_values) {
      const keys = Object.keys(checkpoint.channel_values);
      console.log(`  Channels: ${keys.join(', ')}`);

      if (checkpoint.channel_values.messages) {
        const messages = checkpoint.channel_values.messages as any[];
        console.log(`  Messages count: ${messages.length}`);
      }
    }
  } catch (error) {
    console.error('Error fetching checkpoint:', error);
    process.exit(1);
  }
}

// Main execution
const sessionId = process.argv[2];
const outputFile = process.argv[3];

if (!sessionId) {
  console.error('Error: Session ID is required');
  console.error('\nUsage: pnpm tsx script/log-checkpoint.ts <sessionId> [outputFile]');
  console.error('\nExample:');
  console.error('  pnpm tsx script/log-checkpoint.ts cmhca53080004czunw33zonhw');
  console.error('  pnpm tsx script/log-checkpoint.ts cmhca53080004czunw33zonhw checkpoint.json');
  process.exit(1);
}

logCheckpoint(sessionId, outputFile).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
