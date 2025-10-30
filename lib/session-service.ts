import { prisma } from './prisma';
import { createSessionSchema, updateSessionSchema, type CreateSessionInput, type UpdateSessionInput } from './schemas/session';
import { checkpointer } from './langgraph/checkpointer';

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

    // Delete the session from Prisma
    const deletedSession = await prisma.session.delete({ where: { id } });

    // Delete associated checkpoint thread data
    // SessionId is used as thread_id in LangGraph checkpointer
    try {
      await checkpointer.deleteThread(id);
    } catch (error) {
      // Log error but don't fail the deletion if checkpoint doesn't exist
      console.error(`Error deleting checkpoint thread for session ${id}:`, error);
      // Continue with session deletion even if checkpoint deletion fails
    }

    return deletedSession;
  };
}

export const sessionService = new SessionService();
