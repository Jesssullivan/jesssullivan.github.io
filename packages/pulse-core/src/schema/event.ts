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

// Editorial salience is a DISPLAY / RANKING-ONLY hint that mirrors the blog
// editorial taxonomy (docs/blog-editorial-taxonomy-2026-07-03.md). It is never
// an authorization gate and never an ActivityPub-delivery signal (ruling
// 2026-07-05). An absent salience means "untiered" and ranks as the least
// prominent tier.
export const SALIENCE_VALUES = ['less-noteworthy', 'noteworthy'] as const;

export const SalienceSchema = z.enum(SALIENCE_VALUES);

export type Salience = z.infer<typeof SalienceSchema>;

// Prominence rank used purely as a stable secondary sort key: higher ranks
// sort earlier. `noteworthy` > `less-noteworthy` > untiered (absent). This
// MUST NOT influence policy allow/deny or delivery.
export const salienceRank = (salience: Salience | undefined): number =>
	salience === 'noteworthy' ? 2 : salience === 'less-noteworthy' ? 1 : 0;

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
		// Optional display/ranking tier. Absent = untiered = least prominent.
		// Backward-compatible: fixtures without this field still validate.
		salience: SalienceSchema.optional(),
	})
	.strict();

export type PulseEvent = z.infer<typeof PulseEventSchema>;
