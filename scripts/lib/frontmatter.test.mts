import { describe, expect, it } from 'vitest';
import { parseFrontmatter, parseValue, stripQuotes } from './frontmatter.mts';

// TIN-8628: escaped quotes in a title reached the reader as literal backslashes.
describe('stripQuotes', () => {
	it('undoes the escapes of a double-quoted YAML scalar', () => {
		expect(stripQuotes('"Gallery of \\"Warblers in the Hand\\""')).toBe('Gallery of "Warblers in the Hand"');
		expect(stripQuotes('"C:\\\\path"')).toBe('C:\\path');
	});

	it('undoes the doubled quote of a single-quoted YAML scalar', () => {
		expect(stripQuotes("'Jess''s notes'")).toBe("Jess's notes");
	});

	it('leaves plain scalars and a lone quote alone', () => {
		expect(stripQuotes('plain \\"text\\"')).toBe('plain \\"text\\"');
		expect(stripQuotes('"')).toBe('"');
	});
});

describe('parseFrontmatter', () => {
	it('reads a title with escaped quotes as YAML does', () => {
		const meta = parseFrontmatter('---\ntitle: "Gallery of \\"Warblers in the Hand\\""\npublished: true\n---\nBody');
		expect(meta?.title).toBe('Gallery of "Warblers in the Hand"');
		expect(meta?.published).toBe(true);
	});

	it('unescapes quoted items in a flow list', () => {
		expect(parseValue('["a \\"b\\"", \'c\']')).toEqual(['a "b"', 'c']);
	});
});
