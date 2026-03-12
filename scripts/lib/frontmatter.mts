/**
 * frontmatter.mts — Shared minimal YAML frontmatter parser (TypeScript).
 *
 * Self-contained implementation — no external dependencies.
 */

export const POST_CATEGORIES = [
	"hardware", "software", "ecology", "music",
	"photography", "personal", "tutorial", "devops",
] as const;

export function stripQuotes(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

export function parseValue(val: string): string | number | boolean | null | string[] {
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

export function parseFrontmatter(raw: string): Record<string, any> | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;
	const yaml = match[1];
	const result: Record<string, any> = {};
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
