import type { PublicPulseSnapshotV2 } from '../snapshot';

// Test-only contract fixture. It is never copied to static/ or production routes.
export const reviewedLeadImageSnapshot: PublicPulseSnapshotV2 = {
	schemaVersion: 'tinyland.pulse.v2.PublicPulseSnapshot',
	generatedAt: '2026-09-22T12:00:00.000Z',
	items: [
		{
			id: 'tinyland-pulse-note-reviewed-lead-image',
			kind: 'note',
			occurredAt: '2026-09-22T11:30:00.000Z',
			summary: 'A reviewed lead image accompanies this public note.',
			content: 'The full public note remains readable before JavaScript.',
			tags: ['pulse', 'media'],
			leadImage: {
				alt: 'A tawny owl resting on a cedar branch',
				mediaType: 'image/webp',
				preview: {
					url: 'https://hub.tinyland.dev/media/pulse/jesssullivan/notes/reviewed-lead-image.preview.webp',
					width: 1280,
					height: 854,
				},
				provenance: {
					sourceAuthority: 'tinyland.dev',
					parentHandle: 'jesssullivan',
					parentContentKind: 'notes',
					parentSlug: 'reviewed-lead-image',
					source: 'metadata-feature-image',
					lifecycle: {
						policyVersion: 'm1-2026-05-18',
						ttlSeconds: 86400,
						orphanGcGraceSeconds: 604800,
						expiresAt: '2026-09-23T12:00:00.000Z',
						orphanGcAt: '2026-09-30T12:00:00.000Z',
					},
					lifecyclePolicy: 'pulse-media-lifecycle-strip-derivatives-orphan-gc-public-launch-gated',
					exifStripStatus: 'broker-strips-exif-on-derivative-mint',
				},
			},
		},
	],
	manifest: {
		schemaVersion: 'tinyland.pulse.v2.PublicPulseSnapshot',
		generatedAt: '2026-09-22T12:00:00.000Z',
		sourceSnapshotId: 'tinyland-jesssullivan-pulse-live-notes-test-fixture',
		contentHash: 'sha256:beae1a655e5fe71f7240ea84d64462bce22aed9f8277a4f94cfcb3185041c5cf',
		itemCount: 1,
		policyVersion: 'pulse-live-notes-v3-reviewed-lead-image-2026-09-22',
	},
};
