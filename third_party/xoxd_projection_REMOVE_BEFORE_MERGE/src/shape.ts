/**
 * Strict shape checks for head.json, the manifest and the public Document,
 * written out by hand so the module needs no schema library. They accept
 * exactly what the contract's JSON Schemas accept: every listed key, the
 * right type for each, the path and segment patterns, and no unknown key.
 * Each check returns null when the value fits, or the first problem as text.
 */
import {
	ATTACHMENT_KINDS,
	BYLINES,
	CHANNELS,
	CONTENT_SPEC,
	CONTRACT,
	DATE_PATTERN,
	HASH_RULE,
	MEDIA_TYPES,
	PATH_PATTERN,
	POST_KINDS,
	SEGMENT_PATTERN,
	SHA256_PATTERN,
	SITES,
	VIDEO_HOSTS,
} from './contract.ts';
import type { Head, Manifest, PublicDocument } from './contract.ts';

type Check = (value: unknown, at: string) => string | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const string: Check = (value, at) => (typeof value === 'string' ? null : `${at} is not a string`);

const boolean: Check = (value, at) => (typeof value === 'boolean' ? null : `${at} is not a boolean`);

const natural: Check = (value, at) =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 ? null : `${at} is not a natural number`;

const pattern =
	(regex: RegExp): Check =>
	(value, at) =>
		typeof value === 'string' && regex.test(value) ? null : `${at} does not match ${regex.source}`;

const oneOf =
	(values: readonly string[]): Check =>
	(value, at) =>
		typeof value === 'string' && values.includes(value) ? null : `${at} is not one of ${values.join(', ')}`;

const literal =
	(expected: string): Check =>
	(value, at) =>
		value === expected ? null : `${at} is not ${JSON.stringify(expected)}`;

const nullable =
	(check: Check): Check =>
	(value, at) =>
		value === null ? null : check(value, at);

const array =
	(item: Check): Check =>
	(value, at) => {
		if (!Array.isArray(value)) return `${at} is not an array`;
		for (let index = 0; index < value.length; index += 1) {
			const problem = item(value[index], `${at}[${index}]`);
			if (problem !== null) return problem;
		}
		return null;
	};

/**
 * An object with these required keys, these optional keys and no other key.
 * Only own keys count, so a key such as toString is never read from the
 * prototype.
 */
const struct =
	(required: Readonly<Record<string, Check>>, optional: Readonly<Record<string, Check>> = {}): Check =>
	(value, at) => {
		if (!isRecord(value)) return `${at} is not an object`;
		for (const key of Object.keys(value)) {
			if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key)) return `${at}.${key} is not allowed`;
		}
		for (const [key, check] of Object.entries(required)) {
			if (!Object.hasOwn(value, key)) return `${at}.${key} is missing`;
			const problem = check(value[key], `${at}.${key}`);
			if (problem !== null) return problem;
		}
		for (const [key, check] of Object.entries(optional)) {
			if (!Object.hasOwn(value, key)) continue;
			const problem = check(value[key], `${at}.${key}`);
			if (problem !== null) return problem;
		}
		return null;
	};

/** The value fits at least one alternative. */
const union =
	(alternatives: readonly Check[]): Check =>
	(value, at) =>
		alternatives.some((check) => check(value, at) === null) ? null : `${at} fits no alternative`;

const segment = pattern(SEGMENT_PATTERN);
const sitePath = pattern(PATH_PATTERN);
const sha256 = pattern(SHA256_PATTERN);

const headCheck = struct({
	contract: literal(CONTRACT),
	target: oneOf(SITES),
	seq: natural,
	manifest: sha256,
	signature: sitePath,
});

const blobRef = struct({ sha256, bytes: natural });

const entryCheck = struct({
	id: segment,
	kind: oneOf(POST_KINDS),
	slug: segment,
	path: sitePath,
	date: string,
	updated: nullable(string),
	title: string,
	summary: string,
	tags: array(string),
	placement: struct({
		category: nullable(string),
		tier: nullable(string),
		featured: nullable(boolean),
		legacyUrl: nullable(string),
	}),
	approval: struct({
		sha256,
		rule: literal(HASH_RULE),
		components: struct({ meta: sha256, body: sha256, variants: sha256, attachments: sha256 }),
	}),
	document: blobRef,
	html: blobRef,
	attachments: array(
		struct({
			id: segment,
			kind: oneOf(ATTACHMENT_KINDS),
			mediaType: oneOf(MEDIA_TYPES),
			path: sitePath,
			sha256,
			bytes: natural,
			alt: string,
		}),
	),
});

const manifestCheck = struct({
	contract: literal(CONTRACT),
	spec: literal(CONTENT_SPEC),
	hashRule: literal(HASH_RULE),
	target: struct({ id: oneOf(SITES), origin: string, actor: nullable(string) }),
	seq: natural,
	previous: nullable(sha256),
	generatedFrom: array(segment),
	collections: struct(Object.fromEntries(POST_KINDS.map((kind) => [kind, array(entryCheck)]))),
	tombstones: array(
		struct({
			id: segment,
			retired: pattern(DATE_PATTERN),
			reason: string,
			replacedBy: nullable(segment),
			formerPaths: array(sitePath),
		}),
	),
});

const front = struct(
	{
		id: string,
		kind: oneOf(POST_KINDS),
		date: string,
		title: string,
		summary: string,
		tags: array(string),
		byline: oneOf(BYLINES),
		channels: array(oneOf(CHANNELS)),
	},
	{
		updated: string,
		series: string,
		image: string,
		image_alt: string,
		short: string,
		offer: string,
		meet: string,
		event: string,
		licence: string,
	},
);

const block = union([
	struct({ prose: string }),
	struct({ math: string, display: boolean }),
	struct({ code: string, lang: string }),
	struct({ figure: string, alt: string }, { caption: string }),
	struct({ pdf: string, title: string }),
	struct({ video: string, host: oneOf(VIDEO_HOSTS), title: string }),
	struct({ event: string }),
	struct({ booking: string }),
]);

const documentAttachment = struct(
	{ id: string, kind: oneOf(ATTACHMENT_KINDS), path: string, sha256, bytes: natural, alt: string },
	{ pages: natural, builtBy: string, sourceOf: string, licence: string },
);

const publicDocumentCheck = struct({
	meta: front,
	body: array(block),
	attachments: array(documentAttachment),
});

/** A parse result: the typed value, or the first problem as text. */
export type Shaped<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: string };

function shaped<T>(check: Check, value: unknown, at: string): Shaped<T> {
	const problem = check(value, at);
	return problem === null ? { ok: true, value: value as T } : { ok: false, problem };
}

export const shapeHead = (value: unknown): Shaped<Head> => shaped<Head>(headCheck, value, 'head');
export const shapeManifest = (value: unknown): Shaped<Manifest> => shaped<Manifest>(manifestCheck, value, 'manifest');
export const shapePublicDocument = (value: unknown): Shaped<PublicDocument> =>
	shaped<PublicDocument>(publicDocumentCheck, value, 'document');
