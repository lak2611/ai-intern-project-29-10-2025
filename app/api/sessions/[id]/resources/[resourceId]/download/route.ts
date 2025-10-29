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
