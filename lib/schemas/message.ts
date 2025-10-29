import { z } from 'zod';

export const createMessageSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
