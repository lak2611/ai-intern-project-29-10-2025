import { messageService } from '@/lib/message-service';
import { sessionService } from '@/lib/session-service';
import { NextResponse } from 'next/server';

type RouteParams = { id: string };
type RouteContext = { params: Promise<RouteParams> };

/**
 * GET /api/sessions/[id]/messages
 * Get all messages for a session
 */
export const GET = async (_req: Request, { params }: RouteContext) => {
  try {
    const { id } = await params;

    // Validate session exists
    const session = await sessionService.getById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = await messageService.listBySession(id);
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
};
