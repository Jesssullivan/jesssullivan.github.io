// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * Canonical JSON (RFC 8785) and the canonical-v0 approval hash.
 *
 * Object keys sort by UTF-16 code units, there is no whitespace, and numbers
 * and strings serialize as ECMAScript JSON.stringify does. Every string, keys
 * included, is normalized to NFC first. canonical-v0 refuses null, because a
 * Document never holds one. The projection manifest states an absent value as
 * null, so it uses the same rule with null kept.
 */
import { HASH_RULE, VARIANT_TAGS } from './contract.js';
import { sha256OfText } from './bytes.js';

/** Strict code unit order, never locale order. */
function compareCodeUnits(a        , b        )         {
	return a < b ? -1 : a > b ? 1 : 0;
}

const LONE_SURROGATE = /[\uD800-\uDFFF]/u;

function canonicalString(value        )         {
	if (LONE_SURROGATE.test(value)) throw new TypeError('canonical JSON refuses a lone surrogate');
	return JSON.stringify(value.normalize('NFC'));
}

function canonicalNumber(value        )         {
	if (!Number.isFinite(value)) throw new TypeError('canonical JSON refuses a non-finite number');
	return JSON.stringify(value);
}

function serialize(value         , keepNull         )         {
	if (value === null) {
		if (keepNull) return 'null';
		throw new TypeError('canonical JSON refuses null: omit an absent optional');
	}
	switch (typeof value) {
		case 'string':
			return canonicalString(value);
		case 'number':
			return canonicalNumber(value);
		case 'boolean':
			return value ? 'true' : 'false';
		case 'object':
			break;
		default:
			throw new TypeError(`canonical JSON refuses a ${typeof value}`);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item         ) => serialize(item, keepNull)).join(',')}]`;
	}
	const prototype          = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError('canonical JSON takes plain objects only');
	}
	const entries                           = [];
	const seen = new Set        ();
	for (const [rawKey, item] of Object.entries(value)) {
		if (item === undefined) continue;
		if (LONE_SURROGATE.test(rawKey)) throw new TypeError('canonical JSON refuses a lone surrogate');
		const key = rawKey.normalize('NFC');
		if (seen.has(key)) throw new TypeError(`two keys normalize to ${JSON.stringify(key)}`);
		seen.add(key);
		entries.push([key, item]);
	}
	entries.sort(([a], [b]) => compareCodeUnits(a, b));
	return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${serialize(item, keepNull)}`).join(',')}}`;
}

/** RFC 8785 canonical JSON with every string in NFC. It throws on null. */
export function canonicalJson(value         )         {
	return serialize(value, false);
}

/** The same rule, except that null serializes as null, as the manifest needs. */
export function canonicalJsonWithNull(value         )         {
	return serialize(value, true);
}

/** H: lowercase hex sha256 of the UTF-8 bytes of the canonical JSON of a value. */
export async function hashOf(value         )                  {
	return sha256OfText(canonicalJson(value));
}

/** The tag of a channel variant: its key that names a channel. */
function variantTag(variant        )         {
	for (const tag of VARIANT_TAGS) if (tag in variant) return tag;
	throw new TypeError('channel variant has no known tag');
}

/** Variants sorted by channel tag. A Document holds at most one per channel. */
export async function variantsHash(variants                   )                  {
	const tagged = variants.map((variant) => ({ tag: variantTag(variant), variant }));
	tagged.sort((a, b) => compareCodeUnits(a.tag, b.tag));
	for (let index = 1; index < tagged.length; index += 1) {
		if (tagged[index].tag === tagged[index - 1].tag) {
			throw new TypeError(`two channel variants for ${tagged[index].tag}`);
		}
	}
	return hashOf(tagged.map(({ variant }) => variant));
}

/** Only id and sha256 of each attachment, sorted by id after NFC. */
export async function attachmentsHash(
	attachments                                                      ,
)                  {
	const pairs = attachments.map(({ id, sha256 }) => ({ id: id.normalize('NFC'), sha256 }));
	pairs.sort((a, b) => compareCodeUnits(a.id, b.id));
	for (let index = 1; index < pairs.length; index += 1) {
		if (pairs[index].id === pairs[index - 1].id) throw new TypeError(`two attachments with id ${pairs[index].id}`);
	}
	return hashOf(pairs);
}

/** The meta, body and attachments components, which a public Document alone gives. */
export async function publicComponentHashes(
	document                ,
)                                                {
	const [meta, body, attachments] = await Promise.all([
		hashOf(document.meta),
		hashOf(document.body),
		attachmentsHash(document.attachments),
	]);
	return { meta, body, attachments };
}

/** All four component hashes of a whole Document. */
export async function componentHashes(document          )                              {
	const [publicPart, variants] = await Promise.all([
		publicComponentHashes(document),
		variantsHash(document.variants),
	]);
	return { ...publicPart, variants };
}

/** The approval hash from its four component hashes. */
export async function combineHashes(components                    )                  {
	for (const [name, value] of Object.entries(components)) {
		if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${name} is not a lowercase hex sha256`);
	}
	return hashOf({
		rule: HASH_RULE,
		meta: components.meta,
		body: components.body,
		variants: components.variants,
		attachments: components.attachments,
	});
}

/** The canonical-v0 approval hash of a whole Document. */
export async function approvalHash(document          )                  {
	return combineHashes(await componentHashes(document));
}
