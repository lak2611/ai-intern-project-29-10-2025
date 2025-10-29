import { prisma } from './prisma';
import { createResourceFromUploadSchema, allowedCsvMimeTypes } from './schemas/resource';
import { deleteObject, getStream, putObject } from './storage/disk';

class ResourceService {
  listBySession = async (sessionId: string) => {
    return (prisma as any).resource.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
  };

  getById = async (id: string) => {
    return (prisma as any).resource.findUnique({ where: { id } });
  };

  createFromUpload = async (sessionId: string, file: File) => {
    if (!sessionId) throw new Error('sessionId is required');
    if (!file) throw new Error('file is required');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const originalName = file.name || 'upload.csv';
    const mimeType = (file.type || 'text/csv') as (typeof allowedCsvMimeTypes)[number] | string;
    const sizeBytes = buffer.byteLength;

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
      throw new Error('File too large');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.byteLength > maxSize) {
      throw new Error('File too large');
    }

    // Extract filename from URL or use default
    const urlPath = parsedUrl.pathname;
    const originalName = urlPath.split('/').pop() || 'download.csv';
    const fileName = originalName.endsWith('.csv') ? originalName : `${originalName.split('.')[0] || 'download'}.csv`;

    const mimeType = (allowedCsvMimeTypes.includes(contentType as any) ? contentType : 'text/csv') as (typeof allowedCsvMimeTypes)[number] | string;

    const parsed = createResourceFromUploadSchema.parse({
      sessionId,
      originalName: fileName,
      mimeType: (allowedCsvMimeTypes.includes(mimeType as any) ? mimeType : 'text/csv') as any,
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
