import { prisma } from './prisma';
import { createMessageSchema, type CreateMessageInput } from './schemas/message';

class MessageService {
  listBySession = async (sessionId: string) => {
    return (prisma as any).message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  };

  getById = async (id: string) => {
    return (prisma as any).message.findUnique({ where: { id } });
  };

  create = async (input: CreateMessageInput) => {
    const parsed = createMessageSchema.parse(input);
    return (prisma as any).message.create({
      data: {
        sessionId: parsed.sessionId,
        role: parsed.role,
        content: parsed.content,
        metadata: parsed.metadata || null,
      },
    });
  };

  delete = async (id: string) => {
    return (prisma as any).message.delete({ where: { id } });
  };

  deleteBySession = async (sessionId: string) => {
    return (prisma as any).message.deleteMany({ where: { sessionId } });
  };
}

export const messageService = new MessageService();
