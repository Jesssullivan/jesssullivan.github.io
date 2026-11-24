import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeBase64, plainBytes, sha256OfBytes } from '../src/bytes.ts';
import { blobPath, headPath, manifestPath, signaturePath } from '../src/contract.ts';
import type { Manifest, Site } from '../src/contract.ts';
import { checkHtml } from '../src/html.ts';
import {
	checkManifest,
	checkRebuild,
	legacyRedirectSource,
	sniffMediaType,
	verifyProjection,
} from '../src/verify.ts';
import type { Verification, VerifiedProjection } from '../src/verify.ts';
import {
	cases,
	FIXTURE_PUBLIC_KEY,
	fixtureBytes,
	newSigner,
	signBytes,
	signManifest,
	text,
	VALID_BLOG,
	validBlogManifest,
} from './helpers.ts';
import type { Signed, Signer } from './helpers.ts';

const codes = (result: Verification<unknown>): string[] =>
	result.ok ? [] : result.findings.map((item) => item.code).sort();

/** Runs the whole verifier over the fixture tree, with optional replaced files. */
async function verifyFixture(options: {
	target: Site;
	manifest: string;
	lastSeq?: number;
	lastManifest?: string | null;
	overlay?: string | null;
	publicKey?: string;
	replace?: ReadonlyMap<string, Uint8Array>;
}): Promise<Verification<VerifiedProjection>> {
	const read = (path: string): Uint8Array | null =>
		options.replace?.get(path) ?? fixtureBytes(path, options.overlay ?? null);
	const head = read(headPath(options.target));
	const manifest = read(manifestPath(options.target, options.manifest));
	const signature = read(signaturePath(options.target, options.manifest));
	assert.ok(head && manifest && signature, 'the fixture files exist');
	return verifyProjection({
		head,
		manifest,
		signature,
		publicKey: options.publicKey ?? FIXTURE_PUBLIC_KEY,
		manifestSha256: options.manifest,
		target: options.target,
		lastSeq: options.lastSeq ?? 0,
		lastManifest: options.lastManifest ?? null,
		readBlob: async (sha256) => read(blobPath(sha256)),
	});
}

/** Verifies a re-signed blog manifest, with extra blobs served beside the fixtures. */
async function verifySigned(
	signer: Signer,
	signed: Signed,
	extraBlobs: ReadonlyMap<string, Uint8Array> = new Map(),
	lastSeq = 0,
	lastManifest: string | null = null,
): Promise<Verification<VerifiedProjection>> {
	const replace = new Map<string, Uint8Array>([
		[manifestPath('blog', signed.sha256), signed.bytes],
		[signaturePath('blog', signed.sha256), signed.signature],
	]);
	for (const [sha256, bytes] of extraBlobs) replace.set(blobPath(sha256), bytes);
	return verifyFixture({ target: 'blog', manifest: signed.sha256, publicKey: signer.publicKey, replace, lastSeq, lastManifest });
}

/** A mutable copy of the valid blog manifest. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
const blog = (): Mutable<Manifest> => validBlogManifest() as Mutable<Manifest>;

/** The bytes as a Node Buffer view into the middle of a larger buffer, as a file read or a pool can give. */
function bufferView(bytes: Uint8Array): Buffer {
	const pool = Buffer.alloc(bytes.length + 64, 0x5a);
	pool.set(bytes, 17);
	return pool.subarray(17, 17 + bytes.length);
}

describe('byte views', () => {
	it('copies exactly the viewed bytes, never the buffer behind them', async () => {
		const view = Buffer.from('xxxxhelloyyyy').subarray(4, 9);
		assert.equal(plainBytes(view).byteLength, 5);
		assert.equal(await sha256OfBytes(view), await sha256OfBytes(text('hello')));
	});

	it('verifies the valid blog from Buffer views', async () => {
		const read = (path: string): Buffer => {
			const bytes = fixtureBytes(path);
			assert.ok(bytes, path);
			return bufferView(bytes);
		};
		const result = await verifyProjection({
			head: read(headPath('blog')),
			manifest: read(manifestPath('blog', VALID_BLOG)),
			signature: read(signaturePath('blog', VALID_BLOG)),
			publicKey: FIXTURE_PUBLIC_KEY,
			manifestSha256: VALID_BLOG,
			target: 'blog',
			lastSeq: 0,
			lastManifest: null,
			readBlob: async (sha256) => read(blobPath(sha256)),
		});
		assert.deepEqual(codes(result), []);
	});
});

describe('contract fixture cases', () => {
	it('covers every case the contract README lists', () => {
		assert.deepEqual(
			cases.map((row) => row.name).sort(),
			[
				'approval-mismatch',
				'bad-signature',
				'blob-bytes-changed',
				'dot-segment-path',
				'entry-path-is-attachment-path',
				'html-attachment-path',
				'html-script',
				'lower-seq',
				'manifest-bytes-changed',
				'redirect-conflict',
				'valid-blog',
				'valid-firm',
				'wrong-target',
			],
		);
	});

	for (const row of cases) {
		it(`${row.name}: ${row.expect.length === 0 ? 'passes with no findings' : `refused with ${row.expect.join(', ')}`}`, async () => {
			const result = await verifyFixture({
				target: row.target,
				manifest: row.manifest,
				lastSeq: row.lastSeq,
				// A case with a last seq above 0 rebuilds the manifest it names,
				// as valid-firm says, or is refused for a lower seq anyway.
				lastManifest: row.lastSeq === 0 ? null : row.manifest,
				overlay: row.overlay,
			});
			assert.deepEqual(codes(result), [...row.expect].sort());
			assert.equal(result.ok, row.expect.length === 0);
		});
	}

	it('returns the manifest and every blob it names for the valid blog', async () => {
		const result = await verifyFixture({ target: 'blog', manifest: VALID_BLOG });
		assert.ok(result.ok);
		assert.equal(result.value.manifest.seq, 1);
		for (const [sha256, bytes] of result.value.blobs) assert.equal(await sha256OfBytes(bytes), sha256);
	});
});

describe('cases the fixtures do not cover', () => {
	it('refuses a truncated signature', async () => {
		const signature = fixtureBytes(signaturePath('blog', VALID_BLOG));
		assert.ok(signature);
		const replace = new Map([[signaturePath('blog', VALID_BLOG), signature.subarray(0, 60)]]);
		assert.deepEqual(codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, replace })), [
			'signature_invalid',
		]);
	});

	it('refuses a signature with a line break', async () => {
		const signature = fixtureBytes(signaturePath('blog', VALID_BLOG));
		assert.ok(signature);
		const replace = new Map([[signaturePath('blog', VALID_BLOG), new Uint8Array([...signature, 0x0a])]]);
		assert.deepEqual(codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, replace })), [
			'signature_invalid',
		]);
	});

	it('refuses a pinned key of the wrong length', async () => {
		const short = encodeBase64(new Uint8Array(31).fill(7));
		const long = encodeBase64(new Uint8Array(33).fill(7));
		for (const publicKey of [short, long, 'not base64']) {
			assert.deepEqual(codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, publicKey })), [
				'public_key_invalid',
			]);
		}
	});

	it('refuses a valid signature by another key', async () => {
		const signer = await newSigner();
		assert.deepEqual(
			codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, publicKey: signer.publicKey })),
			['signature_invalid'],
		);
	});

	it('refuses a signed manifest that is valid JSON but not canonical', async () => {
		const signer = await newSigner();
		const pretty = text(JSON.stringify(validBlogManifest(), null, 2));
		assert.deepEqual(codes(await verifySigned(signer, await signBytes(signer, pretty))), ['manifest_not_canonical']);
	});

	it('refuses a signed manifest that is not JSON, and one of another contract', async () => {
		const signer = await newSigner();
		assert.deepEqual(codes(await verifySigned(signer, await signBytes(signer, text('{"contract":')))), [
			'manifest_not_json',
		]);
		const other = { ...validBlogManifest(), contract: 'xoxd-projection/v1' };
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, other))), ['contract_mismatch']);
	});

	it('refuses a signed manifest with an unknown key', async () => {
		const signer = await newSigner();
		const extra = { ...validBlogManifest(), toString: 'x' };
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, extra))), ['manifest_schema']);
	});

	it('refuses the signed fixture manifest re-signed after the sha256 address moved', async () => {
		const bytes = fixtureBytes(manifestPath('blog', VALID_BLOG));
		assert.ok(bytes);
		const signer = await newSigner();
		const signed = await signBytes(signer, bytes);
		const wrongAddress = '0'.repeat(64);
		const replace = new Map([
			[manifestPath('blog', wrongAddress), bytes],
			[signaturePath('blog', wrongAddress), signed.signature],
		]);
		const result = await verifyFixture({ target: 'blog', manifest: wrongAddress, publicKey: signer.publicKey, replace });
		assert.deepEqual(codes(result), ['manifest_hash_mismatch']);
	});

	it('refuses a blob shorter than its declared size', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const note = manifest.collections.note[0];
		assert.ok(note);
		note.html.bytes += 1;
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['blob_size_mismatch']);
	});

	it('refuses two entries at one path', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const [note] = manifest.collections.note;
		const [article] = manifest.collections.article;
		assert.ok(note && article);
		note.path = article.path;
		note.slug = article.slug;
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['path_conflict']);
	});

	it('refuses a redirect that shadows a live path', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const [tombstone] = manifest.tombstones;
		const [article] = manifest.collections.article;
		assert.ok(tombstone && article);
		tombstone.formerPaths = [article.path, ...tombstone.formerPaths].sort();
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['redirect_conflict']);
	});

	it('refuses a legacyUrl that shadows a live path', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const [note] = manifest.collections.note;
		const [article] = manifest.collections.article;
		assert.ok(note && article);
		note.placement.legacyUrl = `${manifest.target.origin}${article.path}/`;
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['redirect_conflict']);
	});

	it('refuses a seq lower than the last accepted, and accepts a rebuild at an equal one', async () => {
		const signer = await newSigner();
		const manifest = blog();
		manifest.seq = 5;
		const signed = await signManifest(signer, manifest);
		assert.deepEqual(codes(await verifySigned(signer, signed, new Map(), 6, 'a'.repeat(64))), ['seq_regressed']);
		assert.deepEqual(codes(await verifySigned(signer, signed, new Map(), 5, signed.sha256)), []);
	});

	it('refuses an equal seq that names another manifest than the one built last', async () => {
		const signer = await newSigner();
		const first = blog();
		first.seq = 5;
		const second = blog();
		second.seq = 5;
		second.previous = 'a'.repeat(64);
		const built = await signManifest(signer, first);
		const other = await signManifest(signer, second);
		assert.notEqual(other.sha256, built.sha256);
		assert.deepEqual(codes(await verifySigned(signer, other, new Map(), 5, built.sha256)), ['seq_regressed']);
	});

	it('refuses an equal seq when the manifest built last is unknown', async () => {
		const signer = await newSigner();
		const manifest = blog();
		manifest.seq = 5;
		const signed = await signManifest(signer, manifest);
		assert.deepEqual(codes(await verifySigned(signer, signed, new Map(), 5, null)), ['seq_regressed']);
	});

	it('checks a rebuild by seq and manifest', () => {
		const sha = 'b'.repeat(64);
		assert.deepEqual(checkRebuild(0, sha, { lastSeq: 0, lastManifest: null }), []);
		assert.deepEqual(checkRebuild(2, sha, { lastSeq: 1, lastManifest: 'c'.repeat(64) }), []);
		assert.deepEqual(checkRebuild(1, sha, { lastSeq: 1, lastManifest: sha }), []);
		assert.deepEqual(
			checkRebuild(1, sha, { lastSeq: 1, lastManifest: 'c'.repeat(64) }).map((row) => row.code),
			['seq_regressed'],
		);
	});

	it('refuses an attachment media type outside the allowlist', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const attachment = manifest.collections.article[0]?.attachments[0];
		assert.ok(attachment);
		(attachment as { mediaType: string }).mediaType = 'image/svg+xml';
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['manifest_schema']);
	});

	it('refuses an attachment path whose extension names another media type', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const article = manifest.collections.article[0];
		const attachment = article?.attachments[0];
		assert.ok(article && attachment);
		attachment.path = `${article.path}/orbit.gif`;
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['media_type_invalid']);
	});

	it('refuses attachment bytes that read as another media type', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const attachment = manifest.collections.article[0]?.attachments[0];
		assert.ok(attachment);
		// GIF bytes served as the PNG attachment. The Document names the
		// attachment by sha256, so the Document match fails as well.
		const gif = text('GIF89a not really a gif');
		attachment.sha256 = await sha256OfBytes(gif);
		attachment.bytes = gif.length;
		const result = await verifySigned(signer, await signManifest(signer, manifest), new Map([[attachment.sha256, gif]]));
		assert.deepEqual(codes(result), ['document_mismatch', 'media_type_mismatch']);
	});

	it('refuses HTML with an event handler attribute', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const note = manifest.collections.note[0];
		assert.ok(note);
		const html = text('<p>hello</p><img src="/a.png" alt="" onerror="alert(1)">');
		note.html = { sha256: await sha256OfBytes(html), bytes: html.length };
		const result = await verifySigned(signer, await signManifest(signer, manifest), new Map([[note.html.sha256, html]]));
		assert.deepEqual(codes(result), ['html_event_handler']);
	});

	it('refuses a missing blob', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const note = manifest.collections.note[0];
		assert.ok(note);
		note.html = { sha256: 'f'.repeat(64), bytes: 1 };
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['fetch_missing']);
	});

	it('refuses an entry whose title differs from its Document', async () => {
		const signer = await newSigner();
		const manifest = blog();
		const note = manifest.collections.note[0];
		assert.ok(note);
		note.title = `${note.title} changed`;
		assert.deepEqual(codes(await verifySigned(signer, await signManifest(signer, manifest))), ['document_mismatch']);
	});

	it('refuses a head.json for another target', async () => {
		const head = fixtureBytes(headPath('firm'));
		assert.ok(head);
		const replace = new Map([[headPath('blog'), head]]);
		assert.deepEqual(codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, replace })), ['head_invalid']);
	});

	it('does not take the manifest from head.json', async () => {
		const head = JSON.parse(new TextDecoder().decode(fixtureBytes(headPath('blog')) ?? new Uint8Array())) as Record<
			string,
			unknown
		>;
		head.manifest = 'a'.repeat(64);
		head.seq = 99;
		const replace = new Map([[headPath('blog'), text(JSON.stringify(head))]]);
		assert.deepEqual(codes(await verifyFixture({ target: 'blog', manifest: VALID_BLOG, replace })), []);
	});
});

describe('checkManifest', () => {
	it('refuses a slug that is not the last segment of its path', () => {
		const manifest = blog();
		assert.deepEqual(checkManifest(manifest, { target: 'blog', lastSeq: 0 }), []);
		const note = manifest.collections.note[0];
		assert.ok(note);
		note.slug = 'elsewhere';
		assert.deepEqual(
			checkManifest(manifest, { target: 'blog', lastSeq: 0 }).map((row) => row.code),
			['slug_mismatch'],
		);
	});

	it('refuses two tombstones that claim one former path', () => {
		const manifest = blog();
		const first = manifest.tombstones[0];
		assert.ok(first);
		manifest.tombstones = [first, { ...first, id: 'zz-retired', replacedBy: null }];
		assert.deepEqual(
			checkManifest(manifest, { target: 'blog', lastSeq: 0 }).map((row) => row.code),
			['redirect_conflict'],
		);
	});
});

describe('legacyRedirectSource', () => {
	const origin = 'https://transscendsurvival.org';
	it('redirects from an on-origin path and ignores other origins and the entry path', () => {
		assert.equal(legacyRedirectSource('/2019/old/', origin, '/notes/new'), '/2019/old');
		assert.equal(legacyRedirectSource(`${origin}/2019/old?x=1`, origin, '/notes/new'), '/2019/old');
		assert.equal(legacyRedirectSource('https://elsewhere.example/2019/old', origin, '/notes/new'), null);
		assert.equal(legacyRedirectSource('//elsewhere.example/2019/old', origin, '/notes/new'), null);
		assert.equal(legacyRedirectSource('/notes/new/', origin, '/notes/new'), null);
		assert.equal(legacyRedirectSource(null, origin, '/notes/new'), null);
	});
});

describe('sniffMediaType', () => {
	const bytes = (...parts: Array<string | number[]>): Uint8Array =>
		new Uint8Array(parts.flatMap((part) => (typeof part === 'string' ? Array.from(part, (c) => c.charCodeAt(0)) : part)));
	it('reads the type from the bytes, never the name', () => {
		assert.equal(sniffMediaType(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
		assert.equal(sniffMediaType(bytes([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
		assert.equal(sniffMediaType(bytes('GIF89a', [1])), 'image/gif');
		assert.equal(sniffMediaType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ')), 'image/webp');
		assert.equal(sniffMediaType(bytes([0, 0, 0, 0x1c], 'ftypavif')), 'image/avif');
		assert.equal(sniffMediaType(bytes([0, 0, 0, 0x1c], 'ftypisom')), 'video/mp4');
		assert.equal(sniffMediaType(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], 'webm')), 'video/webm');
		assert.equal(sniffMediaType(bytes('%PDF-1.7\n')), 'application/pdf');
		assert.equal(sniffMediaType(bytes('\\documentclass{article}\n')), 'text/plain; charset=utf-8');
		assert.equal(sniffMediaType(bytes('<svg onload="x()"></svg>')), 'text/plain; charset=utf-8');
		assert.equal(sniffMediaType(bytes([0, 1, 2, 0xff])), 'application/octet-stream');
		assert.equal(sniffMediaType(bytes([0, 0, 0, 0x1c], 'ftypheic')), 'application/octet-stream');
	});
});

describe('checkHtml', () => {
	const html = (value: string): string[] => checkHtml(text(value)).map((item) => item.code);

	it('passes plain rendered markup', () => {
		assert.deepEqual(html('<p>a <a href="/x">b</a> &lt;script&gt; onclick=1</p><img src="/a.png" alt="">'), []);
	});

	it('refuses script elements, event handlers and javascript: URLs in any spelling', () => {
		assert.deepEqual(html('<SCRIPT src="/x.js"></SCRIPT>'), ['html_script']);
		assert.deepEqual(html('<img src="/a.png" OnError="x()">'), ['html_event_handler']);
		assert.deepEqual(html('<a href=" JaVa&#x53;cript&colon;alert(1)">x</a>'), ['html_javascript_url']);
		assert.deepEqual(html("<a href='java\tscript:x'>x</a>"), ['html_javascript_url']);
	});

	it('reads quotes in unquoted values and names the way a browser does', () => {
		assert.deepEqual(html("<img src=x' onerror=alert(1)>"), ['html_event_handler']);
		assert.deepEqual(html("<p>a</p><img src=x' onerror=alert(1)>"), ['html_event_handler']);
		assert.deepEqual(html('<img alt=a"b onload=x>'), ['html_event_handler']);
		assert.deepEqual(html('<img title="a>" onerror=x>'), ['html_event_handler']);
		assert.deepEqual(html('<img"x onerror=x>'), ['html_event_handler']);
		assert.deepEqual(html('<img src=a/onerror=x>'), []);
		assert.deepEqual(html('<img src="a"onerror=x>'), ['html_event_handler']);
		assert.deepEqual(html('<img/src=a/onerror=x>'), []);
		assert.deepEqual(html('<img/onerror=x>'), ['html_event_handler']);
	});

	it('checks the nested document of a srcdoc attribute', () => {
		assert.deepEqual(html('<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>'), ['html_script']);
		assert.deepEqual(html('<iframe srcdoc="&#60;img src=x onerror=alert(1)&#62;"></iframe>'), ['html_event_handler']);
		assert.deepEqual(html('<iframe srcdoc="&lt;p&gt;plain&lt;/p&gt;"></iframe>'), []);
	});

	it('refuses a meta refresh to a javascript: URL', () => {
		assert.deepEqual(html('<meta http-equiv=refresh content="0;url=javascript:alert(1)">'), ['html_javascript_url']);
		assert.deepEqual(html('<meta http-equiv=refresh content="0; URL=\'javascript:alert(1)\'">'), ['html_javascript_url']);
		assert.deepEqual(html('<meta http-equiv=refresh content="0;url=/next">'), []);
		assert.deepEqual(html('<meta http-equiv="refresh" content="0;javascript:alert(1)">'), ['html_javascript_url']);
		assert.deepEqual(html('<meta http-equiv=refresh content="0, javascript:alert(1)">'), ['html_javascript_url']);
	});

	it('refuses a javascript: URL at any position in a value', () => {
		assert.deepEqual(html('<svg><a><animate attributeName="href" values="x;javascript:alert(1)"/></a></svg>'), [
			'html_javascript_url',
		]);
		assert.deepEqual(html('<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>'), [
			'html_javascript_url',
		]);
		assert.deepEqual(html('<img srcset="/a.png 1x, javascript:alert(1) 2x">'), ['html_javascript_url']);
	});

	it('refuses bytes that are not UTF-8', () => {
		assert.equal(checkHtml(new Uint8Array([0xff, 0xfe]))[0]?.code, 'html_not_utf8');
	});
});
