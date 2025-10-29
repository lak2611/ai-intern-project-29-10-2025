# CSV Resources

## Overview

Resources are files (currently CSVs) uploaded and attached to a `Session`. They are stored on disk and indexed in the database. APIs allow listing per session, uploading, deleting, and downloading.

## Data Model

```10:16:prisma/schema.prisma
model Session {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  resources Resource[]
}
```

```19:32:prisma/schema.prisma
model Resource {
  id           String   @id @default(cuid())
  sessionId    String
  originalName String
  storedPath   String   @unique
  mimeType     String
  sizeBytes    Int
  createdAt    DateTime @default(now())

  // Relations
  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}
```

- **Resource.originalName**: Original filename as provided by the client.
- **Resource.storedPath**: Absolute path on disk where file is saved.
- **Resource.mimeType**: Allowed subset of CSV-like types.
- **Resource.sizeBytes**: File size in bytes.
- On session deletion, resources cascade delete.

## Validation (Zod)

```1:12:lib/schemas/resource.ts
import { z } from 'zod';

export const allowedCsvMimeTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'] as const;

export const createResourceFromUploadSchema = z.object({
  sessionId: z.string().min(1),
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(allowedCsvMimeTypes),
  sizeBytes: z.number().int().nonnegative(),
});

export type CreateResourceFromUploadInput = z.infer<typeof createResourceFromUploadSchema>;
```

- Uploads are validated for `sessionId`, `originalName`, `mimeType`, and `sizeBytes`.

## Service Layer

```5:12:lib/resource-service.ts
class ResourceService {
  listBySession = async (sessionId: string) => {
    return (prisma as any).resource.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
  };

  getById = async (id: string) => {
    return (prisma as any).resource.findUnique({ where: { id } });
  };
```

```14:43:lib/resource-service.ts
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
```

```45:58:lib/resource-service.ts
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
```

- Handles disk IO via storage helpers, and DB persistence via Prisma.

## Storage (Disk)

```5:13:lib/storage/disk.ts
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

export type PutObjectArgs = {
  sessionId: string;
  originalName: string;
  mimeType: string;
  data: Uint8Array;
};
```

```14:33:lib/storage/disk.ts
export const ensureUploadsDir = () => {
  const dir = path.join(UPLOADS_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const buildStoredPath = (sessionId: string, originalName: string) => {
  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeName) || '.csv';
  const key = `${sessionId}/${randomUUID()}${ext}`;
  return path.join(UPLOADS_DIR, key);
};

export const putObject = async ({ sessionId, originalName, data }: PutObjectArgs) => {
  ensureUploadsDir();
  const storedPath = buildStoredPath(sessionId, originalName);
  const dir = path.dirname(storedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(storedPath, data as Uint8Array);
  return { storedPath };
};
```

## API Routes (Next.js Route Handlers)

### List and Upload: `GET /api/sessions/[id]/resources`, `POST /api/sessions/[id]/resources`

```1:51:app/api/sessions/[id]/resources/route.ts
import { NextResponse } from 'next/server';
import { resourceService } from '@/lib/resource-service';
import { sessionService } from '@/lib/session-service';

type RouteParams = { id: string };
type RouteContext = { params: Promise<RouteParams> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (_req: Request, { params }: RouteContext) => {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const session = await sessionService.getById(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const resources = await resourceService.listBySession(id);
    return NextResponse.json(resources);
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
};

export const POST = async (req: Request, { params }: RouteContext) => {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const session = await sessionService.getById(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (file.size > Number(process.env.UPLOAD_MAX_BYTES || 20 * 1024 * 1024)) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const created = await resourceService.createFromUpload(id, file);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in (error as any)) {
      return NextResponse.json({ error: 'Validation error', details: (error as any).issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to upload resource' }, { status: 500 });
  }
};
```

### Delete: `DELETE /api/sessions/[id]/resources/[resourceId]`

```1:24:app/api/sessions/[id]/resources/[resourceId]/route.ts
import { NextResponse } from 'next/server';
import { resourceService } from '@/lib/resource-service';

type RouteParams = { id: string; resourceId: string };
type RouteContext = { params: Promise<RouteParams> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = async (_req: Request, { params }: RouteContext) => {
  try {
    const { id, resourceId } = await params;
    if (!id || !resourceId) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
    const resource = await resourceService.getById(resourceId);
    if (!resource || resource.sessionId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await resourceService.delete(resourceId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
};
```

### Download: `GET /api/sessions/[id]/resources/[resourceId]/download`

```1:28:app/api/sessions/[id]/resources/[resourceId]/download/route.ts
import { NextResponse } from 'next/server';
import { resourceService } from '@/lib/resource-service';

type RouteParams = { id: string; resourceId: string };
type RouteContext = { params: Promise<RouteParams> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (_req: Request, { params }: RouteContext) => {
  try {
    const { id, resourceId } = await params;
    if (!id || !resourceId) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
    const result = await resourceService.getDownloadStream(resourceId);
    if (!result || result.resource.sessionId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { resource, stream } = result;
    const headers = new Headers();
    headers.set('Content-Type', resource.mimeType || 'text/csv');
    headers.set('Content-Disposition', `attachment; filename="${resource.originalName}"`);
    // @ts-ignore - Next.js will accept Node streams in Response in Node runtime
    return new Response(stream as any, { headers });
  } catch {
    return NextResponse.json({ error: 'Failed to download resource' }, { status: 500 });
  }
};
```

## Example Requests

- List resources for a session

```bash
curl -s -X GET http://localhost:3000/api/sessions/<sessionId>/resources | jq
```

- Upload a CSV to a session

```bash
curl -s -X POST http://localhost:3000/api/sessions/<sessionId>/resources \
  -H 'Content-Type: multipart/form-data' \
  -F "file=@/path/to/data.csv" | jq
```

- Delete a resource

```bash
curl -s -X DELETE http://localhost:3000/api/sessions/<sessionId>/resources/<resourceId> | jq
```

- Download a resource

```bash
curl -L -o data.csv \
  http://localhost:3000/api/sessions/<sessionId>/resources/<resourceId>/download
```

## Notes and Behavior

- `POST /resources` expects `multipart/form-data` with field `file`.
- Max upload size defaults to 20MB; override with `UPLOAD_MAX_BYTES` env.
- Files are stored under `uploads/<sessionId>/<uuid>.csv` by default or `UPLOADS_DIR` if set.
- Deleting a resource removes both the DB record and its file on disk.
- Download sets appropriate `Content-Type` and `Content-Disposition` for the original filename.
