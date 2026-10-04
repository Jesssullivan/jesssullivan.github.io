import { describe, expect, it } from 'vitest';
import { compile } from 'mdsvex';
import { splitMarkdownFences } from './markdownFences';
import { compileReviewedComponentMarkdown, renderReviewedComponentsForRuntime } from './reviewedComponents';

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

	it.each(['\r', '\n', '\r\n'])('preserves %j fence boundaries and exact original source bytes', (ending) => {
		const before = `Before${ending}`;
		const code = `~~~svx${ending}<script>{literal}</script>${ending}~~~${ending}`;
		const after = 'After';
		const segments = splitMarkdownFences(before + code + after);
		expect(segments).toEqual([
			{ markdown: before }, { markdown: code, fenceInfo: 'svx' }, { markdown: after },
		]);
		expect(segments.map((segment) => segment.markdown).join('')).toBe(before + code + after);
	});

	it('rejects bare-CR fence escape that the real mdsvex compiler preserves as executable source', async () => {
		const source = '~~~\nexample\n~~~\r<script>const proof = 1;</script>\n<InlineDisclosure label="Real">Body</InlineDisclosure>';
		const compiled = await compile(source);
		expect(compiled?.code).toContain('<script>const proof = 1;</script>');
		expect(compiled?.code).toContain('<InlineDisclosure label="Real">');
		expect(() => compileReviewedComponentMarkdown(source)).toThrow('raw HTML or unknown components');
		expect(() => renderReviewedComponentsForRuntime(source)).toThrow('raw HTML or unknown components');
	});

	it('keeps code literal but recognizes a real disclosure after a bare-CR fence close', async () => {
		const code = '~~~svx\r<script>const proof = 1;</script>\r~~~\r';
		const real = '<InlineDisclosure label="Real">Body</InlineDisclosure>';
		const compiledCode = await compile(code);
		expect(compiledCode?.code).not.toContain('<script>const proof = 1;</script>');
		expect(compiledCode?.code).toContain('&lt;script');
		expect(compileReviewedComponentMarkdown(code + real)).toEqual({ markdown: code + real, imports: ['InlineDisclosure'] });
		expect(renderReviewedComponentsForRuntime(code + real)).toBe(
			code + '<details data-reviewed-component="InlineDisclosure" open><summary>Real</summary>Body</details>',
		);
	});
});
