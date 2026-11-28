/**
 * Reads the HTML the hub rendered for a note and writes the two forms this
 * site needs beside the page itself.
 *
 * The hub renders every block, and the xoxd_projection module verified those
 * bytes: their sha256, and that they hold no script, no event handler and no
 * javascript: URL. The hub's last render step is an allowlist serializer, so
 * the HTML is well formed, with quoted attributes and escaped text. This
 * module reads it with a small tokenizer and changes nothing it does not
 * name. It fails the build when the HTML and the typed blocks disagree, so a
 * change in the hub's markup is seen and never guessed at.
 *
 * pageHtml adds search hints: the alt text of a clip is indexed, and the
 * words of a control are not. feedHtml is the body for a feed: a clip, a
 * recording, a video file and a diagram with no picture become their text
 * alternative, and every site path becomes a full address.
 *
 * It needs standard JavaScript only, so the browser tests can load it too.
 */

/** The media a body block names. It is the part of an attachment ref this module reads. */
export interface MediaRef {
	readonly path: string;
}

/** The typed blocks this module reads. Every other block passes through as the hub rendered it. */
export type MediaBlock =
	| { readonly type: 'clip'; readonly video: MediaRef | null; readonly alt: string; readonly caption: string | null }
	| {
			readonly type: 'recording';
			readonly audio: MediaRef | null;
			readonly title: string;
			readonly description: string | null;
	  }
	| { readonly type: 'video'; readonly video: MediaRef | null; readonly host: string; readonly title: string }
	| {
			readonly type: 'diagram';
			readonly picture: MediaRef | null;
			readonly alt: string;
			readonly description: string | null;
	  }
	| { readonly type: string };

/** The hub's HTML and the typed blocks do not describe the same body. */
export class NoteHtmlError extends Error {}

/** One attribute of a start tag. start and end bound its value inside the tag's raw text. */
interface Attribute {
	readonly value: string | null;
	readonly start: number;
	readonly end: number;
}

type Token =
	| { readonly kind: 'text'; readonly raw: string }
	| { readonly kind: 'open'; readonly raw: string; readonly name: string; readonly attributes: ReadonlyMap<string, Attribute> }
	| { readonly kind: 'close'; readonly raw: string; readonly name: string };

const isSpace = (char: string | undefined): boolean =>
	char === ' ' || char === '\t' || char === '\n' || char === '\f' || char === '\r';

/** Reads the start tag that begins at html[start]. Returns the token and the index after its '>'. */
function readStartTag(html: string, start: number): [Token, number] {
	let pos = start + 1;
	let name = '';
	while (pos < html.length && !isSpace(html[pos]) && html[pos] !== '/' && html[pos] !== '>') name += html[pos++];
	const attributes = new Map<string, Attribute>();
	for (;;) {
		while (isSpace(html[pos]) || html[pos] === '/') pos += 1;
		if (pos >= html.length) throw new NoteHtmlError('the note HTML ends inside a tag');
		if (html[pos] === '>') {
			return [{ kind: 'open', raw: html.slice(start, pos + 1), name: name.toLowerCase(), attributes }, pos + 1];
		}
		let attribute = '';
		while (pos < html.length && !isSpace(html[pos]) && !'/>='.includes(html[pos])) attribute += html[pos++];
		if (attribute === '') throw new NoteHtmlError('the note HTML holds a tag this site cannot read');
		while (isSpace(html[pos])) pos += 1;
		if (html[pos] !== '=') {
			attributes.set(attribute.toLowerCase(), { value: null, start: 0, end: 0 });
			continue;
		}
		pos += 1;
		while (isSpace(html[pos])) pos += 1;
		const quote = html[pos];
		// The hub's serializer quotes every value. An unquoted one is not its output.
		if (quote !== '"' && quote !== "'") throw new NoteHtmlError('the note HTML holds an unquoted attribute value');
		const end = html.indexOf(quote, pos + 1);
		if (end === -1) throw new NoteHtmlError('the note HTML ends inside an attribute value');
		attributes.set(attribute.toLowerCase(), {
			value: html.slice(pos + 1, end),
			start: pos + 1 - start,
			end: end - start,
		});
		pos = end + 1;
	}
}

/** The tokens of the hub's HTML. Joining their raw text gives the input back. */
function tokenize(html: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;
	while (pos < html.length) {
		const open = html.indexOf('<', pos);
		if (open === -1) {
			tokens.push({ kind: 'text', raw: html.slice(pos) });
			break;
		}
		if (open > pos) tokens.push({ kind: 'text', raw: html.slice(pos, open) });
		const next = html[open + 1] ?? '';
		if (/[A-Za-z]/.test(next)) {
			const [token, after] = readStartTag(html, open);
			tokens.push(token);
			pos = after;
		} else if (next === '/' && /[A-Za-z]/.test(html[open + 2] ?? '')) {
			const end = html.indexOf('>', open);
			if (end === -1) throw new NoteHtmlError('the note HTML ends inside an end tag');
			const name = html.slice(open + 2, end).trim().toLowerCase();
			tokens.push({ kind: 'close', raw: html.slice(open, end + 1), name });
			pos = end + 1;
		} else {
			// The hub escapes every '<' in text and writes no comment or doctype.
			throw new NoteHtmlError('the note HTML holds markup this site cannot read');
		}
	}
	return tokens;
}

function hasClass(token: Token, name: string): boolean {
	if (token.kind !== 'open') return false;
	return (token.attributes.get('class')?.value ?? '').split(/\s+/).includes(name);
}

/** Text for an HTML element or a quoted attribute. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** A start tag with attributes added before its end. */
function withAttributes(token: Token, extra: string): string {
	return `${token.raw.slice(0, -1).replace(/\s*\/?$/, '')} ${extra}>`;
}

/** The index of the end tag that closes the element opened at tokens[start]. */
function closeOf(tokens: readonly Token[], start: number): number {
	const { name } = tokens[start] as Extract<Token, { kind: 'open' }>;
	let depth = 0;
	for (let index = start; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.kind === 'open' && token.name === name) depth += 1;
		else if (token.kind === 'close' && token.name === name) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	throw new NoteHtmlError(`the note HTML never closes a ${name} element`);
}

/** Hands out the typed blocks of one kind in body order, and checks that all were used. */
class BlockQueue<B> {
	private next = 0;
	private readonly blocks: readonly B[];
	private readonly what: string;

	constructor(blocks: readonly B[], what: string) {
		this.blocks = blocks;
		this.what = what;
	}

	take(): B {
		const block = this.blocks[this.next];
		if (block === undefined) throw new NoteHtmlError(`the note HTML holds more ${this.what} than its blocks do`);
		this.next += 1;
		return block;
	}

	done(): void {
		if (this.next !== this.blocks.length) {
			throw new NoteHtmlError(`the note blocks hold ${this.blocks.length} ${this.what} and the HTML holds ${this.next}`);
		}
	}
}

type Clip = Extract<MediaBlock, { type: 'clip' }>;
type Recording = Extract<MediaBlock, { type: 'recording' }>;
type Video = Extract<MediaBlock, { type: 'video' }>;
type Diagram = Extract<MediaBlock, { type: 'diagram' }>;

const isClip = (block: MediaBlock): block is Clip => block.type === 'clip';
const isRecording = (block: MediaBlock): block is Recording => block.type === 'recording';
const isVideo = (block: MediaBlock): block is Video => block.type === 'video';
const isDiagram = (block: MediaBlock): block is Diagram => block.type === 'diagram';

/** The blocks the hub renders as a media element, in body order. A block with no ref renders as a notice. */
function mediaQueues(blocks: readonly MediaBlock[]) {
	return {
		clips: new BlockQueue(blocks.filter(isClip).filter((block) => block.video !== null), 'clips'),
		recordings: new BlockQueue(blocks.filter(isRecording).filter((block) => block.audio !== null), 'recordings'),
		videos: new BlockQueue(blocks.filter(isVideo).filter((block) => block.video !== null && block.host === 'file'), 'video files'),
		pendingDiagrams: new BlockQueue(blocks.filter(isDiagram).filter((block) => block.picture === null), 'diagrams with no picture'),
	};
}

/**
 * The body for the note page: the hub's HTML with search hints added. The
 * site search indexes text and, by default, no attribute. With the hints it
 * also indexes the alt text of each image (a figure, a photo, a diagram
 * picture and a video poster), the alt text of a clip, which the hub writes
 * as the video's aria-label, and the alt text of a diagram that has no
 * picture yet. It skips the words of the clip button and of the play label,
 * the link a browser shows only when it cannot play a sound or a video, the
 * TeX source beside a formula and the source of a diagram with no picture.
 * Nothing a reader sees or hears changes.
 */
export function pageHtml(html: string, blocks: readonly MediaBlock[]): string {
	const tokens = tokenize(html);
	const queues = mediaQueues(blocks);
	let out = '';
	let pendingDiagramEnd = -1;
	let playerEnd = -1;
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.kind !== 'open') {
			out += token.raw;
			continue;
		}
		if (token.name === 'audio' || token.name === 'video') playerEnd = Math.max(playerEnd, closeOf(tokens, index));
		// Each recording and video file is counted against its block, as the
		// feed body counts them, so a body and blocks that disagree fail here too.
		if (token.name === 'figure' && hasClass(token, 'embed-recording')) queues.recordings.take();
		if (token.name === 'figure' && hasClass(token, 'embed-video')) queues.videos.take();
		if (token.name === 'video' && token.attributes.has('data-clip')) {
			queues.clips.take();
			out += withAttributes(token, 'data-pagefind-index-attrs="aria-label"');
		} else if (token.name === 'img' && (token.attributes.get('alt')?.value ?? '') !== '') {
			out += withAttributes(token, 'data-pagefind-index-attrs="alt"');
		} else if (token.name === 'annotation') {
			// The TeX source the hub keeps beside each MathML formula is not text to search.
			out += withAttributes(token, 'data-pagefind-ignore');
		} else if (token.name === 'a' && index < playerEnd) {
			// The link inside a player is what a browser shows when it cannot play the file.
			out += withAttributes(token, 'data-pagefind-ignore');
		} else if (token.name === 'button' && token.attributes.has('data-clip-toggle')) {
			out += withAttributes(token, 'data-pagefind-ignore');
		} else if (token.name === 'span' && hasClass(token, 'embed-play-label')) {
			out += withAttributes(token, 'data-pagefind-ignore');
		} else if (token.name === 'figure' && hasClass(token, 'embed-diagram') && hasClass(token, 'embed-pending')) {
			const block = queues.pendingDiagrams.take();
			pendingDiagramEnd = closeOf(tokens, index);
			out += withAttributes(token, `aria-label="${escapeHtml(block.alt)}" data-pagefind-index-attrs="aria-label"`);
		} else if (token.name === 'pre' && index < pendingDiagramEnd) {
			out += withAttributes(token, 'data-pagefind-ignore');
		} else {
			out += token.raw;
		}
	}
	queues.clips.done();
	queues.recordings.done();
	queues.videos.done();
	queues.pendingDiagrams.done();
	return out;
}

/** Plain text as paragraphs: a blank line starts a new one. */
function paragraphs(text: string | null): string {
	if (text === null) return '';
	return text
		.split(/\n[ \t]*\n+/u)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
		.map((part) => `<p>${part.split('\n').map(escapeHtml).join('<br>')}</p>`)
		.join('');
}

/** A site path as a full address. Anything else is left as it is. */
function absolute(value: string, origin: string, pageUrl: string): string {
	if (value.startsWith('#')) return `${pageUrl}${value}`;
	if (value.startsWith('/') && !value.startsWith('//')) return `${origin}${value}`;
	return value;
}

const URL_ATTRIBUTES = ['src', 'href', 'poster'];

/** A start tag with each site path in src, href and poster written as a full address. */
function withFullAddresses(token: Extract<Token, { kind: 'open' }>, origin: string, pageUrl: string): string {
	// The values are replaced from the last one back, so the earlier offsets stay right.
	const found = URL_ATTRIBUTES.map((name) => token.attributes.get(name))
		.filter((attribute): attribute is Attribute => attribute !== undefined && attribute.value !== null)
		.sort((a, b) => b.start - a.start);
	let raw = token.raw;
	for (const attribute of found) {
		const full = absolute(attribute.value as string, origin, pageUrl);
		raw = `${raw.slice(0, attribute.start)}${full}${raw.slice(attribute.end)}`;
	}
	return raw;
}

/**
 * The body for a feed item. A feed reader runs no script and may drop a
 * media element, so each one is written as its text alternative:
 * - a clip is its alt text, linked to the video file, then its caption,
 * - a recording is its title, linked to the sound file, then its description,
 * - a video file is its title, linked to the file,
 * - a diagram with no picture yet is its alt text and description, never its source.
 * A figure, a photo set, a diagram picture and a video poster stay images
 * with their alt text. Every site path becomes a full address under origin.
 */
export function feedHtml(html: string, blocks: readonly MediaBlock[], origin: string, pageUrl: string): string {
	const tokens = tokenize(html);
	const queues = mediaQueues(blocks);
	const full = (path: string): string => escapeHtml(`${origin}${path}`);
	let out = '';
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.kind !== 'open') {
			out += token.raw;
			continue;
		}
		if (token.name === 'figure' && hasClass(token, 'embed-clip')) {
			const block = queues.clips.take();
			const video = block.video as MediaRef;
			out += `<p><a href="${full(video.path)}">${escapeHtml(block.alt)}</a> (silent video clip)</p>${paragraphs(block.caption)}`;
			index = closeOf(tokens, index);
		} else if (token.name === 'figure' && hasClass(token, 'embed-recording')) {
			const block = queues.recordings.take();
			const audio = block.audio as MediaRef;
			out += `<p><a href="${full(audio.path)}">${escapeHtml(block.title)}</a> (audio recording)</p>${paragraphs(block.description)}`;
			index = closeOf(tokens, index);
		} else if (token.name === 'figure' && hasClass(token, 'embed-video')) {
			const block = queues.videos.take();
			const video = block.video as MediaRef;
			out += `<p><a href="${full(video.path)}">${escapeHtml(block.title)}</a> (video)</p>`;
			index = closeOf(tokens, index);
		} else if (token.name === 'figure' && hasClass(token, 'embed-diagram') && hasClass(token, 'embed-pending')) {
			const block = queues.pendingDiagrams.take();
			out += `<p>${escapeHtml(block.alt)}</p>${paragraphs(block.description)}`;
			index = closeOf(tokens, index);
		} else {
			out += withFullAddresses(token, origin, pageUrl);
		}
	}
	queues.clips.done();
	queues.recordings.done();
	queues.videos.done();
	queues.pendingDiagrams.done();
	return out;
}

/** The media and control elements a feed body must not carry. feedHtml leaves none of them. */
const FEED_REFUSED = new Set(['video', 'audio', 'source', 'button', 'iframe']);

/** The names of the media and control elements a body holds, in order. Tests read it. */
export function mediaElements(html: string): string[] {
	return tokenize(html)
		.filter((token) => token.kind === 'open' && FEED_REFUSED.has(token.name))
		.map((token) => (token as Extract<Token, { kind: 'open' }>).name);
}
