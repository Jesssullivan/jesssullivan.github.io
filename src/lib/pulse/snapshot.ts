import { z } from 'zod';
import {
	PublicPulseSnapshotSchema,
	type PublicPulseItem,
	type PublicPulseSnapshot,
} from '@blog/pulse-core/schema';

export const PULSE_V2_SNAPSHOT_SCHEMA_VERSION = 'tinyland.pulse.v2.PublicPulseSnapshot';

const MEDIA_ORIGIN = 'https://hub.tinyland.dev';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
const LEAD_IMAGE_SOURCES = [
	'metadata-image',
	'metadata-feature-image',
	'metadata-thumbnail-image',
	'markdown-image',
] as const;
const MEDIA_EXTENSIONS: Record<(typeof IMAGE_TYPES)[number], readonly string[]> = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'image/webp': ['.webp'],
	'image/avif': ['.avif'],
	'image/gif': ['.gif'],
};

const IsoTimestampSchema = z.string().datetime({ offset: true });

function isPublicPreviewUrl(value: string, mediaType: (typeof IMAGE_TYPES)[number]): boolean {
	try {
		const url = new URL(value);
		return (
			url.origin === MEDIA_ORIGIN &&
			url.username === '' &&
			url.password === '' &&
			url.search === '' &&
			url.hash === '' &&
			/^\/(?:media|images)\/.+\.preview\.[^/]+$/i.test(url.pathname) &&
			MEDIA_EXTENSIONS[mediaType].some((extension) => url.pathname.toLowerCase().endsWith(extension))
		);
	} catch {
		return false;
	}
}

const PublicPulseLeadImageSchema = z
	.object({
		alt: z.string().trim().min(1).max(500),
		mediaType: z.enum(IMAGE_TYPES),
		preview: z
			.object({
				url: z.string().url(),
				width: z.number().int().positive(),
				height: z.number().int().positive(),
			})
			.strict(),
		provenance: z
			.object({
				sourceAuthority: z.literal('tinyland.dev'),
				parentHandle: z.literal('jesssullivan'),
				parentContentKind: z.literal('notes'),
				parentSlug: z.string().trim().min(1),
				source: z.enum(LEAD_IMAGE_SOURCES),
				lifecycle: z
					.object({
						policyVersion: z.literal('m1-2026-05-18'),
						ttlSeconds: z.number().int().positive(),
						orphanGcGraceSeconds: z.number().int().positive(),
						expiresAt: IsoTimestampSchema,
						orphanGcAt: IsoTimestampSchema,
					})
					.strict(),
				lifecyclePolicy: z.literal(
					'pulse-media-lifecycle-strip-derivatives-orphan-gc-public-launch-gated',
				),
				exifStripStatus: z.literal('broker-strips-exif-on-derivative-mint'),
			})
			.strict(),
	})
	.strict()
	.superRefine((image, context) => {
		if (!isPublicPreviewUrl(image.preview.url, image.mediaType)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['preview', 'url'],
				message: 'lead image preview must be a Tinyland minted preview derivative',
			});
		}
	});

export type PublicPulseLeadImage = z.infer<typeof PublicPulseLeadImageSchema>;

const PublicPulseV2ItemSchema = z
	.object({
		id: z.string().min(1),
		kind: z.enum(['note', 'bird_sighting']),
		occurredAt: IsoTimestampSchema,
		summary: z.string(),
		content: z.string(),
		tags: z.array(z.string().min(1)),
		salience: z.enum(['less-noteworthy', 'noteworthy']).optional(),
		birdSighting: z
			.object({
				commonName: z.string(),
				scientificName: z.string(),
				count: z.number().int().min(1),
				placeLabel: z.string(),
			})
			.strict()
			.optional(),
		leadImage: PublicPulseLeadImageSchema.optional(),
	})
	.strict()
	.superRefine((item, context) => {
		if (item.kind === 'note' && item.birdSighting !== undefined) {
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['birdSighting'], message: 'notes must not include birdSighting' });
		}
		if (item.kind === 'bird_sighting' && item.birdSighting === undefined) {
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['birdSighting'], message: 'bird sightings require birdSighting' });
		}
		if (item.kind !== 'note' && item.leadImage !== undefined) {
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['leadImage'], message: 'only notes may include a lead image' });
		}
	});

export type PublicPulseV2Item = z.infer<typeof PublicPulseV2ItemSchema>;

const PublicPulseV2SnapshotSchema = z
	.object({
		schemaVersion: z.literal(PULSE_V2_SNAPSHOT_SCHEMA_VERSION),
		generatedAt: IsoTimestampSchema,
		items: z.array(PublicPulseV2ItemSchema),
		manifest: z
			.object({
				schemaVersion: z.literal(PULSE_V2_SNAPSHOT_SCHEMA_VERSION),
				generatedAt: IsoTimestampSchema,
				sourceSnapshotId: z.string(),
				contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
				itemCount: z.number().int().min(0),
				policyVersion: z.string().min(1),
			})
			.strict(),
	})
	.strict()
	.superRefine((snapshot, context) => {
		if (snapshot.items.length !== snapshot.manifest.itemCount) {
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['manifest', 'itemCount'], message: 'manifest.itemCount must match items.length' });
		}
	});

export type PublicPulseSnapshotV2 = z.infer<typeof PublicPulseV2SnapshotSchema>;
export type PublicPulseSnapshotAny = PublicPulseSnapshot | PublicPulseSnapshotV2;
export type PublicPulseItemAny = PublicPulseItem | PublicPulseV2Item;

export function parsePublicPulseSnapshot(data: unknown): PublicPulseSnapshotAny {
	const version = typeof data === 'object' && data !== null ? (data as { schemaVersion?: unknown }).schemaVersion : undefined;
	if (version === PULSE_V2_SNAPSHOT_SCHEMA_VERSION) return PublicPulseV2SnapshotSchema.parse(data);
	return PublicPulseSnapshotSchema.parse(data);
}

export function hasLeadImage(item: PublicPulseItemAny): item is PublicPulseV2Item & { leadImage: PublicPulseLeadImage } {
	return 'leadImage' in item && item.leadImage !== undefined;
}
