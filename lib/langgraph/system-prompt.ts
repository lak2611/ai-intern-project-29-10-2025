import { CsvResourceMetadata } from './agent-state';
import { csvAnalysisService } from '../csv-analysis-service';
import { formatBytes } from '../utils';

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
  prompt += '- load_csv_data: Load and parse a CSV file (use this first to inspect schema)\n';
  prompt +=
    '- execute_sql_query: Execute SQL SELECT queries on CSV data - USE THIS for all filtering, aggregation, searching, and complex analysis\n';
  prompt += '  * Table name: "csv_data"\n';
  prompt += '  * Quote column names with spaces: SELECT "First Name", Age FROM csv_data\n';
  prompt += '  * Supports: WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, JOINs, subqueries, and all SQLite functions\n';
  prompt += '  * Examples:\n';
  prompt += '    - Filter: SELECT * FROM csv_data WHERE Age > 25 AND Department = "Sales"\n';
  prompt += '    - Aggregate: SELECT Department, AVG(CAST(Salary AS REAL)) as avg_salary FROM csv_data GROUP BY Department\n';
  prompt += '    - Search: SELECT * FROM csv_data WHERE "First Name" LIKE "%John%"\n';
  prompt +=
    '    - Statistics: SELECT COUNT(*) as count, AVG(CAST(Age AS REAL)) as avg_age, MIN(CAST(Age AS REAL)) as min_age, MAX(CAST(Age AS REAL)) as max_age FROM csv_data\n';

  prompt += 'When a user asks about CSV data:\n';
  prompt += '1. Use load_csv_data first to inspect the schema (columns and row count)\n';
  prompt += '2. Use execute_sql_query for all data analysis tasks (filtering, aggregation, searching, etc.)\n';
  prompt += "3. Write SQL queries that match the user's request - SQL is powerful and can handle complex queries\n";
  prompt += '4. Quote column names with spaces or special characters: "Column Name"\n';
  prompt += '5. Use CAST(column AS REAL) for numeric operations on text columns\n';
  prompt += '6. Provide clear, natural language explanations of your findings\n';
  prompt += "7. If multiple CSVs are available, clarify which one you're analyzing\n";
  prompt += '8. Use LIMIT to avoid returning too many rows\n\n';

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
  prompt += '- Prefer execute_sql_query over individual filter/aggregate tools - SQL is more flexible\n';
  prompt += '- Use quoted identifiers for column names with spaces: "First Name" not First Name\n';
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
