import { prisma } from './prisma';
import { createResourceFromUploadSchema, allowedCsvMimeTypes } from './schemas/resource';
import { deleteObject, getStream, putObject } from './storage/disk';
import { formatBytes } from './utils';
import Papa from 'papaparse';

class ResourceService {
  listBySession = async (sessionId: string) => {
    return (prisma as any).resource.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
  };

  getById = async (id: string) => {
    return (prisma as any).resource.findUnique({ where: { id } });
  };

  private validateCsvParsing = async (buffer: Uint8Array): Promise<void> => {
    try {
      const textContent = new TextDecoder().decode(buffer);
      await new Promise<void>((resolve, reject) => {
        Papa.parse(textContent, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<any>) => {
            if (results.errors.length > 0) {
              reject(new Error(`CSV parsing errors: ${results.errors.map((e: Papa.ParseError) => e.message).join(', ')}`));
              return;
            }
            // If we have data or no critical errors, consider it valid
            resolve();
          },
          error: (error: Error) => {
            reject(new Error(`Failed to parse CSV: ${error.message}`));
          },
        });
      });
    } catch (error: any) {
      throw new Error(`Invalid CSV file: ${error.message}`);
    }
  };

  createFromUpload = async (sessionId: string, file: File) => {
    if (!sessionId) throw new Error('sessionId is required');
    if (!file) throw new Error('file is required');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const originalName = file.name || 'upload.csv';
    const mimeType = (file.type || 'text/csv') as (typeof allowedCsvMimeTypes)[number] | string;
    const sizeBytes = buffer.byteLength;

    // Validate CSV can be parsed
    await this.validateCsvParsing(buffer);

    const parsed = createResourceFromUploadSchema.parse({
      sessionId,
      originalName,
      mimeType: (allowedCsvMimeTypes.includes(mimeType as any) ? mimeType : 'text/csv') as any,
      sizeBytes,
    });

    const { storedPath } = await putObject({ sessionId, originalName: parsed.originalName, mimeType: parsed.mimeType, data: buffer });

    const created = await (prisma as any).resource.create({
      data: {
        sessionId,
        originalName: parsed.originalName,
        storedPath,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
      },
    });
    return created;
  };

  createFromUrl = async (sessionId: string, url: string) => {
    if (!sessionId) throw new Error('sessionId is required');
    if (!url) throw new Error('url is required');

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Fetch the file from URL
    const maxSize = Number(process.env.UPLOAD_MAX_BYTES || 20 * 1024 * 1024);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'text/csv';
    const contentLength = response.headers.get('content-length');

    if (contentLength && Number(contentLength) > maxSize) {
      throw new Error(`File too large: ${formatBytes(Number(contentLength))}. Maximum allowed size is ${formatBytes(maxSize)}`);
    }

    // Extract filename from URL or use default
    const urlPath = parsedUrl.pathname;
    const originalName = urlPath.split('/').pop() || 'download.csv';

    // Validate filename extension
    if (!originalName.toLowerCase().endsWith('.csv')) {
      throw new Error('URL must point to a CSV file (.csv extension required)');
    }

    // Validate content-type
    if (!allowedCsvMimeTypes.includes(contentType as any)) {
      throw new Error(`URL must point to a CSV file (content-type must be one of: ${allowedCsvMimeTypes.join(', ')})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.byteLength > maxSize) {
      throw new Error(`File too large: ${formatBytes(buffer.byteLength)}. Maximum allowed size is ${formatBytes(maxSize)}`);
    }

    // Validate CSV can be parsed
    await this.validateCsvParsing(buffer);

    const fileName = originalName;
    const mimeType = contentType as (typeof allowedCsvMimeTypes)[number];

    const parsed = createResourceFromUploadSchema.parse({
      sessionId,
      originalName: fileName,
      mimeType,
      sizeBytes: buffer.byteLength,
    });

    const { storedPath } = await putObject({ sessionId, originalName: parsed.originalName, mimeType: parsed.mimeType, data: buffer });

    const created = await (prisma as any).resource.create({
      data: {
        sessionId,
        originalName: parsed.originalName,
        storedPath,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
      },
    });
    return created;
  };

  delete = async (id: string) => {
    const resource = await (prisma as any).resource.findUnique({ where: { id } });
    if (!resource) return false;
    await deleteObject(resource.storedPath);
    await (prisma as any).resource.delete({ where: { id } });
    return true;
  };

  getDownloadStream = async (id: string) => {
    const resource = await (prisma as any).resource.findUnique({ where: { id } });
    if (!resource) return null;
    const stream = getStream(resource.storedPath);
    return { resource, stream };
  };
}

export const resourceService = new ResourceService();
