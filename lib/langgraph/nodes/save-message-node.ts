import { prisma } from '../../prisma';
import type { AgentState } from '../agent-state';

/**
 * Node: Save Message
 * Persists user message and assistant response to database
 */
export async function saveMessageNode(state: AgentState): Promise<Partial<AgentState>> {
  try {
    // Get the last two messages (user query and assistant response)
    const messagesToSave = state.messages.slice(-2);

    if (messagesToSave.length === 0) {
      return {};
    }

    // Save each message
    for (const msg of messagesToSave) {
      // Check if message already exists (user message with images was already saved in agent service)
      const existing = await (prisma as any).message.findFirst({
        where: {
          sessionId: state.sessionId,
          role: msg.role,
          content: msg.content,
        },
      });

      if (!existing) {
        // Extract images from message if present
        const metadata = msg.images && msg.images.length > 0 ? { images: msg.images } : null;

        await (prisma as any).message.create({
          data: {
            sessionId: state.sessionId,
            role: msg.role,
            content: msg.content,
            metadata: metadata,
          },
        });
      }
    }

    // Update session timestamp
    await (prisma as any).session.update({
      where: { id: state.sessionId },
      data: { updatedAt: new Date() },
    });

    return {};
  } catch (error: any) {
    console.error('Error saving messages:', error);
    throw error;
  }
}
