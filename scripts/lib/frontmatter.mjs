/**
 * frontmatter.mjs — Shared minimal YAML frontmatter parser.
 *
 * Used by collect-external-posts.mjs and validate-blog-dates.mjs (and
 * anything else that needs to read post frontmatter without pulling in a
 * full YAML library).
 *
 * Supports:
 *  - string, boolean, number, null scalars
 *  - inline arrays: [a, b, c]
 *  - single- and double-quoted values
 *  - comment lines (#)
 */

/**
 * Strip surrounding quotes from a string value.
 * @param {string} s
 * @returns {string}
 */
export function stripQuotes(s) {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

/**
 * Parse a scalar YAML value into its JS equivalent.
 * @param {string} val  Raw value string (already trimmed)
 * @returns {string|number|boolean|null|string[]}
 */
export function parseValue(val) {
	if (val === 'true') return true;
	if (val === 'false') return false;
	if (val === '' || val === 'null' || val === '~') return null;
	if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
	if (val.startsWith('[') && val.endsWith(']')) {
		const inner = val.slice(1, -1);
		if (inner.trim() === '') return [];
		return inner.split(',').map((s) => stripQuotes(s.trim()));
	}
	return stripQuotes(val);
}

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * Returns an object of key/value pairs, or null if no frontmatter block
 * is found.
 *
 * @param {string} raw  Full markdown file content
 * @returns {Record<string, any> | null}
 */
export function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;
	const yaml = match[1];
	const result = {};
	for (const line of yaml.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const kvMatch = trimmed.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) continue;
		const [, key, rawVal] = kvMatch;
		result[key] = parseValue(rawVal.trim());
	}
	return result;
}
