import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { render } from 'svelte/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import NoteBody from './components/NoteBody.svelte';
import { mediaElements } from './note-html';
import {
	attachmentHeaderRules,
	attachmentHeaders,
	headingNotes,
	noteFromEntry,
	noteJsonFeedItem,
	noteRssItem,
	notesFromEntries,
	parseEntry,
	showsInHeading,
	type AttachmentRef,
	type Note,
	type ProjectionEntry,
} from './notes';

// TIN-8654: what the hub really sends. The xoxd_projection module ships the
// hub's own xoxd-projection/v3 fixtures. A server on a loopback address
// serves the valid blog tree and the valid firm tree, and the module's real
// fetcher verifies both over HTTP and writes them. Every test below reads
// those verified post files. No post here is written by hand.
//
// The fixtures hold one note, which is a single paragraph. The media blocks
// are in the blog tree's article at /blog/marsh-dawn, and the diagram is in
// the firm tree. This site builds notes only and ignores both paths, as the
// placement test checks. So the render tests hand those verified posts to
// the same functions and the same component a note goes through.
//
// The module comes from Bazel, which sets XOXD_PROJECTION_PKG and
// XOXD_PROJECTION_FIXTURES. A plain vitest run has no module and skips this
// file. Under Bazel a missing value is an error, so the gate never skips it.

const hasModule = Boolean(process.env.XOXD_PROJECTION_PKG && process.env.XOXD_PROJECTION_FIXTURES);
if (!hasModule && process.env.TEST_TARGET) {
	throw new Error('XOXD_PROJECTION_PKG and XOXD_PROJECTION_FIXTURES must be set for the notes projection tests');
}

interface FixtureHub {
	base: string;
	close(): Promise<void>;
}

interface Testing {
	FIXTURE_CONTRACT: string;
	VALID_BLOG: { manifest: string; seq: number };
	VALID_FIRM: { manifest: string; seq: number };
	fixturePublicKey(): string;
	fixturesRoot(): string;
	noRedirectFetch: (url: string) => Promise<unknown>;
	startFixtureHub(root: string): Promise<FixtureHub>;
}

interface Fetcher {
	fetchProjection(options: Record<string, unknown>): Promise<{ ok: boolean }>;
}

interface ModuleRoot {
	attachmentHeaders(ref: Pick<AttachmentRef, 'mediaType'>): Record<string, string>;
	showsInHeading(post: Pick<ProjectionEntry, 'heading'>, day: string): boolean;
}

interface Step {
	loadProjectionModule(env?: NodeJS.ProcessEnv, entry?: string): Promise<unknown>;
}

const ORIGIN = 'https://transscendsurvival.org';
const posts = new Map<string, ProjectionEntry>();
let moduleRoot: ModuleRoot;
let scratch = '';

/** Imports a file of projection/ by path, so the type check does not follow it. */
const load = (file: string): Promise<unknown> =>
	import(/* @vite-ignore */ pathToFileURL(resolve(process.cwd(), 'projection', file)).href);

const note = (id: string): Note => {
	const post = posts.get(id);
	if (!post) throw new Error(`the fixtures hold no post ${id}`);
	return noteFromEntry(post);
};

/** The note body as the server renders it, with the comment markers of the renderer removed. */
const body = (id: string): string => {
	const { cover, html } = note(id);
	return render(NoteBody, { props: { cover, html } }).body.replace(/<!--[^>]*-->/g, '');
};

describe.skipIf(!hasModule)('notes from the contract fixtures', () => {
	beforeAll(async () => {
		const testing = (await load('testing.mjs')) as Testing;
		const step = (await load('step.mjs')) as Step;
		const fetcher = (await step.loadProjectionModule()) as Fetcher;
		moduleRoot = (await step.loadProjectionModule(process.env, 'index')) as ModuleRoot;
		scratch = await mkdtemp(join(tmpdir(), 'notes-projection-'));
		const hub = await testing.startFixtureHub(testing.fixturesRoot());
		try {
			for (const [target, valid] of [
				['blog', testing.VALID_BLOG],
				['firm', testing.VALID_FIRM],
			] as const) {
				const outDir = join(scratch, target);
				const result = await fetcher.fetchProjection({
					contract: testing.FIXTURE_CONTRACT,
					baseUrl: hub.base,
					target,
					manifestSha256: valid.manifest,
					seq: valid.seq,
					lastSeq: 0,
					lastManifest: null,
					publicKey: testing.fixturePublicKey(),
					outDir,
					fetch: testing.noRedirectFetch,
					allowLoopbackHttpForTests: true,
				});
				expect(result, `the valid ${target} tree`).toMatchObject({ ok: true });
				for (const name of (await readdir(join(outDir, 'posts'))).sort()) {
					const file = join(outDir, 'posts', name);
					const post = parseEntry(JSON.parse(await readFile(file, 'utf8')), file);
					posts.set(post.id, post);
				}
			}
		} finally {
			await hub.close();
		}
	});

	afterAll(async () => {
		if (scratch) await rm(scratch, { recursive: true, force: true });
	});

	it('reads every post file of both trees as an xoxd-projection/v3 post file', () => {
		expect([...posts.keys()].sort()).toEqual([
			'drawing-orbits',
			'firm-open',
			'first-light',
			'marsh-dawn',
			'office-hours',
			'projection-contract',
			'signed-pictures',
		]);
	});

	it('builds the one entry at a /notes path and ignores every other path', () => {
		const blog = ['drawing-orbits', 'first-light', 'marsh-dawn', 'office-hours'].map((id) => posts.get(id) as ProjectionEntry);
		const result = notesFromEntries(blog);
		expect(result.notes.map((item) => item.path)).toEqual(['/notes/first-light']);
		expect(result.ignoredBlog).toBe(2);
		expect(result.ignoredOther).toBe(1);
	});

	describe("this site's copies of the module's two rules", () => {
		it('gives each attachment the headers the module gives it', () => {
			const refs = [...posts.values()].flatMap((post) => post.attachments);
			expect(refs.length).toBeGreaterThanOrEqual(10);
			for (const ref of refs) expect(attachmentHeaders(ref), ref.path).toEqual({ ...moduleRoot.attachmentHeaders(ref) });
			expect(new Set(refs.map((ref) => ref.mediaType))).toEqual(
				new Set(['image/png', 'image/svg+xml', 'audio/mpeg', 'video/mp4', 'application/pdf']),
			);
		});

		it('shows a post in the heading on the days the module does', () => {
			for (const post of posts.values()) {
				for (const day of ['2026-11-24', '2026-12-31', '2027-01-01', '2099-12-31']) {
					expect(showsInHeading(post, day), `${post.id} on ${day}`).toBe(moduleRoot.showsInHeading(post, day));
				}
			}
			// The fixtures hold all three cases: a last day, no last day and no placement.
			expect(posts.get('marsh-dawn')?.heading).toEqual({ until: '2026-12-31' });
			expect(posts.get('signed-pictures')?.heading).toEqual({ until: null });
			expect(posts.get('first-light')?.heading).toBeNull();
		});
	});

	describe('the page renders each block kind the fixtures hold', () => {
		it('prose: the one paragraph of the note, in the blog prose wrapper', () => {
			expect(body('first-light')).toMatch(
				/^\s*<div class="prose prose-lg max-w-none note-body svelte-[a-z0-9]+">\s*<p>The hub signed this note and the blog built it from the manifest\.<\/p>\s*<\/div>\s*$/,
			);
		});

		it('math: MathML inline and as a display block', () => {
			const html = body('drawing-orbits');
			expect(html).toContain('<p>Kepler found that <math><semantics>');
			expect(html).toContain('<div class="math"><math display="block"');
		});

		it('figure: an image with its alt text and caption', () => {
			const html = body('drawing-orbits');
			expect(html).toMatch(/<figure class="embed-figure"><img src="\/blog\/drawing-orbits\/orbit\.png" alt="A single dot"[^>]*>/);
			expect(html).toContain('<figcaption>One orbit, drawn small.</figcaption>');
		});

		it('figure with a label: its id, its number before the caption, and the link from the prose', () => {
			const html = body('marsh-dawn');
			expect(html).toContain('<figure class="embed-figure figure-numbered" id="fig-reeds">');
			expect(html).toContain('<figcaption><span class="figure-number">Figure 1.</span> The reeds, drawn small.</figcaption>');
			expect(html).toContain('<a class="figure-ref" href="#fig-reeds">Figure 1</a>');
			const figure = posts.get('marsh-dawn')?.blocks.find((block) => block.type === 'figure');
			expect(figure).toMatchObject({ label: 'fig-reeds', number: 1 });
		});

		it('recording: an inline audio element with controls, its title and its description', () => {
			const html = body('marsh-dawn');
			expect(html).toMatch(/<audio src="\/blog\/marsh-dawn\/dawn\.mp3" title="Dawn chorus" controls preload="metadata">/);
			expect(html).toContain('<figure class="embed-recording"><figcaption>Dawn chorus</figcaption>');
			expect(html).toContain('<div class="embed-description"><p>Invented birdsong over still water.</p></div>');
		});

		it('photos: a set of images in order, each with its alt text, and a caption where one is given', () => {
			const html = body('marsh-dawn');
			const set = /<figure class="embed-photos">(.*?)<\/figure><\/figure>/s.exec(html)?.[1] ?? '';
			expect([...set.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)].map((match) => [match[1], match[2]])).toEqual([
				['/blog/marsh-dawn/heron.png', 'A single dot for a heron'],
				['/blog/marsh-dawn/egret.png', 'A single dot for an egret'],
			]);
			expect(set).toContain('<figcaption>The egret came second.</figcaption>');
		});

		it('youtube: the poster inside a link to the no-cookie player, and no frame before a press', () => {
			const html = body('marsh-dawn');
			expect(html).toContain('<figure class="embed-youtube" data-youtube-id="dQw4w9WgXcQ">');
			expect(html).toMatch(
				/<a class="embed-play" href="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ" rel="noopener noreferrer"><img src="\/blog\/marsh-dawn\/walk\.png" alt="A single dot for the boardwalk"/,
			);
			expect(html).not.toContain('<iframe');
			expect(html).not.toMatch(/src="https?:\/\/[^"]*youtube/);
		});

		it('clip: a muted, looping, inline video with its poster and size, no autoplay attribute, and its button', () => {
			const html = body('marsh-dawn');
			const video = /<video [^>]*>/.exec(html)?.[0] ?? '';
			for (const attribute of [
				'data-clip',
				'muted',
				'loop',
				'playsinline',
				'poster="/blog/marsh-dawn/walk.png"',
				'width="16"',
				'height="16"',
				'aria-label="Ripples spread across the water"',
			]) {
				expect(video, attribute).toContain(attribute);
			}
			// The page script starts the clip, so a reader who asked for reduced motion is never shown motion first.
			expect(video).not.toContain('autoplay');
			expect(video).not.toContain('controls');
			expect(html).toContain('<source src="/blog/marsh-dawn/ripple.mp4" type="video/mp4"');
			expect(html).toMatch(/<button type="button" class="clip-toggle" data-clip-toggle hidden="hidden"[^>]*>Play the clip<\/button>/);
			expect(html).toContain('<figcaption>A loop of the water.</figcaption>');
			const clip = posts.get('marsh-dawn')?.blocks.find((block) => block.type === 'clip');
			expect(clip).toMatchObject({ video: { width: 16, height: 16, mediaType: 'video/mp4' } });
		});

		it('diagram: an img of the static SVG with the alt text, and never the SVG or its source in the page', () => {
			const html = body('signed-pictures');
			expect(html).toMatch(
				/<figure class="embed-diagram"><img src="\/writing\/signed-pictures\/diagram-[0-9a-f]{24}\.svg" alt="A draft goes to review"[^>]*>/,
			);
			expect(html).toContain('<figcaption>A draft moves to review, then the owner approves it.</figcaption>');
			expect(html).not.toContain('<svg');
			expect(html).not.toContain('flowchart');
		});

		it('pdf: a link to the file with its type and size', () => {
			expect(body('projection-contract')).toContain(
				'<p class="embed-pdf"><a href="/writing/projection-contract/spec.pdf" type="application/pdf">The contract as a PDF</a>',
			);
		});

		it('a decorative cover: an image with an empty alt and no figure around it', () => {
			const html = body('marsh-dawn');
			expect(posts.get('marsh-dawn')?.cover).toMatchObject({ decorative: true, alt: '' });
			expect(html).toMatch(/<div class="note-cover svelte-[a-z0-9]+"><img src="\/blog\/marsh-dawn\/cover\.png" alt="" decoding="async"/);
			expect(html).not.toContain('<figure class="note-cover');
		});

		it('holds no card, box or border class around any block', () => {
			for (const id of posts.keys()) expect(body(id), id).not.toMatch(/class="[^"]*\b(card|glass|border|ring|shadow)[^"]*"/);
		});
	});

	describe('a feed carries each media block as its text alternative', () => {
		it('a clip is its alt text, linked to the file, then its caption', () => {
			const { feedHtml } = note('marsh-dawn');
			expect(feedHtml).toContain(
				`<p><a href="${ORIGIN}/blog/marsh-dawn/ripple.mp4">Ripples spread across the water</a> (silent video clip)</p><p>A loop of the water.</p>`,
			);
		});

		it('a recording is its title, linked to the file, then its description', () => {
			expect(note('marsh-dawn').feedHtml).toContain(
				`<p><a href="${ORIGIN}/blog/marsh-dawn/dawn.mp3">Dawn chorus</a> (audio recording)</p><p>Invented birdsong over still water.</p>`,
			);
		});

		it('a diagram is its picture with the alt text, at a full address', () => {
			expect(note('signed-pictures').feedHtml).toMatch(
				new RegExp(`<img src="${ORIGIN}/writing/signed-pictures/diagram-[0-9a-f]{24}\\.svg" alt="A draft goes to review"`),
			);
		});

		it('holds no media element, no control, no frame and no site-relative address', () => {
			for (const id of posts.keys()) {
				const { feedHtml } = note(id);
				expect(mediaElements(feedHtml), id).toEqual([]);
				expect(feedHtml, id).not.toMatch(/(src|href|poster)="[/#]/);
				expect(feedHtml, id).not.toContain('Play the clip');
				expect(feedHtml, id).not.toContain('data-pagefind');
			}
			// The page body of the same post does hold them, so the check above is not empty.
			expect(mediaElements(note('marsh-dawn').html)).toEqual(['audio', 'video', 'source', 'button']);
		});

		it('gives the RSS and JSON feed items that body', () => {
			const marsh = note('marsh-dawn');
			const json = noteJsonFeedItem(marsh);
			expect(json.content_html).toBe(marsh.feedHtml);
			expect(json.id).toBe(`${ORIGIN}/blog/marsh-dawn`);
			const rss = noteRssItem(marsh);
			expect(rss).toContain('(silent video clip)');
			expect(rss).toContain('(audio recording)');
			expect(rss).not.toMatch(/<(video|audio|button|source|iframe)\b/);
		});
	});

	it('lists the posts that ask for the heading stage on a day, with their last day', () => {
		const all = ['first-light', 'marsh-dawn', 'signed-pictures'].map(note);
		expect(headingNotes(all, '2026-12-31').map((item) => [item.path, item.until])).toEqual([
			['/blog/marsh-dawn', '2026-12-31'],
			['/writing/signed-pictures', null],
		]);
		expect(headingNotes(all, '2027-01-01').map((item) => item.path)).toEqual(['/writing/signed-pictures']);
		expect(headingNotes(all, '2026-12-31')[0].cover).toMatchObject({ decorative: true });
	});

	it('writes a header rule for each attachment, with the exact type of a sound, a video and a diagram picture', () => {
		const text = attachmentHeaderRules([note('marsh-dawn'), note('signed-pictures')]);
		const rule = (path: string, type: string) =>
			`${path}\n  Content-Type: ${type}\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; sandbox\n`;
		expect(text).toContain(rule('/blog/marsh-dawn/dawn.mp3', 'audio/mpeg'));
		expect(text).toContain(rule('/blog/marsh-dawn/ripple.mp4', 'video/mp4'));
		expect(text).toMatch(/\/writing\/signed-pictures\/diagram-[0-9a-f]{24}\.svg\n {2}Content-Type: image\/svg\+xml\n {2}X-Content-Type-Options: nosniff\n/);
		// The diagram picture's .br and .gz copies from the precompress step get the same nosniff and policy.
		expect(text).toMatch(/\/writing\/signed-pictures\/diagram-[0-9a-f]{24}\.svg\.br\n {2}Content-Type: application\/octet-stream\n {2}X-Content-Type-Options: nosniff\n/);
		expect(text).toMatch(/\/writing\/signed-pictures\/diagram-[0-9a-f]{24}\.svg\.gz\n {2}Content-Type: application\/octet-stream\n {2}X-Content-Type-Options: nosniff\n/);
		expect(text.split('\n\n')).toHaveLength(10);
	});

	it('gives the site search the text alternative of each block and none of the controls', async () => {
		// The real indexer the build runs, over the bodies as the server renders them.
		const site = join(scratch, 'search-site');
		for (const id of ['marsh-dawn', 'signed-pictures', 'drawing-orbits']) {
			await mkdir(join(site, id), { recursive: true });
			await writeFile(
				join(site, id, 'index.html'),
				`<!doctype html><html lang="en"><head><title>${id}</title></head><body><main data-pagefind-body>${body(id)}</main></body></html>`,
			);
		}
		const pagefind = spawnSync(process.execPath, [resolve('node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs'), '--site', site], {
			encoding: 'utf8',
		});
		expect(pagefind.status, pagefind.stderr || pagefind.stdout).toBe(0);
		const indexed = new Map<string, string>();
		const fragments = join(site, 'pagefind', 'fragment');
		for (const name of await readdir(fragments)) {
			const bytes = await readFile(join(fragments, name));
			const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8');
			const fragment = JSON.parse(text.slice(text.indexOf('{'))) as { url: string; content: string };
			indexed.set(fragment.url, fragment.content);
		}
		const marsh = indexed.get('/marsh-dawn/') ?? '';
		for (const words of [
			'Ripples spread across the water', // the clip's alt text
			'A loop of the water.', // its caption
			'Dawn chorus', // the recording's title
			'Invented birdsong over still water.', // its description
			'A single dot for the reeds', // the figure's alt text
			'A single dot for a heron', // a photo's alt text
			'A single dot for the boardwalk', // the video poster's alt text
			'A walk along the boardwalk', // the video's title
		]) {
			expect(marsh, words).toContain(words);
		}
		expect(marsh).not.toContain('Play the clip');
		expect(marsh).not.toContain('Play video');
		expect(marsh).not.toContain('Dawn chorusDawn chorus');
		const diagram = indexed.get('/signed-pictures/') ?? '';
		expect(diagram).toContain('A draft goes to review');
		expect(diagram).toContain('A draft moves to review, then the owner approves it.');
		expect(diagram).not.toContain('flowchart');
		expect(diagram).not.toContain('<');
		// The TeX source beside a formula is not indexed as words.
		expect(indexed.get('/drawing-orbits/') ?? '').not.toContain('\\frac');
	});
});
