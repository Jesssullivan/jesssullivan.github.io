import { z } from 'zod';

export const MediaAttachmentSchema = z
	.object({
		id: z.string().min(1),
		mimeType: z.string().min(1),
		altText: z.string(),
		privateObjectKey: z.string(),
		publicUrl: z.string(),
	})
	.strict();

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;
