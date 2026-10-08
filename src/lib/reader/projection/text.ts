/**
 * Text reduction for the posts projection (TIN-5680).
 *
 * A TypeScript port of spear_resumes `profile/refresh/text.py` (main
 * 1b8b27863f90): markup, code, URLs, numbers and stopwords are dropped and
 * the top TERMS_PER_POST lower-case terms are kept. Pure and deterministic:
 * ordering uses code-point comparison, never locale collation.
 */

export const TERMS_PER_POST = 120;

export const STOP: ReadonlySet<string> = new Set(
	`a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have
having he her here hers him his how i if in into is it its itself just me more most my myself no nor
not now of off on once only or other our ours out over own same she should so some such than that the
their theirs them then there these they this those through to too under until up very was we were what
when where which while who whom why will with would you your yours yourself use used using via see
get got make makes made one two three new like may might must need needs also etc eg ie yes true false
http https www com org io net html htm md png jpg jpeg gif svg img src alt href width height align
center div br span td tr th table style class id readme license licensed mit apache copyright github
githubusercontent raw blob main master branch tree badge badges shields build status npm yarn pnpm
install installation run running usage example examples note notes todo todos please thanks thank
file files dir directory folder line lines code sh bash shell cd git clone
don didn doesn isn wasn won aren couldn shouldn wouldn haven hasn
really pretty much lot lots bit thing things stuff way well still even back going want know think
`.split(/\s+/).filter(Boolean),
);

const TOKEN = /[a-z][a-z0-9+#]*(?:[-_.][a-z0-9+#]+)*/g;

export function codePointCompare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function stripEdges(token: string): string {
	return token.replace(/^[-_.]+/, '').replace(/[-_.]+$/, '');
}

function digitCount(token: string): number {
	let count = 0;
	for (const ch of token) if (ch >= '0' && ch <= '9') count += 1;
	return count;
}

/** Remove front matter, code, Svelte/HTML blocks, link targets and bare URLs. */
export function stripPostMarkup(source: string): string {
	return source
		.replace(/^---[\s\S]*?\n---/, ' ')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/~~~[\s\S]*?~~~/g, ' ')
		.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
		.replace(/`[^`\n]*`/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\]\([^)]*\)/g, '] ')
		.replace(/https?:\/\/\S+/g, ' ');
}

/** Body text to its top lower-case term counts (spear `readme_terms`). */
export function bodyTerms(source: string, limit = TERMS_PER_POST): Record<string, number> {
	const counts = new Map<string, number>();
	for (const match of stripPostMarkup(source).toLowerCase().matchAll(TOKEN)) {
		const token = stripEdges(match[0]);
		if (token.length < 3 || token.length > 24 || STOP.has(token)) continue;
		if (digitCount(token) > 2) continue;
		counts.set(token, (counts.get(token) ?? 0) + 1);
	}
	const top = [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || codePointCompare(a[0], b[0]))
		.slice(0, limit)
		.sort((a, b) => codePointCompare(a[0], b[0]));
	return Object.fromEntries(top);
}

/** Title / description / tag tokens (same rules as body terms, no cap). */
export function tokens(text: string): string[] {
	const out: string[] = [];
	for (const match of text.toLowerCase().matchAll(TOKEN)) {
		const token = stripEdges(match[0]);
		if (token.length >= 3 && !STOP.has(token)) out.push(token);
	}
	return out;
}
