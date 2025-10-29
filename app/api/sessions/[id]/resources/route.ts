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

    const contentType = req.headers.get('content-type') || '';

    // Handle URL-based upload
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const url = body.url;
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
      }
      const created = await resourceService.createFromUrl(id, url);
      return NextResponse.json(created, { status: 201 });
    }

    // Handle file upload
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload resource';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
