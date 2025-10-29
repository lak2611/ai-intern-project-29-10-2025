import { prisma } from './prisma';
import { createSessionSchema, updateSessionSchema, type CreateSessionInput, type UpdateSessionInput } from './schemas/session';

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
    return prisma.session.delete({ where: { id } });
  };
}

export const sessionService = new SessionService();
