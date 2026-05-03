import { describe, expect, it } from 'vitest';
import {
	createPulseClientMediaIntent,
	mediaIntentToAttachment,
	parsePulseClientMediaIntent,
	summarizePulseClientMediaIntent,
} from '../src/media';

describe('pulse client media intent helpers', () => {
	it('serializes private staged media as a policy-held attachment', () => {
		const intent = createPulseClientMediaIntent({
			id: 'media_7',
			privateObjectKey: 'pulse/client/drafts/media_7/original.jpg',
			lifecycle: 'private_object_staged',
		});

		expect(mediaIntentToAttachment(intent)).toEqual({
			id: 'media_7',
			mimeType: 'image/jpeg',
			altText: 'Northern Cardinal perched near Cayuga Lake',
			privateObjectKey: 'pulse/client/drafts/media_7/original.jpg',
			publicUrl: '',
		});
	});

	it('serializes public-ready derivatives without private object keys', () => {
		const intent = createPulseClientMediaIntent({
			id: 'media_public',
			lifecycle: 'public_projection_ready',
			publicUrl: 'https://example.test/pulse/media/media_public.jpg',
			privateObjectKey: 'pulse/client/private/media_public.jpg',
		});

		expect(mediaIntentToAttachment(intent)).toMatchObject({
			id: 'media_public',
			privateObjectKey: '',
			publicUrl: 'https://example.test/pulse/media/media_public.jpg',
		});
	});

	it('rejects unsupported media intent before broker preview', () => {
		const intent = createPulseClientMediaIntent({
			lifecycle: 'unsupported',
			mimeType: 'audio/wav',
		});

		expect(summarizePulseClientMediaIntent(intent)).toContain('media type unsupported for public projection');
		expect(mediaIntentToAttachment(intent)).toEqual({
			errors: ['media type unsupported for public projection'],
		});
	});

	it('parses persisted media intent state strictly', () => {
		const parsed = parsePulseClientMediaIntent({
			id: 'media_8',
			filename: 'demo.jpg',
			mimeType: 'image/jpeg',
			altText: 'Demo image',
			lifecycle: 'exif_stripped',
			privateObjectKey: 'pulse/client/drafts/media_8/demo.jpg',
			publicUrl: '',
		});

		expect(parsed?.lifecycle).toBe('exif_stripped');
		expect(parsePulseClientMediaIntent({ ...parsed, lifecycle: 'unknown' })).toBeNull();
	});
});
