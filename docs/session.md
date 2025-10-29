# Session Concept

## Overview

A Session represents a named chat or interaction thread within the app. Sessions are persisted in the database via Prisma and exposed through RESTful Next.js Route Handlers for creation, listing, retrieval, update, and deletion. Validation is enforced with Zod.

## Data Model

```1:15:prisma/schema.prisma
model Session {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- **id**: Globally unique `cuid()` string.
- **name**: Human-readable session name (1–200 chars).
- **createdAt / updatedAt**: Timestamps managed by Prisma.

## Validation (Zod)

```1:12:lib/schemas/session.ts
import { z } from 'zod';

export const createSessionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
});

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
```

- Create requires `name`.
- Update allows partial updates; currently only `name`.

## Service Layer

```1:31:lib/session-service.ts
import { prisma } from './prisma';
import { createSessionSchema, updateSessionSchema, type CreateSessionInput, type UpdateSessionInput } from './schemas/session';

class SessionService {
  list = async () => {
    return prisma.session.findMany({ orderBy: { createdAt: 'desc' } });
  };

  getById = async (id: string) => {
    return prisma.session.findUnique({ where: { id } });
  };

  create = async (input: CreateSessionInput) => {
    const parsed = createSessionSchema.parse(input);
    return prisma.session.create({ data: { name: parsed.name } });
  };

  update = async (id: string, input: UpdateSessionInput) => {
    const parsed = updateSessionSchema.parse(input);
    return prisma.session.update({ where: { id }, data: parsed });
  };

  delete = async (id: string) => {
    if (!id) {
      throw new Error('id is required');
    }
    return prisma.session.delete({ where: { id } });
  };
}

export const sessionService = new SessionService();
```

- Centralizes all DB access and validation parsing.
- Returns plain Prisma entities, ready for API responses.

## API Routes (Next.js Route Handlers)

### List and Create: `GET /api/sessions`, `POST /api/sessions`

```1:26:app/api/sessions/route.ts
import { NextResponse } from 'next/server';
import { sessionService } from '@/lib/session-service';
import { createSessionSchema } from '@/lib/schemas/session';

export const GET = async () => {
  try {
    const sessions = await sessionService.list();
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
};

export const POST = async (req: Request) =>
  try {
    const body = await req.json();
    const parsed = createSessionSchema.parse(body);
    const session = await sessionService.create(parsed);
    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in (error as any)) {
      return NextResponse.json({ error: 'Validation error', details: (error as any).issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  };
```

- `GET` returns sessions ordered by `createdAt desc`.
- `POST` validates input and returns the created session.

### Get, Update, Delete by ID: `/api/sessions/[id]`

```5:45:app/api/sessions/[id]/route.ts
type RouteParams = { id: string };
type RouteContext = { params: Promise<RouteParams> };

export const GET = async (_req: Request, { params }: RouteContext) => {
  try {
    const { id } = await params;
    const session = await sessionService.getById(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
};

export const PATCH = async (req: Request, { params }: RouteContext) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSessionSchema.parse(body);
    const session = await sessionService.update(id, parsed);
    return NextResponse.json(session);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in (error as any)) {
      return NextResponse.json({ error: 'Validation error', details: (error as any).issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
};

export const DELETE = async (_req: Request, { params }: RouteContext) => {
  try {
    const awaited = await params;
    const id = awaited?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await sessionService.delete(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
};
```

- `GET` 404s when a session is not found.
- `PATCH` validates updates; returns 400 on Zod issues.
- `DELETE` returns `{ ok: true }` on success.

## Client Usage

The Sidebar consumes the API to list and create sessions.

```21:56:components/sidebar.tsx
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const created = await res.json();
      setSessions((prev) => [created, ...prev]);
      handleCloseDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };
```

- Disables caching when listing to ensure fresh data.
- Optimistically prepends created session to the list.

## Example Requests

- List sessions

```bash
curl -s -X GET http://localhost:3000/api/sessions | jq
```

- Create a session

```bash
curl -s -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{ "name": "New Chat" }' | jq
```

- Get a session by id

```bash
curl -s -X GET http://localhost:3000/api/sessions/<id> | jq
```

- Update a session name

```bash
curl -s -X PATCH http://localhost:3000/api/sessions/<id> \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Renamed Chat" }' | jq
```

- Delete a session

```bash
curl -s -X DELETE http://localhost:3000/api/sessions/<id> | jq
```

## Notes and Behavior

- All endpoints return JSON.
- Validation errors include `details` with Zod issues (400).
- Not found returns 404 (GET by id).
- Database is SQLite via Prisma; see `prisma/schema.prisma`.

## Resources

See CSV Resources documentation: `docs/csv-resources.md`.
