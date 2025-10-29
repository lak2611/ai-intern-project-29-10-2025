import { NextResponse } from 'next/server';
import { langGraphAgentService } from '@/lib/langgraph-agent-service';
import { sessionService } from '@/lib/session-service';
import { createMessageWithImagesSchema } from '@/lib/schemas/message-with-images';

type RouteParams = { id: string };
type RouteContext = { params: Promise<RouteParams> };

/**
 * POST /api/sessions/[id]/messages/stream
 * Stream agent response using Server-Sent Events
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Validate session exists
    const session = await sessionService.getById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const parsed = createMessageWithImagesSchema.parse(body);

    // Store images in metadata if provided
    const metadata = parsed.images && parsed.images.length > 0 ? { images: parsed.images } : undefined;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Stream the agent response with images
          for await (const chunk of langGraphAgentService.streamAgent(id, parsed.content, metadata?.images)) {
            const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            console.log('🚀 ~ POST ~ data:', data);
            controller.enqueue(encoder.encode(data));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.log('🚀 ~ POST ~ error:', error);
          const errorData = `data: ${JSON.stringify({ error: error.message || 'Failed to stream response' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error streaming message:', error);

    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Validation error', details: (error as any).issues }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Failed to stream message' }, { status: 500 });
  }
}
