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
