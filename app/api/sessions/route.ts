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

export const POST = async (req: Request) => {
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
  }
};
