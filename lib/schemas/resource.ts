import { z } from 'zod';

export const allowedCsvMimeTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'] as const;

export const createResourceFromUploadSchema = z.object({
  sessionId: z.string().min(1),
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(allowedCsvMimeTypes),
  sizeBytes: z.number().int().nonnegative(),
});

export type CreateResourceFromUploadInput = z.infer<typeof createResourceFromUploadSchema>;
