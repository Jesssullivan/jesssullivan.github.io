import { describe, expect, it } from 'vitest';
import { splitMarkdownFences } from './markdownFences';

describe('shared top-level Markdown fence boundaries', () => {
	it('preserves exact bytes, including CRLF and longer closing markers', () => {
		const before = 'Before\r\n';
		const code = '  ~~~ts\r\nconst x = 1;\r\n ~~~~\t\r\n';
		const after = 'After';
		const segments = splitMarkdownFences(before + code + after);
		expect(segments).toEqual([
			{ markdown: before }, { markdown: code, fenceInfo: 'ts' }, { markdown: after },
		]);
		expect(segments.map((segment) => segment.markdown).join('')).toBe(before + code + after);
	});

	it.each(['Inline ```ts', '    ```ts', '```ts `invalid-info`'])('does not classify %s as a fence opening', (markdown) => {
		expect(splitMarkdownFences(markdown)).toEqual([{ markdown }]);
	});

	it('does not close a code block on a fence line with trailing prose', () => {
		const code = '~~~ts\n~~~ not a close\nconst x = 1;\n~~~\n';
		expect(splitMarkdownFences(code + 'After')).toEqual([
			{ markdown: code, fenceInfo: 'ts' }, { markdown: 'After' },
		]);
	});

	it('distinguishes empty-info code from prose and accepts an EOF fence', () => {
		expect(splitMarkdownFences('~~~\ncode')).toEqual([{ markdown: '~~~\ncode', fenceInfo: '' }]);
		expect(splitMarkdownFences('')).toEqual([]);
	});
});
