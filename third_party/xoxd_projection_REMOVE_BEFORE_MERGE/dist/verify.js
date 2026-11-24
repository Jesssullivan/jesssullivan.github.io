// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * The consumer side of xoxd-projection/v2. It enforces every consumer rule in
 * the contract README and matches the hub's reference verifier finding for
 * finding. It needs Web Crypto and standard JavaScript only. The caller owns
 * all I/O: blobs arrive through a callback.
 */
import { decodeBase64, decodeUtf8, plainBytes, sha256OfBytes } from './bytes.js';
import { canonicalJsonWithNull, combineHashes, publicComponentHashes } from './canonical.js';
import {
	attachmentSitePath,
	blobPath,
	COLLECTION_KEYS,
	CONTRACT,
	EXTENSION_MEDIA_TYPES,
	KIND_MEDIA_TYPES,
	OCTET_MEDIA_TYPE,
	TARGETS,
	TEXT_MEDIA_TYPE,
} from './contract.js';
import { finding } from './findings.js';
import { checkHtml } from './html.js';
import { shapeHead, shapeManifest, shapePublicDocument } from './shape.js';

/** Either the verified value, or every finding that refused it. */

const refuse =    (findings                              )                  => ({ ok: false, findings });

function parseJson(bytes            )                                                             {
	const text = decodeUtf8(bytes);
	if (text === null) return { ok: false };
	try {
		return { ok: true, value: JSON.parse(text)           , text };
	} catch {
		return { ok: false };
	}
}

/**
 * head.json is a pointer for people and tools. The build never takes the
 * manifest from it. This check only makes sure the hub served a head of the
 * contract for this target, so a build fails when the hub serves a broken one.
 */
export function checkHead(headBytes            , target      )                     {
	const at = 'head.json';
	const parsed = parseJson(headBytes);
	if (!parsed.ok) return refuse([finding('head_invalid', at, 'the bytes are not UTF-8 JSON')]);
	const head = shapeHead(parsed.value);
	if (!head.ok) return refuse([finding('head_invalid', at, head.problem)]);
	if (head.value.target !== target) {
		return refuse([finding('head_invalid', at, `the head is for ${head.value.target}, this site is ${target}`)]);
	}
	return { ok: true, value: head.value };
}

/**
 * Rules 2 and 3, then the shape: the bytes hash to the address they were
 * fetched by, the detached signature verifies against the pinned key, and the
 * bytes are a canonical xoxd-projection/v2 manifest. It stops at the first
 * failing step, because nothing after it can be trusted.
 */
export async function verifyManifestBytes(
	bytes            ,
	signature            ,
	publicKey        ,
	expectedSha256        ,
)                                  {
	const at = 'manifest';
	const actual = await sha256OfBytes(bytes);
	if (actual !== expectedSha256) {
		return refuse([finding('manifest_hash_mismatch', at, `expected ${expectedSha256}, got ${actual}`)]);
	}

	const rawKey = decodeBase64(publicKey);
	if (rawKey === null || rawKey.length !== 32) {
		return refuse([finding('public_key_invalid', at, 'the pinned key is not 32 bytes of base64')]);
	}
	const signatureText = decodeUtf8(signature);
	const rawSignature = signatureText === null ? null : decodeBase64(signatureText);
	let valid = false;
	if (rawSignature !== null && rawSignature.length === 64) {
		const key = await globalThis.crypto.subtle.importKey('raw', plainBytes(rawKey), { name: 'Ed25519' }, false, [
			'verify',
		]);
		valid = await globalThis.crypto.subtle.verify(
			{ name: 'Ed25519' },
			key,
			plainBytes(rawSignature),
			plainBytes(bytes),
		);
	}
	if (!valid) return refuse([finding('signature_invalid', at, 'the ed25519 signature does not verify')]);

	const parsed = parseJson(bytes);
	if (!parsed.ok) return refuse([finding('manifest_not_json', at, 'the bytes are not UTF-8 JSON')]);
	const contract =
		typeof parsed.value === 'object' && parsed.value !== null
			? (parsed.value                          ).contract
			: undefined;
	if (contract !== CONTRACT) {
		return refuse([finding('contract_mismatch', at, `contract is ${JSON.stringify(contract)}`)]);
	}
	const manifest = shapeManifest(parsed.value);
	if (!manifest.ok) return refuse([finding('manifest_schema', at, manifest.problem)]);
	let canonical               ;
	try {
		canonical = canonicalJsonWithNull(parsed.value);
	} catch {
		canonical = null;
	}
	if (canonical !== parsed.text) {
		return refuse([finding('manifest_not_canonical', at, 'the bytes are not the canonical serialization')]);
	}
	return { ok: true, value: manifest.value };
}

function checkSortedUnique(values                   , at        , out                     )       {
	for (let index = 1; index < values.length; index += 1) {
		if (values[index] === values[index - 1]) out.push(finding('duplicate', `${at}[${index}]`, values[index]));
		else if (values[index] < values[index - 1]) out.push(finding('order_invalid', `${at}[${index}]`, values[index]));
	}
}

/** The extension of the last segment of a site path, or null when it has none. */
function extensionOf(path        )                {
	const segment = path.slice(path.lastIndexOf('/') + 1);
	const dot = segment.lastIndexOf('.');
	return dot < 0 ? null : segment.slice(dot + 1);
}

/**
 * The path a legacyUrl redirects from, or null when it redirects nothing. A
 * path, or an absolute URL on the target's origin, redirects from its path
 * with one trailing slash removed. A legacyUrl on another origin is a record,
 * and so is one whose path is the entry's own path.
 */
export function legacyRedirectSource(legacyUrl               , origin        , entryPath        )                {
	if (legacyUrl === null) return null;
	let url     ;
	try {
		if (URL.canParse(legacyUrl)) url = new URL(legacyUrl);
		else if (legacyUrl.startsWith('/')) url = new URL(legacyUrl, origin);
		else return null;
	} catch {
		return null;
	}
	if (url.origin !== new URL(origin).origin) return null;
	const path = url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
	return path === entryPath ? null : path;
}

function entriesOf(manifest          )            {
	return COLLECTION_KEYS.flatMap((key) =>
		manifest.collections[key].map((entry, index) => ({ entry, at: `collections.${key}[${index}]` })),
	);
}

/**
 * The address rule. Every live path, which is each entry path and each
 * attachment path, is unique, and nothing lies below an attachment path,
 * since a file cannot also be a directory. Every redirect source, which is
 * each on-origin legacyUrl path and each tombstone former path, is unique and
 * is never a live path. Each non-null legacyUrl is unique as written too.
 */
function checkAddresses(manifest          , out                     )       {
	const live = new Map                ();
	const files = new Set        ();
	const entries = entriesOf(manifest);
	const claimLive = (path        , at        )       => {
		const owner = live.get(path);
		if (owner !== undefined) out.push(finding('path_conflict', at, `${path} is also ${owner}`));
		else live.set(path, at);
	};
	for (const { entry, at } of entries) {
		claimLive(entry.path, `${at}.path`);
		entry.attachments.forEach((attachment, index) => {
			claimLive(attachment.path, `${at}.attachments[${index}].path`);
			files.add(attachment.path);
		});
	}
	const belowFile = (path        )                => {
		for (let slash = path.indexOf('/', 1); slash > 0; slash = path.indexOf('/', slash + 1)) {
			if (files.has(path.slice(0, slash))) return path.slice(0, slash);
		}
		return null;
	};
	for (const [path, at] of live) {
		const file = belowFile(path);
		if (file !== null) out.push(finding('path_conflict', at, `${path} lies below the attachment ${file}`));
	}

	const sources = new Map                ();
	const claimRedirect = (path        , at        )       => {
		const liveOwner = live.get(path);
		const sourceOwner = sources.get(path);
		const file = belowFile(path);
		if (liveOwner !== undefined) out.push(finding('redirect_conflict', at, `${path} is the live path ${liveOwner}`));
		else if (sourceOwner !== undefined) out.push(finding('redirect_conflict', at, `${path} is also ${sourceOwner}`));
		else if (file !== null) out.push(finding('redirect_conflict', at, `${path} lies below the attachment ${file}`));
		else sources.set(path, at);
	};
	const legacyUrls = new Map                ();
	for (const { entry, at } of entries) {
		const { legacyUrl } = entry.placement;
		if (legacyUrl === null) continue;
		const where = `${at}.placement.legacyUrl`;
		const owner = legacyUrls.get(legacyUrl);
		if (owner !== undefined) {
			out.push(finding('redirect_conflict', where, `${legacyUrl} is also ${owner}`));
			continue;
		}
		legacyUrls.set(legacyUrl, where);
		const source = legacyRedirectSource(legacyUrl, manifest.target.origin, entry.path);
		if (source !== null) claimRedirect(source, where);
	}
	manifest.tombstones.forEach((tombstone, index) => {
		tombstone.formerPaths.forEach((path, at) => claimRedirect(path, `tombstones[${index}].formerPaths[${at}]`));
	});
}

/**
 * The media type rule: the path extension names the attachment's media type
 * in the extension table, and the type is one its kind may carry. The shape
 * check already refuses a type outside the allowlist.
 */
function checkMediaTypes(manifest          , out                     )       {
	for (const { entry, at } of entriesOf(manifest)) {
		entry.attachments.forEach((attachment, index) => {
			const where = `${at}.attachments[${index}]`;
			const extension = extensionOf(attachment.path);
			const named = extension === null ? undefined : EXTENSION_MEDIA_TYPES.get(extension);
			if (named !== attachment.mediaType) {
				out.push(
					finding(
						'media_type_invalid',
						`${where}.path`,
						`${attachment.path} does not name ${attachment.mediaType} in the extension table`,
					),
				);
			}
			if (!(KIND_MEDIA_TYPES.get(attachment.kind) ?? []).includes(attachment.mediaType)) {
				out.push(
					finding('media_type_invalid', `${where}.mediaType`, `${attachment.kind} cannot be ${attachment.mediaType}`),
				);
			}
		});
	}
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const EBML = [0x1a, 0x45, 0xdf, 0xa3];
/** The ftyp major brands read as MP4 video. AVIF has its own brands. */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ']);
// eslint-disable-next-line no-control-regex
const NOT_TEXT = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/u;

/**
 * The media type of an attachment from its leading bytes, never its name.
 * Known signatures come first. UTF-8 with no control character other than
 * tab, line feed, form feed and carriage return is plain text. Anything else
 * is application/octet-stream.
 */
export function sniffMediaType(bytes            )            {
	const has = (at        , signature                   )          =>
		bytes.length >= at + signature.length && signature.every((byte, index) => bytes[at + index] === byte);
	const ascii = (at        , text        )          =>
		has(
			at,
			Array.from(text, (char) => char.charCodeAt(0)),
		);
	if (has(0, PNG)) return 'image/png';
	if (has(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
	if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
	if (ascii(4, 'ftyp') && bytes.length >= 12) {
		const brand = String.fromCharCode(...bytes.subarray(8, 12));
		if (brand === 'avif' || brand === 'avis') return 'image/avif';
		if (MP4_BRANDS.has(brand)) return 'video/mp4';
	}
	if (ascii(0, '%PDF-')) return 'application/pdf';
	if (has(0, EBML) && String.fromCharCode(...bytes.subarray(0, 64)).includes('webm')) return 'video/webm';
	const text = decodeUtf8(bytes);
	if (text !== null && !NOT_TEXT.test(text)) return TEXT_MEDIA_TYPE;
	return OCTET_MEDIA_TYPE;
}

/**
 * Rules 4 and 5, plus what a shape cannot state: the target row, the seq, ids
 * unique, every set sorted, each entry in the collection of its kind, each
 * slug the last segment of its path, the address rule and the media type rule.
 */
export function checkManifest(manifest          , expect                     )                      {
	const out                      = [];
	const row = TARGETS[expect.target];
	if (manifest.target.id !== expect.target) {
		out.push(finding('target_mismatch', 'target.id', `built for ${manifest.target.id}, this site is ${expect.target}`));
	} else if (manifest.target.origin !== row.origin || manifest.target.actor !== row.actor) {
		out.push(finding('target_mismatch', 'target', 'origin or actor differs from the contract target'));
	}
	if (manifest.seq < expect.lastSeq) {
		out.push(finding('seq_regressed', 'seq', `seq ${manifest.seq} is lower than the last built ${expect.lastSeq}`));
	}

	checkSortedUnique(manifest.generatedFrom, 'generatedFrom', out);
	const ids = new Set        ();
	for (const key of COLLECTION_KEYS) {
		const entries = manifest.collections[key];
		checkSortedUnique(
			entries.map((entry) => entry.id),
			`collections.${key}`,
			out,
		);
		entries.forEach((entry, index) => {
			const at = `collections.${key}[${index}]`;
			if (entry.kind !== key) out.push(finding('kind_mismatch', `${at}.kind`, `${entry.kind} in ${key}`));
			if (entry.path.slice(entry.path.lastIndexOf('/') + 1) !== entry.slug) {
				out.push(finding('slug_mismatch', `${at}.slug`, `${entry.slug} is not the last segment of ${entry.path}`));
			}
			if (ids.has(entry.id)) out.push(finding('duplicate', `${at}.id`, entry.id));
			ids.add(entry.id);
			checkSortedUnique(
				entry.attachments.map((attachment) => attachment.id),
				`${at}.attachments`,
				out,
			);
		});
	}
	checkSortedUnique(
		manifest.tombstones.map((tombstone) => tombstone.id),
		'tombstones',
		out,
	);
	manifest.tombstones.forEach((tombstone, index) => {
		const at = `tombstones[${index}]`;
		if (ids.has(tombstone.id)) out.push(finding('duplicate', `${at}.id`, `${tombstone.id} is live and retired`));
		checkSortedUnique(tombstone.formerPaths, `${at}.formerPaths`, out);
	});
	checkAddresses(manifest, out);
	checkMediaTypes(manifest, out);
	return out;
}

/** Rule 7 for one blob: the sha256 and the length of its bytes. */
export async function verifyBlob(ref         , data            )                               {
	const at = blobPath(ref.sha256);
	const actual = await sha256OfBytes(data);
	if (actual !== ref.sha256) return [finding('blob_hash_mismatch', at, `the bytes hash to ${actual}`)];
	if (data.length !== ref.bytes) return [finding('blob_size_mismatch', at, `${data.length} bytes, not ${ref.bytes}`)];
	return [];
}

function sameStrings(a                   , b                   )          {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Rule 6: recompute an entry's approval hash from its public Document blob and
 * the variants component the manifest carries. It also checks that the entry
 * shows what was approved: its metadata and attachments equal the Document's,
 * and the Document's byline publishes to the manifest's target.
 */
export async function recomputeApproval(
	entry       ,
	documentBytes            ,
	target                ,
)                               {
	const at = `entry ${entry.id}`;
	const parsed = parseJson(documentBytes);
	if (!parsed.ok) return [finding('document_invalid', at, 'the Document is not UTF-8 JSON')];
	const shaped = shapePublicDocument(parsed.value);
	if (!shaped.ok) return [finding('document_invalid', at, shaped.problem)];
	const document                 = shaped.value;

	const out                      = [];
	const { meta } = document;
	if (meta.byline !== TARGETS[target.id].byline) {
		out.push(finding('byline_mismatch', at, `byline ${meta.byline} does not publish to ${target.id}`));
	}
	const shown                                    = [
		['id', entry.id, meta.id],
		['kind', entry.kind, meta.kind],
		['date', entry.date, meta.date],
		['updated', entry.updated, meta.updated ?? null],
		['title', entry.title, meta.title],
		['summary', entry.summary, meta.summary],
	];
	for (const [field, inEntry, inDocument] of shown) {
		if (inEntry !== inDocument) out.push(finding('document_mismatch', `${at}.${field}`, 'differs from the Document'));
	}
	if (!sameStrings(entry.tags, meta.tags)) {
		out.push(finding('document_mismatch', `${at}.tags`, 'differs from the Document'));
	}

	const rows = new Map(document.attachments.map((row) => [row.id, row]));
	if (rows.size !== entry.attachments.length) {
		out.push(finding('document_mismatch', `${at}.attachments`, 'the attachment sets differ'));
	}
	for (const attachment of entry.attachments) {
		const row = rows.get(attachment.id);
		const same =
			row !== undefined &&
			row.kind === attachment.kind &&
			row.sha256 === attachment.sha256 &&
			row.bytes === attachment.bytes &&
			row.alt === attachment.alt &&
			attachmentSitePath(entry.path, row) === attachment.path;
		if (!same) {
			out.push(finding('document_mismatch', `${at}.attachments.${attachment.id}`, 'differs from the Document'));
		}
	}

	let components                                                   ;
	try {
		components = await publicComponentHashes(document);
	} catch (error) {
		return [...out, finding('document_invalid', at, String(error))];
	}
	const claimed = entry.approval.components;
	for (const name of ['meta', 'body', 'attachments']         ) {
		if (components[name] !== claimed[name]) {
			out.push(finding('approval_mismatch', `${at}.approval.components.${name}`, 'does not match the Document'));
		}
	}
	const recomputed = await combineHashes({ ...components, variants: claimed.variants });
	if (recomputed !== entry.approval.sha256) {
		out.push(finding('approval_mismatch', `${at}.approval.sha256`, `recomputed ${recomputed}`));
	}
	return out;
}

/** Reads one blob by its sha256, or returns null when it does not exist. */

/**
 * Rule 5, second sentence: an equal seq rebuilds the same manifest. A site
 * that has built nothing passes only seq 0 against a last seq of 0. When the
 * last manifest is unknown, an equal seq cannot be shown to be a rebuild, so
 * it is refused.
 */
export function checkRebuild(
	seq        ,
	manifestSha256        ,
	last                                                                    ,
)                      {
	if (seq !== last.lastSeq || manifestSha256 === last.lastManifest) return [];
	if (last.lastManifest === null && last.lastSeq === 0) return [];
	const built = last.lastManifest ?? 'an unknown manifest';
	return [finding('seq_regressed', 'seq', `seq ${seq} equals the last built seq, which built ${built}`)];
}

/**
 * Rules 2 to 5 and the head check. It stops at the first group that fails,
 * because the entries of an untrusted manifest mean nothing.
 */
export async function verifyManifest(input               )                                  {
	const head = checkHead(input.head, input.target);
	if (!head.ok) return head;
	const verified = await verifyManifestBytes(input.manifest, input.signature, input.publicKey, input.manifestSha256);
	if (!verified.ok) return verified;
	const checked = [
		...checkManifest(verified.value, input),
		...checkRebuild(verified.value.seq, input.manifestSha256, input),
	];
	if (checked.length > 0) return refuse(checked);
	return verified;
}

/** A manifest that passed every rule, with every blob it names, each verified. */

/**
 * Rules 6 to 8 over a manifest that passed rules 2 to 5: every blob by its
 * sha256 and length, every approval hash, every HTML blob and every
 * attachment's media type. It reads each blob once and returns all findings.
 */
export async function verifyEntries(
	manifest          ,
	readBlob          ,
)                                                         {
	const out                      = [];
	const blobs = new Map                    ();
	const failed = new Set        ();
	const fetchBlob = async (ref         )                             => {
		const known = blobs.get(ref.sha256);
		if (known !== undefined) {
			const sized = await verifyBlob(ref, known);
			out.push(...sized);
			return sized.length === 0 ? known : null;
		}
		if (failed.has(ref.sha256)) return null;
		const data = await readBlob(ref.sha256);
		if (data === null) {
			failed.add(ref.sha256);
			out.push(finding('fetch_missing', blobPath(ref.sha256), 'not found'));
			return null;
		}
		const blobFindings = await verifyBlob(ref, data);
		out.push(...blobFindings);
		if (blobFindings.length > 0) {
			failed.add(ref.sha256);
			return null;
		}
		blobs.set(ref.sha256, data);
		return data;
	};
	for (const key of COLLECTION_KEYS) {
		for (const entry of manifest.collections[key]) {
			const document = await fetchBlob(entry.document);
			if (document !== null) out.push(...(await recomputeApproval(entry, document, manifest.target)));
			const html = await fetchBlob(entry.html);
			if (html !== null) out.push(...checkHtml(html, `html of ${entry.id}`));
			for (const attachment of entry.attachments) {
				const data = await fetchBlob(attachment);
				const sniffed = data === null ? null : sniffMediaType(data);
				if (sniffed !== null && sniffed !== attachment.mediaType) {
					out.push(
						finding('media_type_mismatch', attachment.path, `the bytes are ${sniffed}, not ${attachment.mediaType}`),
					);
				}
			}
		}
	}
	return out.length === 0 ? { ok: true, value: blobs } : refuse(out);
}

/**
 * Every consumer rule in order. It returns the verified manifest with its
 * blobs, or the findings. A site build exits non-zero on any finding.
 */
export async function verifyProjection(input                 )                                            {
	const manifest = await verifyManifest(input);
	if (!manifest.ok) return manifest;
	const blobs = await verifyEntries(manifest.value, input.readBlob);
	if (!blobs.ok) return blobs;
	return {
		ok: true,
		value: {
			manifest: manifest.value,
			manifestBytes: input.manifest,
			manifestSha256: input.manifestSha256,
			blobs: blobs.value,
		},
	};
}
