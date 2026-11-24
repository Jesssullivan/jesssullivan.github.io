// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
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

export const POST_KINDS = ['note', 'article', 'formal', 'announcement']         ;
export const SITES = ['blog', 'firm']         ;
export const BYLINES = ['owner', 'firm']         ;
export const CHANNELS = [
	'site',
	'feed',
	'calendar',
	'bluesky',
	'youtube',
	'linkedin',
	'newsletter',
	'fediverse',
]         ;
export const ATTACHMENT_KINDS = ['pdf', 'tex', 'image', 'video', 'data']         ;
export const VIDEO_HOSTS = ['youtube', 'file']         ;
export const VISIBILITIES = ['private', 'unlisted', 'public']         ;
export const VARIANT_TAGS = ['bluesky', 'youtube', 'linkedin', 'newsletter', 'fediverse']         ;

/** Collection keys in manifest order. */
export const COLLECTION_KEYS = POST_KINDS;

/** The two targets of xoxd-projection/v2, as the contract README lists them. */
export const TARGETS                                    = {
	blog: { id: 'blog', byline: 'owner', origin: 'https://transscendsurvival.org', actor: 'jess' },
	firm: { id: 'firm', byline: 'firm', origin: 'https://xoxd.ai', actor: null },
};

export function isSite(value         )                {
	return typeof value === 'string' && (SITES                     ).includes(value);
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
]         ;

/** The one media type each attachment path extension stands for. Extensions match exactly. */
export const EXTENSION_MEDIA_TYPES                                 = new Map                   ([
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
export const KIND_MEDIA_TYPES                                                    = new Map
 ([
	['image', ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']],
	['video', ['video/mp4', 'video/webm']],
	['pdf', ['application/pdf']],
	['tex', [TEXT_MEDIA_TYPE]],
	['data', [TEXT_MEDIA_TYPE, OCTET_MEDIA_TYPE]],
]);

/** The public addresses, all under /projection/v2/ on the hub. */
export const ROOT = '/projection/v2';
export const headPath = (target        )         => `${ROOT}/${target}/head.json`;
export const manifestPath = (target        , sha256        )         => `${ROOT}/${target}/manifests/${sha256}.json`;
export const signaturePath = (target        , sha256        )         => `${ROOT}/${target}/manifests/${sha256}.sig`;
export const blobPath = (sha256        )         => `${ROOT}/blobs/sha256/${sha256}`;

/** An attachment row of a Document. Only id and sha256 enter the approval hash. */

/** A body block: one key names its alternative. */

/** A channel variant: one key names its channel. */

/** The public Document blob: a Document without its channel variants. */

/** A whole Document, as the canonical-v0 vectors carry it. */

/** The site path of an attachment: the entry path, a slash and the attachment's own path. */
export function attachmentSitePath(entryPath        , attachment                           )         {
	return `${entryPath}/${attachment.path}`;
}
