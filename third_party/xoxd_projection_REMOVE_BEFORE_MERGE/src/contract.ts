/**
 * The fixed values of the xoxd-projection/v2 contract: names, addresses, the
 * two targets, the media type tables and the TypeScript shapes of head.json,
 * the manifest and the public Document. A change to any value here needs a
 * new contract version.
 */

export const CONTRACT = 'xoxd-projection/v2';
export const CONTENT_SPEC = 'xoxd-content/v0';
export const HASH_RULE = 'canonical-v0';

/** One id or path segment. It never starts with a dot. */
export const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
/** A site path: one or more segments, each after a slash, with no trailing slash. */
export const PATH_PATTERN = /^(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)+$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const POST_KINDS = ['note', 'article', 'formal', 'announcement'] as const;
export const SITES = ['blog', 'firm'] as const;
export const BYLINES = ['owner', 'firm'] as const;
export const CHANNELS = [
	'site',
	'feed',
	'calendar',
	'bluesky',
	'youtube',
	'linkedin',
	'newsletter',
	'fediverse',
] as const;
export const ATTACHMENT_KINDS = ['pdf', 'tex', 'image', 'video', 'data'] as const;
export const VIDEO_HOSTS = ['youtube', 'file'] as const;
export const VISIBILITIES = ['private', 'unlisted', 'public'] as const;
export const VARIANT_TAGS = ['bluesky', 'youtube', 'linkedin', 'newsletter', 'fediverse'] as const;

export type PostKind = (typeof POST_KINDS)[number];
export type Site = (typeof SITES)[number];
export type Byline = (typeof BYLINES)[number];
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
export type VariantTag = (typeof VARIANT_TAGS)[number];

/** Collection keys in manifest order. */
export const COLLECTION_KEYS = POST_KINDS;

export interface TargetRow {
	readonly id: Site;
	readonly byline: Byline;
	readonly origin: string;
	/** The ActivityPub actor handle, or null when the target has none. */
	readonly actor: string | null;
}

/** The two targets of xoxd-projection/v2, as the contract README lists them. */
export const TARGETS: Readonly<Record<Site, TargetRow>> = {
	blog: { id: 'blog', byline: 'owner', origin: 'https://transscendsurvival.org', actor: 'jess' },
	firm: { id: 'firm', byline: 'firm', origin: 'https://xoxd.ai', actor: null },
};

export function isSite(value: unknown): value is Site {
	return typeof value === 'string' && (SITES as readonly string[]).includes(value);
}

export const TEXT_MEDIA_TYPE = 'text/plain; charset=utf-8';
export const OCTET_MEDIA_TYPE = 'application/octet-stream';

/**
 * The closed set of media types an attachment may carry. SVG, HTML and every
 * script type are absent, because they would run as active content on the
 * site origin.
 */
export const MEDIA_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/avif',
	'image/gif',
	'application/pdf',
	'video/mp4',
	'video/webm',
	TEXT_MEDIA_TYPE,
	OCTET_MEDIA_TYPE,
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** The one media type each attachment path extension stands for. Extensions match exactly. */
export const EXTENSION_MEDIA_TYPES: ReadonlyMap<string, MediaType> = new Map<string, MediaType>([
	['png', 'image/png'],
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['webp', 'image/webp'],
	['avif', 'image/avif'],
	['gif', 'image/gif'],
	['pdf', 'application/pdf'],
	['mp4', 'video/mp4'],
	['webm', 'video/webm'],
	['tex', TEXT_MEDIA_TYPE],
	['bib', TEXT_MEDIA_TYPE],
	['txt', TEXT_MEDIA_TYPE],
	['csv', TEXT_MEDIA_TYPE],
	['tsv', TEXT_MEDIA_TYPE],
	['json', TEXT_MEDIA_TYPE],
	['bin', OCTET_MEDIA_TYPE],
	['dat', OCTET_MEDIA_TYPE],
	['zip', OCTET_MEDIA_TYPE],
	['gz', OCTET_MEDIA_TYPE],
]);

/** The media types each attachment kind may carry. */
export const KIND_MEDIA_TYPES: ReadonlyMap<AttachmentKind, readonly MediaType[]> = new Map<
	AttachmentKind,
	readonly MediaType[]
>([
	['image', ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']],
	['video', ['video/mp4', 'video/webm']],
	['pdf', ['application/pdf']],
	['tex', [TEXT_MEDIA_TYPE]],
	['data', [TEXT_MEDIA_TYPE, OCTET_MEDIA_TYPE]],
]);

/** The public addresses, all under /projection/v2/ on the hub. */
export const ROOT = '/projection/v2';
export const headPath = (target: string): string => `${ROOT}/${target}/head.json`;
export const manifestPath = (target: string, sha256: string): string => `${ROOT}/${target}/manifests/${sha256}.json`;
export const signaturePath = (target: string, sha256: string): string => `${ROOT}/${target}/manifests/${sha256}.sig`;
export const blobPath = (sha256: string): string => `${ROOT}/blobs/sha256/${sha256}`;

export interface Head {
	readonly contract: typeof CONTRACT;
	readonly target: Site;
	readonly seq: number;
	readonly manifest: string;
	readonly signature: string;
}

export interface ManifestTarget {
	readonly id: Site;
	readonly origin: string;
	readonly actor: string | null;
}

export interface EntryPlacement {
	readonly category: string | null;
	readonly tier: string | null;
	readonly featured: boolean | null;
	readonly legacyUrl: string | null;
}

export interface ApprovalComponents {
	readonly meta: string;
	readonly body: string;
	readonly variants: string;
	readonly attachments: string;
}

export interface EntryApproval {
	readonly sha256: string;
	readonly rule: typeof HASH_RULE;
	readonly components: ApprovalComponents;
}

export interface BlobRef {
	readonly sha256: string;
	readonly bytes: number;
}

export interface EntryAttachment extends BlobRef {
	readonly id: string;
	readonly kind: AttachmentKind;
	readonly mediaType: MediaType;
	readonly path: string;
	readonly alt: string;
}

export interface Entry {
	readonly id: string;
	readonly kind: PostKind;
	readonly slug: string;
	readonly path: string;
	readonly date: string;
	readonly updated: string | null;
	readonly title: string;
	readonly summary: string;
	readonly tags: readonly string[];
	readonly placement: EntryPlacement;
	readonly approval: EntryApproval;
	readonly document: BlobRef;
	readonly html: BlobRef;
	readonly attachments: readonly EntryAttachment[];
}

export type Collections = { readonly [K in PostKind]: readonly Entry[] };

export interface ManifestTombstone {
	readonly id: string;
	readonly retired: string;
	readonly reason: string;
	readonly replacedBy: string | null;
	readonly formerPaths: readonly string[];
}

export interface Manifest {
	readonly contract: typeof CONTRACT;
	readonly spec: typeof CONTENT_SPEC;
	readonly hashRule: typeof HASH_RULE;
	readonly target: ManifestTarget;
	readonly seq: number;
	readonly previous: string | null;
	readonly generatedFrom: readonly string[];
	readonly collections: Collections;
	readonly tombstones: readonly ManifestTombstone[];
}

/** An attachment row of a Document. Only id and sha256 enter the approval hash. */
export interface DocumentAttachment {
	readonly id: string;
	readonly kind: AttachmentKind;
	readonly path: string;
	readonly sha256: string;
	readonly bytes: number;
	readonly pages?: number;
	readonly alt: string;
	readonly builtBy?: string;
	readonly sourceOf?: string;
	readonly licence?: string;
}

/** A body block: one key names its alternative. */
export type Block = Readonly<Record<string, string | boolean>>;

export interface Front {
	readonly id: string;
	readonly kind: PostKind;
	readonly date: string;
	readonly updated?: string;
	readonly title: string;
	readonly summary: string;
	readonly tags: readonly string[];
	readonly byline: Byline;
	readonly series?: string;
	readonly image?: string;
	readonly image_alt?: string;
	readonly short?: string;
	readonly channels: readonly string[];
	readonly offer?: string;
	readonly meet?: string;
	readonly event?: string;
	readonly licence?: string;
}

/** A channel variant: one key names its channel. */
export type ChannelVariant = Readonly<Record<string, string | readonly string[]>>;

/** The public Document blob: a Document without its channel variants. */
export interface PublicDocument {
	readonly meta: Front;
	readonly body: readonly Block[];
	readonly attachments: readonly DocumentAttachment[];
}

/** A whole Document, as the canonical-v0 vectors carry it. */
export interface Document extends PublicDocument {
	readonly variants: readonly ChannelVariant[];
}

/** The site path of an attachment: the entry path, a slash and the attachment's own path. */
export function attachmentSitePath(entryPath: string, attachment: { readonly path: string }): string {
	return `${entryPath}/${attachment.path}`;
}
