/**
 * The excerpt of a post in the home stream (TIN-8657, ruling RM70).
 *
 * An excerpt is her own text cut shorter, or it is absent. Nothing here writes a word, joins two
 * sentences that were apart, or mends one. It keeps a run of whole sentences that stand next to
 * each other in her text, and it drops what the old export left behind: stray marks at the start,
 * a link that lost its address, a line cut off in the middle.
 *
 * A summary she wrote by hand is cut at a sentence end. A summary the old export cut from the top
 * of the post by count of letters is not used: her first sentences of prose are read from the post itself.
 */

/** The longest excerpt, in characters. A first sentence may be longer, up to `LONGEST`. */
export const EXCERPT_MAX = 240;
const LONGEST = 300;
/** How far into a post the excerpt may start, in sentences. */
const REACH = 12;

const PICTO = '(?:\\p{Extended_Pictographic}\\uFE0F?)';
/** Marks the export left at the start of a line: dots, a question mark, a colon, a dash, a bullet, a small picture. */
const STRAY = new RegExp(`^(?:[\\s.…?!:;,\\-–—•·*|>_=]|${PICTO})+`, 'u');
/** Where a sentence ends: its mark, a closing quote or bracket, and a small picture or a smile after it. */
const AFTER = `["'”’)\\]]*(?:\\s*(?:${PICTO}|[:;]-?\\)))*`;
const ENDS = new RegExp(`[.!?…]+${AFTER}\\s*$`, 'u');
/**
 * Where one sentence ends and the next begins: a single full stop, or question and exclamation marks, and then a capital or a figure.
 * A row of dots is her pause and ends nothing, as in "working with.... KML data". A row of dots that opens the next words does.
 */
const BOUNDARY = new RegExp(`((?:(?<![.…])\\.(?![.…])|[!?]+)${AFTER})\\s+(?=["“'‘(\\[]?[\\p{Lu}\\p{N}])|()\\s+(?=(?:\\.{2,}|…)\\s*\\p{Lu})`, 'gu');
/** A word with a full stop that does not end a sentence. A single letter is an initial. */
const SHORT_FORMS = new Set(['e.g', 'i.e', 'vs', 'w', 'pt', 'dr', 'mr', 'mrs', 'ms', 'st', 'no', 'fig', 'approx', 'ca', 'cf', 'inc', 'jr', 'sr']);
const ADDRESS = /https?:\/\/|\bwww\.\S/i;
/** What a player leaves in the text where it stood: a name, a middle dot, a title. And what a table leaves: its cells, with bars between. */
const PLAYER = /\s[·|]\s/;
/** A sentence that only points: at a link that is gone, or at the day the post was changed. */
const POINTS = /\bhere\b[\s\p{P}\p{S}]*$|^(?:post\s+)?(?:updated?|edit(?:ed)?|pinned)\b/iu;
/** The same at the head of a sentence that goes on after a colon: "Check out this project here: ...". */
const POINTS_FIRST = /^[^.!?:]{0,60}\bhere\s*:\s+(?=["“'‘([]?\p{Lu})/u;
/** A line the export wrote where something was lost. It is not her text. */
const EXPORT_NOTICE = /original WordPress|hosted on WordPress|WordPress migration|migration from WordPress|lost to time|no longer available|disappeared from the web|digital things are impermanent|lost to the digital ether|password-protected/i;
/** Words that say nothing by themselves. */
const SMALL_WORDS = new Set(
	'a an and are as at be by for from here how i in is it its my of on or out post see that the this to was with you your click check link pdf below above'.split(' '),
);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

/** The words of a line of Markdown, with its markup taken off. A link keeps its words and loses its address. */
export function plainText(markdown: string): string {
	const kept: string[] = [];
	const keep = (text: string) => `\uE000${kept.push(text) - 1}\uE001`;
	let text = markdown
		.replace(/<!--[\s\S]*?-->/g, ' ')
		// A character she escaped is hers as written.
		.replace(/\\([^\p{L}\p{N}\s])/gu, (_, char: string) => keep(char))
		.replace(/!\[[^\]]*\]\((?:[^()]|\([^)]*\))*\)/g, ' ')
		.replace(/\[((?:[^\]\\]|\\.)*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
		.replace(/\[((?:[^\]\\]|\\.)*)\]\[[^\]]*\]/g, '$1')
		.replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
		.replace(/`+([^`]*)`+/g, (_, code: string) => keep(code));
	for (let pass = 0; pass < 3; pass += 1) {
		text = text.replace(/(\*{1,3}|~~)(?=\S)([\s\S]*?\S)\1/g, '$2').replace(/(?<![\p{L}\p{N}])(_{1,3})(?=\S)([\s\S]*?\S)\1(?![\p{L}\p{N}])/gu, '$2');
	}
	return text
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
		.replace(/\uE000(\d+)\uE001/g, (_, index: string) => kept[Number(index)])
		.replace(/\s+/g, ' ')
		.trim();
}

export interface Prose {
	text: string;
	/** True when something that is not prose stands between this paragraph and the one before it. */
	apart: boolean;
	/** True when a quotation opened above this paragraph and has not closed. */
	quoted?: boolean;
}

const NOT_PROSE = /^(?:#{1,6}(?:\s|$)|[-*+]\s|\d+[.)]\s|>|\||\{|import\s|export\s|<(?:div|iframe|img|figure|table|script|style|video|audio|blockquote|pre|ul|ol|details|svg|object|embed|p|h[1-6]|hr|br|center|form|section|article)\b)/i;
const COMPONENT = /^<[A-Z]/;
const LONE_LINK = /^[*_\s]*\[(?:[^\]\\]|\\.)*\]\((?:[^()]|\([^)]*\))*\)[*_\s.!:,-]*$/;
/**
 * A note the export set in asterisks where a picture, a recording or a file was lost, in many wordings:
 * "This image has been lost to time", "This space once held an image". Her own emphasis in those posts is set in underscores.
 */
const LOST_THING = /image|photo|audio|recording|pdf|file|download|wordpress|migration|\bweb\b|internet/i;
const LOST_HOW = /no longer|lost|surviv|vanish|disappear|gone quiet|once|was here|moves on|journey|remains|impermanent|forever/i;
const withoutNotes = (text: string) => text.replace(/(?<!\*)(\*{3}|\*)(?!\*)([^*\n]+)\1(?!\*)/g, (whole, _mark: string, inner: string) => (LOST_THING.test(inner) && LOST_HOW.test(inner) ? ' ' : whole));

/**
 * A paragraph set whole in italics or bold that does not end as a sentence ends is a label or a lead-in: "In other tangents...".
 * One that ends with a full stop is her sentence, set in italics.
 */
const ALL_EMPHASIS = /^(\*{1,3}|_{1,3})(?=\S)[\s\S]*\S\1[:…]*$/;
const ENDS_IN_EMPHASIS = /(?:(?<![.…])\.|[!?])["'”’)\]]*(?:\*{1,3}|_{1,3})$/;

const leftOpenQuotes = (text: string) => (text.split('"').length - 1) % 2 === 1 || text.split('“').length !== text.split('”').length;

/** The paragraphs of a post that are prose: no heading, list, table, picture, code, frame or link standing alone. */
export function proseOf(body: string): Prose[] {
	const text = withoutNotes(body)
		.replace(/\r\n?/g, '\n')
		.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t]*\1[^\n]*(?=\n|(?![\s\S]))|(?![\s\S]))/gm, '\n\n\uE002\n\n')
		.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '\n\n\uE002\n\n')
		.replace(/<!--[\s\S]*?-->/g, ' ');
	const prose: Prose[] = [];
	let apart = false;
	// A quotation may open in one paragraph and close in a later one. What stands between is not her text.
	let quoted = false;
	for (const raw of text.split(/\n[ \t]*\n+/)) {
		const block = raw.trim();
		if (!block) continue;
		const lines = block.split('\n');
		const table = block.includes('|') && lines.some((line) => /^[\s|:-]*-{2,}[\s|:-]*$/.test(line));
		const underlined = lines.length > 1 && /^(?:=+|-+)\s*$/.test(lines[lines.length - 1]);
		const code = /^(?: {4}|\t)/.test(raw.replace(/^\n+/, ''));
		const words = plainText(block.replace(/\n/g, ' '));
		const label = ALL_EMPHASIS.test(block) && !ENDS_IN_EMPHASIS.test(block);
		const within = quoted;
		if (block !== '\uE002' && !code && !table && leftOpenQuotes(words)) quoted = !quoted;
		if (block === '\uE002' || code || table || underlined || NOT_PROSE.test(block) || COMPONENT.test(block) || LONE_LINK.test(block) || label || !/\p{L}/u.test(words)) {
			apart = true;
			continue;
		}
		prose.push({ text: words, apart, ...(within ? { quoted: true } : {}) });
		apart = false;
	}
	return prose;
}

/** The sentences of a paragraph, each as she wrote it. The paragraph is cut only where a sentence ends and the next begins. */
export function sentencesOf(text: string): string[] {
	const parts: string[] = [];
	let from = 0;
	for (const match of text.matchAll(BOUNDARY)) {
		const mark = match[1] ?? '';
		const end = match.index + mark.length;
		const word = (/(\S+)$/.exec(text.slice(from, match.index))?.[1] ?? '').replace(/^["“'‘([]+/, '');
		// "Dr. Reitsma" and "Jess S. photography" go on. Only a single full stop is doubted.
		if (mark === '.' && (/^\p{L}$/u.test(word) || SHORT_FORMS.has(word.toLowerCase()))) continue;
		parts.push(text.slice(from, end));
		from = end;
	}
	parts.push(text.slice(from));
	return parts.map((part) => part.trim()).filter(Boolean);
}

const count = (text: string, mark: string) => text.split(mark).length - 1;
/** How many quotations and brackets a text leaves open. A sentence that starts or ends inside one does not stand alone. */
function leftOpen(text: string): number {
	const plain = text.replace(/[:;]-?\)/g, '');
	return (count(text, '"') % 2) + Math.abs(count(text, '“') - count(text, '”')) + Math.abs(count(plain, '(') - count(plain, ')'));
}

/** True when a text reads as words. A line of code that stands as a paragraph does not: too much of it is signs. */
function reads(text: string): boolean {
	const signs = text.replace(/[\p{L}\p{N}\s,.'’‘"“”!?()\-–—:;&…/]|\p{Extended_Pictographic}/gu, '').length;
	return signs <= text.length * 0.04;
}

const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** True when the excerpt tells a reader of the title nothing more. */
export function saysNothingNew(excerpt: string, title: string): boolean {
	const known = new Set(wordsOf(title));
	const fresh = new Set(wordsOf(excerpt).filter((word) => !known.has(word) && !SMALL_WORDS.has(word)));
	return fresh.size < 2;
}

interface Unit {
	text: string;
	/** A whole sentence that can be shown: it ends, and it holds no address and no trace of a player. */
	whole: boolean;
	points: boolean;
	apart: boolean;
}

function unitsOf(prose: Prose[], cutAtEnd?: boolean): Unit[] {
	const units: Unit[] = [];
	for (const [n, paragraph] of prose.entries()) {
		const parts = sentencesOf(paragraph.text);
		let inside = paragraph.quoted === true;
		for (const [i, part] of parts.entries()) {
			const open = leftOpen(part) > 0;
			// A quotation that runs over several sentences: none of them is shown, from where it opens to where it closes.
			const quoted = inside || open;
			if (open) inside = !inside;
			const text = part.replace(STRAY, '').replace(POINTS_FIRST, '').trim();
			if (!text) continue;
			const last = n === prose.length - 1 && i === parts.length - 1;
			// The last words of a summary she wrote stand as she left them. The last words of one cut off by count do not.
			const ends = last && cutAtEnd !== undefined ? !cutAtEnd : ENDS.test(text);
			const shows = !ADDRESS.test(text) && !PLAYER.test(text) && !EXPORT_NOTICE.test(text) && !quoted && reads(text) && text.length <= LONGEST;
			units.push({ text, whole: ends && shows, points: POINTS.test(text), apart: i === 0 && (n === 0 || paragraph.apart) });
		}
	}
	return units;
}

/** The first run of whole sentences that stand together, as long as it fits. */
function runOf(units: Unit[]): string {
	const start = units.slice(0, REACH).findIndex((unit) => unit.whole && !unit.points);
	if (start < 0) return '';
	let run = units[start].text;
	for (const unit of units.slice(start + 1)) {
		if (unit.apart || !unit.whole || unit.points || run.length + 1 + unit.text.length > EXCERPT_MAX) break;
		run += ` ${unit.text}`;
	}
	return run;
}

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * True when the summary is the top of the post cut off by count, as the old export did it.
 * Such a summary was never written: it is the post's own first letters, run together.
 */
export function isCutFromBody(description: string, body: string): boolean {
	const marks = (text: string) => text.replace(/&#?\w+;/g, ' ');
	const cut = letters(marks(description).replace(/(?:\.{3}|…)\s*$/, '')).slice(0, 48);
	if (cut.length < 12) return false;
	const top = letters(
		marks(body)
			// The export's cut left out pictures and the addresses of links.
			.replace(/!\[[^\]]*\]\((?:[^()]|\([^)]*\))*\)/g, ' ')
			.replace(/\]\((?:[^()]|\([^)]*\))*\)/g, ']')
			.replace(/<[^>]+>/g, ' ')
			.slice(0, 6000),
	);
	return top.includes(cut);
}

/** The words of a title, to find it standing again at the head of the text under it. */
function withoutTitle(text: string, title: string): string {
	const head = letters(title);
	if (head.length < 8) return text;
	let seen = '';
	for (let at = 0; at < text.length && seen.length < head.length; at += 1) {
		seen += letters(text[at]);
		if (seen === head) return text.slice(at + 1);
		if (!head.startsWith(seen)) break;
	}
	return text;
}

export function excerptOf(post: { title: string; description: string; body: string }): string {
	const description = post.description.trim();
	const written = description !== '' && !isCutFromBody(description, post.body);
	const cutShort = /(?:\.{3}|…)\s*$/.test(description);
	const prose = written ? [{ text: plainText(description), apart: false }] : proseOf(post.body);
	// The export set the title again above the text. That copy is not an excerpt of anything.
	if (prose.length) prose[0] = { ...prose[0], text: withoutTitle(prose[0].text, post.title) };
	const excerpt = runOf(unitsOf(prose, written ? cutShort : undefined));
	if (wordsOf(excerpt).length < 2 || saysNothingNew(excerpt, post.title)) return '';
	return excerpt;
}
