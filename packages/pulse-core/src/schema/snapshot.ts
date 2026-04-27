import { z } from 'zod';
import { IsoTimestampSchema } from './event.js';

export const PUBLIC_SNAPSHOT_SCHEMA_VERSION = 'tinyland.pulse.v1.PublicPulseSnapshot';
export const PUBLIC_SNAPSHOT_POLICY_VERSION = 'm1-2026-04-27';

export const PublicBirdSightingSchema = z
	.object({
		commonName: z.string(),
		scientificName: z.string(),
		count: z.number().int().min(1),
		placeLabel: z.string(),
	})
	.strict();

export type PublicBirdSighting = z.infer<typeof PublicBirdSightingSchema>;

export const PublicPulseItemSchema = z
	.object({
		id: z.string().min(1),
		kind: z.enum(['note', 'bird_sighting']),
		occurredAt: IsoTimestampSchema,
		summary: z.string(),
		content: z.string(),
		tags: z.array(z.string().min(1)),
		birdSighting: PublicBirdSightingSchema.optional(),
	})
	.strict()
	.refine((item) => (item.kind === 'bird_sighting' ? item.birdSighting !== undefined : true), {
		message: 'bird_sighting items must include birdSighting',
	})
	.refine((item) => (item.kind === 'note' ? item.birdSighting === undefined : true), {
		message: 'note items must not include birdSighting',
	});

export type PublicPulseItem = z.infer<typeof PublicPulseItemSchema>;

export const PublicPulseManifestSchema = z
	.object({
		schemaVersion: z.literal(PUBLIC_SNAPSHOT_SCHEMA_VERSION),
		generatedAt: IsoTimestampSchema,
		sourceSnapshotId: z.string(),
		contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
		itemCount: z.number().int().min(0),
		policyVersion: z.string().min(1),
	})
	.strict();

export type PublicPulseManifest = z.infer<typeof PublicPulseManifestSchema>;

export const PublicPulseSnapshotSchema = z
	.object({
		schemaVersion: z.literal(PUBLIC_SNAPSHOT_SCHEMA_VERSION),
		generatedAt: IsoTimestampSchema,
		items: z.array(PublicPulseItemSchema),
		manifest: PublicPulseManifestSchema,
	})
	.strict()
	.refine((snap) => snap.items.length === snap.manifest.itemCount, {
		message: 'manifest.itemCount must match items.length',
	})
	.refine((snap) => snap.schemaVersion === snap.manifest.schemaVersion, {
		message: 'snapshot and manifest schemaVersion must match',
	});

export type PublicPulseSnapshot = z.infer<typeof PublicPulseSnapshotSchema>;
