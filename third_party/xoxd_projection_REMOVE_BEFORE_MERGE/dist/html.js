// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * Consumer rule 8: rendered HTML holds no active content. It refuses a script
 * element, an event handler attribute and a javascript: URL in any attribute,
 * also inside the nested document of a srcdoc attribute. It reads start tags
 * as a browser does and errs toward refusal: a match inside a comment counts.
 */
import { decodeUtf8 } from './bytes.js';
import { finding } from './findings.js';

const ENTITY = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z]+));?/g;

/**
 * The named references that matter here: those that spell a URL scheme
 * separator or whitespace, and those that spell markup inside a srcdoc
 * document. Names match without case, which only widens what is refused.
 */
const NAMED                                   = {
	colon: ':',
	tab: '\t',
	newline: '\n',
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

function decodeEntities(value        )         {
	return value.replace(ENTITY, (whole        , decimal         , hexDigits         , name         ) => {
		const code =
			decimal !== undefined ? Number(decimal) : hexDigits !== undefined ? Number.parseInt(hexDigits, 16) : undefined;
		if (code !== undefined) return code <= 0x10ffff ? String.fromCodePoint(code) : '';
		return NAMED[name?.toLowerCase() ?? ''] ?? whole;
	});
}

/** Control characters, space and DEL. A browser skips them inside a URL scheme. */
// eslint-disable-next-line no-control-regex
const URL_IGNORED = /[\u0000- \u007f]/gu;

/** The whitespace of the HTML tokenizer: tab, line feed, form feed, carriage return and space. */
const isSpace = (char                    )          =>
	char === '\t' || char === '\n' || char === '\f' || char === '\r' || char === ' ';

/**
 * Reads the start tag that begins at html[start] ('<' then an ASCII letter)
 * with the tag states of the WHATWG HTML tokenizer. A quote opens a quoted
 * value only right after '='. Anywhere else it is an ordinary character of a
 * name or an unquoted value, as a browser reads it. Returns null when the
 * input ends inside the tag, since a browser then drops the tag.
 */
function readStartTag(html        , start        )                  {
	let pos = start + 1;
	let name = '';
	while (pos < html.length && !isSpace(html[pos]) && html[pos] !== '/' && html[pos] !== '>') name += html[pos++];
	const attributes                                                = [];
	for (;;) {
		while (isSpace(html[pos]) || html[pos] === '/') pos += 1;
		if (pos >= html.length) return null;
		if (html[pos] === '>') return { name: name.toLowerCase(), attributes };
		// An attribute name. Its first character may be '='.
		let attribute = html[pos++];
		while (pos < html.length && !isSpace(html[pos]) && !'/>='.includes(html[pos])) attribute += html[pos++];
		while (isSpace(html[pos])) pos += 1;
		if (html[pos] !== '=') {
			attributes.push({ name: attribute.toLowerCase(), value: null });
			continue;
		}
		pos += 1;
		while (isSpace(html[pos])) pos += 1;
		let value = '';
		const quote = html[pos];
		if (quote === '"' || quote === "'") {
			const end = html.indexOf(quote, pos + 1);
			if (end < 0) return null;
			value = html.slice(pos + 1, end);
			pos = end + 1;
		} else {
			while (pos < html.length && !isSpace(html[pos]) && html[pos] !== '>') value += html[pos++];
		}
		attributes.push({ name: attribute.toLowerCase(), value });
	}
}

function checkMarkup(html        , at        , out                     )       {
	if (/<script(?=[\s/>]|$)/i.test(html)) out.push(finding('html_script', at, 'holds a script element'));
	// Every '<' and letter starts a scan, so a tag a browser reads is never
	// hidden by a quote or a comment before it. Text that only looks like a
	// tag can add a finding, never remove one.
	for (const open of html.matchAll(/<[A-Za-z]/g)) {
		const tag = readStartTag(html, open.index ?? 0);
		if (tag === null) continue;
		for (const { name, value } of tag.attributes) {
			const where = `${at} <${tag.name} ${name}>`;
			if (/^on[a-z]/.test(name)) out.push(finding('html_event_handler', where, 'event handler'));
			if (value === null) continue;
			const decoded = decodeEntities(value);
			const compact = decoded.replace(URL_IGNORED, '').toLowerCase();
			// The scheme counts at any position in a value: a meta refresh reads
			// its URL after the delay with or without "url=", and an SVG animate
			// "values" list sets an href to each item in turn.
			if (compact.includes('javascript:')) out.push(finding('html_javascript_url', where, 'javascript: URL'));
			// srcdoc holds a whole nested document that runs as the page's own
			// origin, so its markup gets the same checks.
			if (name === 'srcdoc') checkMarkup(decoded, where, out);
		}
	}
}

/** Checks one rendered HTML blob. An empty list passes. */
export function checkHtml(htmlBytes            , at = 'html')                      {
	const html = decodeUtf8(htmlBytes);
	if (html === null) return [finding('html_not_utf8', at, 'the HTML blob is not UTF-8')];
	const out                      = [];
	checkMarkup(html, at, out);
	return out;
}
