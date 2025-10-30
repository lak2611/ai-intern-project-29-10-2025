import { CsvResourceMetadata } from './agent-state';
import { csvAnalysisService } from '../csv-analysis-service';

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Builds system prompt with CSV resource information
 */
export function buildSystemPrompt(csvResourcesMetadata: CsvResourceMetadata[]): string {
  let prompt = 'You are a helpful AI assistant that can analyze CSV files and images. ';
  prompt += 'You have access to CSV analysis tools to help users understand their data. ';
  prompt += 'You can also analyze images that users upload with their messages using your vision capabilities.\n\n';

  if (csvResourcesMetadata.length === 0) {
    prompt += 'No CSV resources are currently available in this session.\n';
    prompt += 'If the user asks about CSV data, inform them that no CSV files have been uploaded yet.\n';
  } else {
    prompt += `The current session has ${csvResourcesMetadata.length} CSV resource(s) available:\n\n`;

    csvResourcesMetadata.forEach((resource, index) => {
      prompt += `[CSV Resource ${index + 1}]\n`;
      prompt += `- ID: ${resource.id}\n`;
      prompt += `- Filename: ${resource.originalName}\n`;
      prompt += `- Size: ${formatBytes(resource.sizeBytes)}\n`;
      if (resource.columns && resource.columns.length > 0) {
        prompt += `- Columns: ${resource.columns.join(', ')}\n`;
      }
      if (resource.rowCount !== undefined) {
        prompt += `- Row Count: ${resource.rowCount.toLocaleString()}\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += '\nYou have access to the following CSV analysis tools:\n';
  prompt += '- load_csv_data: Load and parse a CSV file (use this first when analyzing data)\n';
  prompt += '- filter_csv_rows: Filter rows based on conditions\n';
  prompt += '- aggregate_csv_data: Perform calculations (sum, avg, count, min, max, group_by)\n';
  prompt += '- filter_and_aggregate_csv_data: Combine filtering and aggregation efficiently\n';
  prompt += '- get_csv_statistics: Get descriptive statistics for numeric columns\n';
  prompt += '- search_csv_text: Search for text patterns in CSV data\n';

  prompt += 'When a user asks about CSV data:\n';
  prompt += '1. Identify which CSV file(s) are relevant from the list above\n';
  prompt += '2. Use the appropriate tools to analyze the data\n';
  prompt += '3. Provide clear, natural language explanations of your findings\n';
  prompt += "4. If multiple CSVs are available, clarify which one you're analyzing\n";
  prompt += '5. For large files, use the limit parameter to avoid loading everything\n\n';

  prompt += 'Image Analysis:\n';
  prompt += '- Users can upload images (JPEG, PNG, WebP, GIF) along with their messages\n';
  prompt += '- You can analyze images using your vision capabilities to understand their content\n';
  prompt += '- When images are provided, describe what you see and answer questions about the images\n';
  prompt += '- You can combine image analysis with CSV data analysis if both are relevant\n';
  prompt += '- If multiple images are provided, analyze each one and note relationships between them\n\n';

  prompt += 'Important guidelines:\n';
  prompt += '- If no CSV resources are available, inform the user and suggest uploading a CSV file\n';
  prompt += "- If the user's query is unclear, ask clarifying questions\n";
  prompt += "- Always provide context about which CSV file and columns you're analyzing\n";
  prompt += '- Use filter_and_aggregate_csv_data when both filtering and aggregation are needed\n';
  prompt += '- Be concise but thorough in your analysis\n';
  prompt += '- When analyzing images, provide detailed descriptions and insights\n';
  prompt += '- If users upload images without text, analyze the images and describe what you see\n';

  return prompt;
}

/**
 * Loads CSV metadata (columns and row count) for resources
 */
export async function loadCsvMetadata(
  resources: Array<{ id: string; storedPath: string; originalName: string; sizeBytes: number }>
): Promise<CsvResourceMetadata[]> {
  const metadataPromises = resources.map(async (resource) => {
    try {
      const schema = await csvAnalysisService.getCsvSchema(resource.id);
      return {
        id: resource.id,
        originalName: resource.originalName,
        storedPath: resource.storedPath,
        sizeBytes: resource.sizeBytes,
        columns: schema.columns,
        rowCount: schema.rowCount,
      };
    } catch (error) {
      // If schema loading fails, return basic metadata
      return {
        id: resource.id,
        originalName: resource.originalName,
        storedPath: resource.storedPath,
        sizeBytes: resource.sizeBytes,
      };
    }
  });

  return Promise.all(metadataPromises);
}
