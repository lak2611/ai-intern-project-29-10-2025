import { z } from 'zod';

/**
 * Allowed image MIME types for uploads
 */
export const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * Schema for a single image
 */
export const imageSchema = z.object({
  data: z.string().min(1, 'Image data is required'),
  mimeType: z.enum(allowedImageMimeTypes, {
    errorMap: () => ({ message: 'Invalid image MIME type. Allowed: image/jpeg, image/png, image/webp, image/gif' }),
  }),
  originalName: z.string().min(1).max(255),
});

/**
 * Schema for creating a message with optional images
 */
export const createMessageWithImagesSchema = z
  .object({
    content: z.string(),
    images: z.array(imageSchema).max(10, 'Maximum 10 images per message').optional(),
  })
  .refine(
    (data) => {
      // Either content or images must be provided
      return data.content.trim().length > 0 || (data.images && data.images.length > 0);
    },
    {
      message: 'Either message content or images must be provided',
      path: ['content'],
    }
  )
  .refine(
    (data) => {
      if (!data.images) return true;
      // Validate total size (4MB per image * 10 = 40MB max, but limit to 20MB total)
      const maxSizePerImage = 4 * 1024 * 1024; // 4MB
      const maxTotalSize = 20 * 1024 * 1024; // 20MB
      let totalSize = 0;
      for (const img of data.images) {
        // Base64 decoded size is approximately 3/4 of encoded size
        const decodedSize = (img.data.length * 3) / 4;
        if (decodedSize > maxSizePerImage) return false;
        totalSize += decodedSize;
      }
      return totalSize <= maxTotalSize;
    },
    {
      message: 'Images exceed size limits. Max 4MB per image, 20MB total per message.',
      path: ['images'],
    }
  );

export type CreateMessageWithImagesInput = z.infer<typeof createMessageWithImagesSchema>;
export type ImageInput = z.infer<typeof imageSchema>;
