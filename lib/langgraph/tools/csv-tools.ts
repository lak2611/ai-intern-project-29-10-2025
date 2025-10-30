import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { csvAnalysisService, type Filter } from '../../csv-analysis-service';

/**
 * Tool: Load CSV data
 */
export const loadCsvDataTool = new DynamicStructuredTool({
  name: 'load_csv_data',
  description:
    'Loads and parses a CSV file by resource ID. Returns the data structure with headers and rows. Use this first when you need to analyze CSV data.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource to load'),
    limit: z.number().optional().describe('Maximum number of rows to return (default: 1000). Use this for large files to avoid loading everything.'),
    columnsJson: z.string().optional().describe('JSON string array of specific columns to load. Loads all columns if not specified.'),
  }),
  func: async ({ resourceId, limit, columnsJson }) => {
    try {
      const columns = columnsJson ? (JSON.parse(columnsJson) as string[]) : undefined;
      const data = await csvAnalysisService.loadCsvData(resourceId, { limit, columns });
      return JSON.stringify(
        {
          success: true,
          headers: data.headers,
          rowCount: data.rowCount,
          sampleRows: data.rows.slice(0, 10), // Return first 10 rows as sample
          totalRows: data.rowCount,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Filter CSV rows
 */
export const filterCsvRowsTool = new DynamicStructuredTool({
  name: 'filter_csv_rows',
  description:
    'Filters CSV rows based on column conditions. Use this when users ask to filter data by specific criteria. Pass filters as JSON string.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource to filter'),
    filtersJson: z
      .string()
      .describe(
        'JSON string of filter conditions array. Each filter has: column (string), operator (eq|gt|lt|gte|lte|contains), value (string|number)'
      ),
  }),
  func: async ({ resourceId, filtersJson }) => {
    try {
      const filters = JSON.parse(filtersJson) as Filter[];
      const data = await csvAnalysisService.loadCsvData(resourceId);
      const filtered = await csvAnalysisService.filterData(data, filters);
      return JSON.stringify(
        {
          success: true,
          rowCount: filtered.rowCount,
          rows: filtered.rows.slice(0, 100), // Limit to 100 rows
          totalMatches: filtered.rowCount,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Aggregate CSV data
 */
export const aggregateCsvDataTool = new DynamicStructuredTool({
  name: 'aggregate_csv_data',
  description:
    'Performs aggregations and calculations on CSV data (sum, average, count, min, max, group_by). Use this for calculations and statistics.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource to aggregate'),
    operation: z.enum(['sum', 'avg', 'count', 'min', 'max', 'group_by']).describe('Aggregation operation'),
    column: z.string().optional().describe('Column name for sum/avg/min/max operations'),
    groupByJson: z.string().optional().describe('JSON string array of columns to group by for group_by operation'),
  }),
  func: async ({ resourceId, operation, column, groupByJson }) => {
    try {
      const groupBy = groupByJson ? (JSON.parse(groupByJson) as string[]) : undefined;
      const data = await csvAnalysisService.loadCsvData(resourceId);
      const result = await csvAnalysisService.aggregateData(data, operation, column, groupBy);
      return JSON.stringify(
        {
          success: true,
          ...result,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Filter and aggregate in one operation
 */
export const filterAndAggregateCsvDataTool = new DynamicStructuredTool({
  name: 'filter_and_aggregate_csv_data',
  description: 'Performs filtering and aggregation in a single efficient operation. Use this when you need both filtering and aggregation together.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource'),
    filtersJson: z
      .string()
      .describe(
        'JSON string of filter conditions array. Each filter has: column (string), operator (eq|gt|lt|gte|lte|contains), value (string|number)'
      ),
    operation: z.enum(['sum', 'avg', 'count', 'min', 'max', 'group_by']).describe('Aggregation operation'),
    column: z.string().optional().describe('Column name for sum/avg/min/max operations'),
    groupByJson: z.string().optional().describe('JSON string array of columns to group by for group_by operation'),
  }),
  func: async ({ resourceId, filtersJson, operation, column, groupByJson }) => {
    try {
      const filters = JSON.parse(filtersJson) as Filter[];
      const groupBy = groupByJson ? (JSON.parse(groupByJson) as string[]) : undefined;
      const data = await csvAnalysisService.loadCsvData(resourceId);
      const result = await csvAnalysisService.filterAndAggregateData(data, filters, operation, column, groupBy);
      return JSON.stringify(
        {
          success: true,
          ...result,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Get CSV statistics
 */
export const getCsvStatisticsTool = new DynamicStructuredTool({
  name: 'get_csv_statistics',
  description:
    'Computes descriptive statistics for numeric columns (mean, median, std dev, min, max, quartiles). Use this for data analysis and understanding distributions.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource'),
    columnsJson: z.string().optional().describe('JSON string array of specific columns to analyze. Analyzes all numeric columns if not specified.'),
  }),
  func: async ({ resourceId, columnsJson }) => {
    try {
      const columns = columnsJson ? (JSON.parse(columnsJson) as string[]) : undefined;
      const data = await csvAnalysisService.loadCsvData(resourceId);
      const stats = await csvAnalysisService.getStatistics(data, columns);
      return JSON.stringify(
        {
          success: true,
          statistics: stats,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Search CSV text
 */
export const searchCsvTextTool = new DynamicStructuredTool({
  name: 'search_csv_text',
  description: 'Searches for text patterns across CSV columns. Use this when users ask to find specific text or values.',
  schema: z.object({
    resourceId: z.string().describe('The ID of the CSV resource'),
    searchTerm: z.string().describe('Text pattern to search for'),
    columnsJson: z.string().optional().describe('JSON string array of specific columns to search. Searches all columns if not specified.'),
  }),
  func: async ({ resourceId, searchTerm, columnsJson }) => {
    try {
      const columns = columnsJson ? (JSON.parse(columnsJson) as string[]) : undefined;
      const data = await csvAnalysisService.loadCsvData(resourceId);
      const results = await csvAnalysisService.searchText(data, searchTerm, columns);
      return JSON.stringify(
        {
          success: true,
          rowCount: results.rowCount,
          rows: results.rows.slice(0, 100), // Limit to 100 rows
          totalMatches: results.rowCount,
        },
        null,
        2
      );
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});
/**
 * Export all CSV tools
 */
export const csvTools = [
  loadCsvDataTool,
  filterCsvRowsTool,
  aggregateCsvDataTool,
  filterAndAggregateCsvDataTool,
  getCsvStatisticsTool,
  searchCsvTextTool,
];
