import type { MediaAttachment } from '@blog/pulse-core/schema';

export const PULSE_CLIENT_MEDIA_LIFECYCLES = [
	'upload_intent',
	'private_object_staged',
	'exif_stripped',
	'derivative_ready',
	'public_projection_ready',
	'unsupported',
] as const;

export type PulseClientMediaLifecycle = (typeof PULSE_CLIENT_MEDIA_LIFECYCLES)[number];

export interface PulseClientMediaIntent {
	readonly id: string;
	readonly filename: string;
	readonly mimeType: string;
	readonly altText: string;
	readonly lifecycle: PulseClientMediaLifecycle;
	readonly privateObjectKey: string;
	readonly publicUrl: string;
}

export const PULSE_CLIENT_DEFAULT_MEDIA_INTENT: PulseClientMediaIntent = {
	id: 'media_1',
	filename: 'cardinal-demo.jpg',
	mimeType: 'image/jpeg',
	altText: 'Northern Cardinal perched near Cayuga Lake',
	lifecycle: 'private_object_staged',
	privateObjectKey: 'pulse/client/drafts/media_1/cardinal-demo-original.jpg',
	publicUrl: '',
};

const lifecycleValues = new Set<PulseClientMediaLifecycle>(PULSE_CLIENT_MEDIA_LIFECYCLES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

export const createPulseClientMediaIntent = (input: Partial<PulseClientMediaIntent> = {}): PulseClientMediaIntent => ({
	id: input.id ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.id,
	filename: input.filename ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.filename,
	mimeType: input.mimeType ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.mimeType,
	altText: input.altText ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.altText,
	lifecycle: input.lifecycle ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.lifecycle,
	privateObjectKey: input.privateObjectKey ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.privateObjectKey,
	publicUrl: input.publicUrl ?? PULSE_CLIENT_DEFAULT_MEDIA_INTENT.publicUrl,
});

export const normalizePulseClientMediaIntent = (intent: PulseClientMediaIntent): PulseClientMediaIntent => ({
	id: intent.id.trim(),
	filename: intent.filename.trim(),
	mimeType: intent.mimeType.trim(),
	altText: intent.altText.trim(),
	lifecycle: intent.lifecycle,
	privateObjectKey: intent.privateObjectKey.trim(),
	publicUrl: intent.publicUrl.trim(),
});

export const mediaLifecycleLabel = (lifecycle: PulseClientMediaLifecycle): string => {
	switch (lifecycle) {
		case 'upload_intent':
			return 'upload intent';
		case 'private_object_staged':
			return 'private object staged';
		case 'exif_stripped':
			return 'EXIF stripped';
		case 'derivative_ready':
			return 'derivative ready';
		case 'public_projection_ready':
			return 'public projection ready';
		case 'unsupported':
			return 'unsupported';
	}
};

export const isMediaIntentPublicProjectable = (intent: PulseClientMediaIntent): boolean =>
	intent.lifecycle === 'public_projection_ready';

export const summarizePulseClientMediaIntent = (intent: PulseClientMediaIntent): readonly string[] => {
	const normalized = normalizePulseClientMediaIntent(intent);
	const errors: string[] = [];

	if (normalized.id.length === 0) errors.push('media id missing');
	if (normalized.filename.length === 0) errors.push('media filename missing');
	if (normalized.mimeType.length === 0) errors.push('media MIME type missing');
	if (normalized.altText.length === 0) errors.push('media alt text missing');
	if (normalized.lifecycle === 'unsupported') errors.push('media type unsupported for public projection');

	if (isMediaIntentPublicProjectable(normalized)) {
		if (normalized.publicUrl.length === 0) errors.push('media public URL missing');
	} else if (normalized.lifecycle !== 'unsupported' && normalized.privateObjectKey.length === 0) {
		errors.push('media private object key missing');
	}

	return errors;
};

export const mediaIntentToAttachment = (
	intent: PulseClientMediaIntent,
): MediaAttachment | { readonly errors: readonly string[] } => {
	const errors = summarizePulseClientMediaIntent(intent);
	if (errors.length > 0) return { errors };

	const normalized = normalizePulseClientMediaIntent(intent);
	const publicProjectable = isMediaIntentPublicProjectable(normalized);

	return {
		id: normalized.id,
		mimeType: normalized.mimeType,
		altText: normalized.altText,
		privateObjectKey: publicProjectable ? '' : normalized.privateObjectKey,
		publicUrl: publicProjectable ? normalized.publicUrl : '',
	};
};

export const parsePulseClientMediaIntent = (value: unknown): PulseClientMediaIntent | null => {
	if (!isRecord(value)) return null;
	if (!isString(value.id)) return null;
	if (!isString(value.filename)) return null;
	if (!isString(value.mimeType)) return null;
	if (!isString(value.altText)) return null;
	if (!isString(value.lifecycle) || !lifecycleValues.has(value.lifecycle as PulseClientMediaLifecycle)) return null;
	if (!isString(value.privateObjectKey)) return null;
	if (!isString(value.publicUrl)) return null;

	return createPulseClientMediaIntent({
		id: value.id,
		filename: value.filename,
		mimeType: value.mimeType,
		altText: value.altText,
		lifecycle: value.lifecycle as PulseClientMediaLifecycle,
		privateObjectKey: value.privateObjectKey,
		publicUrl: value.publicUrl,
	});
};
