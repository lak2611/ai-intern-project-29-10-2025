import Papa from 'papaparse';
import fs from 'node:fs';
import { resourceService } from './resource-service';

export interface ParsedCsvData {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface CsvSchema {
  columns: string[];
  rowCount: number;
  numericColumns: string[];
  textColumns: string[];
}

export interface Filter {
  column: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
}

export interface AggregationResult {
  operation: string;
  column?: string;
  value: number | Record<string, number>;
  groupBy?: string[];
}

export class CsvAnalysisService {
  /**
   * Parse CSV file from disk
   */
  async parseCsv(storedPath: string, options?: { limit?: number; columns?: string[] }): Promise<ParsedCsvData> {
    const fileContent = fs.readFileSync(storedPath, 'utf-8');

    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<any>) => {
          if (results.errors.length > 0 && !results.data.length) {
            reject(new Error(`CSV parsing errors: ${results.errors.map((e: Papa.ParseError) => e.message).join(', ')}`));
            return;
          }

          let rows = results.data as Record<string, any>[];
          const headers = Object.keys(rows[0] || {});

          // Filter columns if specified
          if (options?.columns && options.columns.length > 0) {
            const availableColumns = headers.filter((h) => options.columns!.includes(h));
            rows = rows.map((row) => {
              const filtered: Record<string, any> = {};
              availableColumns.forEach((col) => {
                filtered[col] = row[col];
              });
              return filtered;
            });
          }

          // Apply limit if specified
          if (options?.limit) {
            rows = rows.slice(0, options.limit);
          }

          resolve({
            headers: options?.columns && options.columns.length > 0 ? headers.filter((h) => options.columns!.includes(h)) : headers,
            rows,
            rowCount: rows.length,
          });
        },
        error: (error: Error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        },
      });
    });
  }

  /**
   * Get CSV schema (headers, row count, column types)
   */
  async getCsvSchema(resourceId: string): Promise<CsvSchema> {
    const resource = await resourceService.getById(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    const data = await this.parseCsv(resource.storedPath, { limit: 1000 });
    const numericColumns: string[] = [];
    const textColumns: string[] = [];

    // Analyze column types from sample data
    if (data.rows.length > 0) {
      data.headers.forEach((header) => {
        const sampleValue = data.rows[0][header];
        if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '') {
          const numValue = Number(sampleValue);
          if (!isNaN(numValue) && isFinite(numValue)) {
            numericColumns.push(header);
          } else {
            textColumns.push(header);
          }
        }
      });
    }

    return {
      columns: data.headers,
      rowCount: data.rowCount,
      numericColumns,
      textColumns,
    };
  }

  /**
   * Load CSV data by resource ID
   */
  async loadCsvData(resourceId: string, options?: { limit?: number; columns?: string[] }): Promise<ParsedCsvData> {
    const resource = await resourceService.getById(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }

    return this.parseCsv(resource.storedPath, options);
  }

  /**
   * Filter CSV rows based on conditions
   */
  async filterData(data: ParsedCsvData, filters: Filter[]): Promise<ParsedCsvData> {
    const filteredRows = data.rows.filter((row) => {
      return filters.every((filter) => {
        const value = row[filter.column];
        const filterValue = filter.value;

        switch (filter.operator) {
          case 'eq':
            return value == filterValue;
          case 'gt':
            return Number(value) > Number(filterValue);
          case 'lt':
            return Number(value) < Number(filterValue);
          case 'gte':
            return Number(value) >= Number(filterValue);
          case 'lte':
            return Number(value) <= Number(filterValue);
          case 'contains':
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
          default:
            return false;
        }
      });
    });

    return {
      headers: data.headers,
      rows: filteredRows,
      rowCount: filteredRows.length,
    };
  }

  /**
   * Perform aggregation operations
   */
  async aggregateData(
    data: ParsedCsvData,
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group_by',
    column?: string,
    groupBy?: string[]
  ): Promise<AggregationResult> {
    if (operation === 'count') {
      return {
        operation: 'count',
        value: data.rowCount,
      };
    }

    if (!column) {
      throw new Error(`Column is required for operation: ${operation}`);
    }

    if (operation === 'group_by') {
      if (!groupBy || groupBy.length === 0) {
        throw new Error('groupBy columns are required for group_by operation');
      }

      const grouped: Record<string, Record<string, number>> = {};

      data.rows.forEach((row) => {
        const groupKey = groupBy.map((g) => String(row[g] || '')).join('|');
        if (!grouped[groupKey]) {
          grouped[groupKey] = {} as Record<string, number>;
          groupBy.forEach((g) => {
            (grouped[groupKey] as any)[g] = row[g];
          });
        }
        const numValue = Number(row[column]) || 0;
        (grouped[groupKey] as any)[column] = ((grouped[groupKey] as any)[column] || 0) + numValue;
      });

      return {
        operation: 'group_by',
        column,
        value: grouped as unknown as Record<string, number>,
        groupBy,
      };
    }

    const numericValues = data.rows.map((row) => Number(row[column])).filter((val) => !isNaN(val) && isFinite(val));

    if (numericValues.length === 0) {
      return {
        operation,
        column,
        value: 0,
      };
    }

    let result: number;
    switch (operation) {
      case 'sum':
        result = numericValues.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        break;
      case 'min':
        result = Math.min(...numericValues);
        break;
      case 'max':
        result = Math.max(...numericValues);
        break;
      default:
        result = 0;
    }

    return {
      operation,
      column,
      value: result,
    };
  }

  /**
   * Filter and aggregate in a single operation
   */
  async filterAndAggregateData(
    data: ParsedCsvData,
    filters: Filter[],
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group_by',
    column?: string,
    groupBy?: string[]
  ): Promise<AggregationResult> {
    const filtered = await this.filterData(data, filters);
    return this.aggregateData(filtered, operation, column, groupBy);
  }

  /**
   * Get statistics for numeric columns
   */
  async getStatistics(data: ParsedCsvData, columns?: string[]): Promise<Record<string, any>> {
    const columnsToAnalyze = columns || data.headers;
    const stats: Record<string, any> = {};

    columnsToAnalyze.forEach((col) => {
      const numericValues = data.rows.map((row) => Number(row[col])).filter((val) => !isNaN(val) && isFinite(val));

      if (numericValues.length === 0) {
        stats[col] = { error: 'No numeric values found' };
        return;
      }

      numericValues.sort((a, b) => a - b);
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;
      const median =
        numericValues.length % 2 === 0
          ? (numericValues[numericValues.length / 2 - 1] + numericValues[numericValues.length / 2]) / 2
          : numericValues[Math.floor(numericValues.length / 2)];

      const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
      const stdDev = Math.sqrt(variance);

      stats[col] = {
        count: numericValues.length,
        mean,
        median,
        min: numericValues[0],
        max: numericValues[numericValues.length - 1],
        stdDev,
        q1: numericValues[Math.floor(numericValues.length * 0.25)],
        q3: numericValues[Math.floor(numericValues.length * 0.75)],
      };
    });

    return stats;
  }

  /**
   * Search for text patterns in CSV
   */
  async searchText(data: ParsedCsvData, searchTerm: string, columns?: string[]): Promise<ParsedCsvData> {
    const columnsToSearch = columns || data.headers;
    const lowerSearchTerm = searchTerm.toLowerCase();

    const matchingRows = data.rows.filter((row) => {
      return columnsToSearch.some((col) => {
        const value = String(row[col] || '').toLowerCase();
        return value.includes(lowerSearchTerm);
      });
    });

    return {
      headers: data.headers,
      rows: matchingRows,
      rowCount: matchingRows.length,
    };
  }
}

export const csvAnalysisService = new CsvAnalysisService();
