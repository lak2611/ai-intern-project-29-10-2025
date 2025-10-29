import { NextResponse } from 'next/server';
import { sessionService } from '@/lib/session-service';
import { updateSessionSchema } from '@/lib/schemas/session';

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

export const DELETE = async (req: Request, { params }: RouteContext) => {
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
