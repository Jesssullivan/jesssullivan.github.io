import { z } from 'zod';
import { PlaceSchema } from './place.js';

export const PAYLOAD_KINDS = [
	'note',
	'bird_sighting',
	'photo',
	'git_summary',
	'listening',
] as const;

export type PayloadKind = (typeof PAYLOAD_KINDS)[number];

// Inner option schemas MUST be plain ZodObjects so z.discriminatedUnion can
// inspect the literal discriminator. Cross-field rules (e.g. "bird sighting
// has at least one name") live in a superRefine on the union.

export const NotePayloadSchema = z
	.object({
		kind: z.literal('note'),
		text: z
			.string()
			.refine((s) => s.trim().length > 0, { message: 'note text must not be empty' })
			.refine((s) => s.length <= 2000, { message: 'note text exceeds 2000 char limit' }),
	})
	.strict();

export type NotePayload = z.infer<typeof NotePayloadSchema>;

export const BirdSightingPayloadSchema = z
	.object({
		kind: z.literal('bird_sighting'),
		commonName: z.string(),
		scientificName: z.string(),
		count: z.number().int().min(1),
		place: PlaceSchema.optional(),
		observationId: z.string(),
	})
	.strict();

export type BirdSightingPayload = z.infer<typeof BirdSightingPayloadSchema>;

export const PhotoPayloadSchema = z
	.object({
		kind: z.literal('photo'),
		caption: z.string(),
	})
	.strict();

export type PhotoPayload = z.infer<typeof PhotoPayloadSchema>;

export const GitSummaryPayloadSchema = z
	.object({
		kind: z.literal('git_summary'),
		repository: z.string().min(1),
		summary: z.string().min(1),
	})
	.strict();

export type GitSummaryPayload = z.infer<typeof GitSummaryPayloadSchema>;

export const ListeningPayloadSchema = z
	.object({
		kind: z.literal('listening'),
		title: z.string().min(1),
		artist: z.string(),
		album: z.string(),
		externalUrl: z.string(),
	})
	.strict();

export type ListeningPayload = z.infer<typeof ListeningPayloadSchema>;

export const PayloadSchema = z
	.discriminatedUnion('kind', [
		NotePayloadSchema,
		BirdSightingPayloadSchema,
		PhotoPayloadSchema,
		GitSummaryPayloadSchema,
		ListeningPayloadSchema,
	])
	.superRefine((payload, ctx) => {
		if (
			payload.kind === 'bird_sighting' &&
			payload.commonName.trim().length === 0 &&
			payload.scientificName.trim().length === 0
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'bird sighting must have at least one of commonName or scientificName',
				path: ['commonName'],
			});
		}
	});

export type Payload = z.infer<typeof PayloadSchema>;

// M1 allowlist for public projection. Anything outside this set is rejected
// by the policy engine before it can land in a PublicPulseSnapshot.
export const M1_PUBLIC_PAYLOAD_KINDS = ['note', 'bird_sighting'] as const satisfies readonly PayloadKind[];
