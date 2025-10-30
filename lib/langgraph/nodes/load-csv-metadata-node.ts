import { resourceService } from '../../resource-service';
import { loadCsvMetadata } from '../system-prompt';
import type { AgentState } from '../agent-state';

/**
 * Node: Load CSV Metadata
 * Fetches CSV resources and loads their metadata (columns, row count)
 */
export async function loadCsvMetadataNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Fetch all CSV resources for the session
    const resources = await resourceService.listBySession(state.sessionId);

    // Filter to CSV files only
    const csvResources = resources.filter(
      (r: any) => r.mimeType === 'text/csv' || r.mimeType === 'application/csv' || r.originalName.toLowerCase().endsWith('.csv')
    );

    // Load CSV metadata (columns, row count)
    const csvMetadata = await loadCsvMetadata(
      csvResources.map((r: any) => ({
        id: r.id,
        storedPath: r.storedPath,
        originalName: r.originalName,
        sizeBytes: r.sizeBytes,
      }))
    );

    return {
      csvResourcesMetadata: csvMetadata,
    };
  } catch (error: any) {
    console.error('Error loading CSV metadata:', error);
    return {
      csvResourcesMetadata: [],
    };
  }
}
