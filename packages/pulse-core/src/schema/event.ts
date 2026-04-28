import { z } from 'zod';
import { VisibilitySchema } from './visibility.js';
import { PayloadSchema } from './payload.js';
import { MediaAttachmentSchema } from './media.js';

export const SourceSchema = z
	.object({
		client: z.string().min(1),
		deviceId: z.string(),
		idempotencyKey: z.string().min(1),
	})
	.strict();

export type Source = z.infer<typeof SourceSchema>;

// ISO-8601 UTC timestamp. We keep the wire format string-shaped so ProtoJSON
// fixtures and the broker mock agree byte-for-byte.
export const IsoTimestampSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, {
		message: 'must be an ISO-8601 UTC timestamp ending in Z',
	});

export const PulseEventSchema = z
	.object({
		id: z.string().min(1),
		actor: z.string().min(1),
		occurredAt: IsoTimestampSchema,
		visibility: VisibilitySchema.refine((v) => v !== 'VISIBILITY_UNSPECIFIED', {
			message: 'visibility must be explicit',
		}),
		source: SourceSchema,
		tags: z.array(z.string().min(1)),
		media: z.array(MediaAttachmentSchema),
		revision: z.number().int().min(1),
		payload: PayloadSchema,
	})
	.strict();

export type PulseEvent = z.infer<typeof PulseEventSchema>;
