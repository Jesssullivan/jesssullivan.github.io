import { describe, expect, it } from 'vitest';
import {
	compileReviewedComponentMarkdown,
	reviewedComponentImportBlock,
	renderReviewedComponentsForRuntime,
	validateReviewedComponentMarkdown,
} from './reviewedComponents';

const reviewedDocument = `## Repair notes

<InlineDisclosure label="Show the tested command" defaultOpen={false}>

\`\`\`sh
nix develop --command npm run check
\`\`\`

The command stays visible until hydration applies the reviewed closed preference.

</InlineDisclosure>`;

describe('reviewed interactive SVX components', () => {
	it('accepts a repository-owned InlineDisclosure invocation with Markdown slot content', () => {
		expect(() => validateReviewedComponentMarkdown(reviewedDocument)).not.toThrow();
		expect(compileReviewedComponentMarkdown(reviewedDocument)).toEqual({
			markdown: reviewedDocument,
			imports: ['InlineDisclosure'],
		});
		expect(reviewedComponentImportBlock(['InlineDisclosure'])).toContain(
			"import InlineDisclosure from '$lib/components/InlineDisclosure.svelte';",
		);
	});

	it('permits code examples without treating their source text as document code', () => {
		expect(() =>
			validateReviewedComponentMarkdown('```svelte\n<script>\nimport Demo from \'./Demo.svelte\';\n</script>\n```'),
		).not.toThrow();
	});

	it('permits literal braces in inline code without treating them as Svelte', () => {
		expect(() => validateReviewedComponentMarkdown('Use `{ literal braces }` in the command example.')).not.toThrow();
	});

	it('does not import or transform component syntax shown in a fenced code example', () => {
		const example = '```svx\n<InlineDisclosure label="Example">body</InlineDisclosure>\n```';
		expect(compileReviewedComponentMarkdown(example)).toEqual({ markdown: example, imports: [] });
		expect(renderReviewedComponentsForRuntime(example)).toBe(example);
	});

	it('masks a fence before an earlier inline tick can consume its delimiter', () => {
		const example = '`prefix\n```svx\n<InlineDisclosure label="Example">body</InlineDisclosure>\n```\nsuffix`';
		expect(compileReviewedComponentMarkdown(example)).toEqual({ markdown: example, imports: [] });
		expect(renderReviewedComponentsForRuntime(example)).toBe(example);
	});

	it('preserves adjacent literal opening and closing tags in inline code', () => {
		const example = 'Use `<InlineDisclosure label="Example">` `</InlineDisclosure>` literally.';
		expect(compileReviewedComponentMarkdown(example)).toEqual({ markdown: example, imports: [] });
		expect(renderReviewedComponentsForRuntime(example)).toBe(example);
	});

	it('converts a real disclosure without rewriting inline examples or backticks in its label', () => {
		const mixed = '<InlineDisclosure label="Use `example`">See `<InlineDisclosure label="Literal">` and `</InlineDisclosure>`.</InlineDisclosure>';
		expect(compileReviewedComponentMarkdown(mixed).imports).toEqual(['InlineDisclosure']);
		expect(renderReviewedComponentsForRuntime(mixed)).toBe(
			'<details data-reviewed-component="InlineDisclosure" open><summary>Use `example`</summary>See `<InlineDisclosure label="Literal">` and `</InlineDisclosure>`.</details>',
		);
	});

	it('does not treat multi-backtick text as a new reviewed component grammar', () => {
		const text = 'Use ``code with `backticks` `` as prose.';
		expect(renderReviewedComponentsForRuntime(text)).toBe(text);
		const balanced = 'Use ``<InlineDisclosure label="Example">body</InlineDisclosure>`` literally.';
		// The v1 validator already admits this balanced form; runtime must not
		// turn its literal code example into an interactive disclosure.
		expect(renderReviewedComponentsForRuntime(balanced)).toBe(balanced);
		expect(() => validateReviewedComponentMarkdown('Use ``<InlineDisclosure label="Not admitted">`` literally.'))
			.toThrow('InlineDisclosure has no closing tag');
	});

	it('converts the reviewed invocation to native disclosure markup for runtime broker enhancement', () => {
		expect(renderReviewedComponentsForRuntime(reviewedDocument)).toContain(
			'<details data-reviewed-component="InlineDisclosure"><summary>Show the tested command</summary>',
		);
		expect(renderReviewedComponentsForRuntime(reviewedDocument)).toContain('</details>');
	});

	it('rejects raw tags on every call, including after a valid document', () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(() => validateReviewedComponentMarkdown('<script>'))
				.toThrow('raw HTML or unknown components');
		}
		expect(() => validateReviewedComponentMarkdown('<InlineDisclosure label="Valid">Body</InlineDisclosure>'))
			.not.toThrow();
		expect(() => validateReviewedComponentMarkdown('<img src="/unreviewed.png">'))
			.toThrow('raw HTML or unknown components');
	});

	it.each([
		['an unknown component', '<DangerButton label="nope">x</DangerButton>', 'raw HTML or unknown components'],
		['component source', '<script>export let anything;</script>', 'raw HTML or unknown components'],
		['an event handler', '<InlineDisclosure label="x" onclick={run}>x</InlineDisclosure>', 'only label and defaultOpen'],
		['an import statement', 'import Danger from \'./Danger.svelte\';', 'module statements'],
		['an unsafe Svelte directive', '{@html userContent}', 'Svelte expressions or control blocks'],
		['a malformed prop', '<InlineDisclosure label={unsafe}>x</InlineDisclosure>', 'only label and defaultOpen'],
		['an interpolation', '<InlineDisclosure label="x">{process.env.SECRET}</InlineDisclosure>', 'Svelte expressions or control blocks'],
		['a control block', '<InlineDisclosure label="x">{#if true}x{/if}</InlineDisclosure>', 'Svelte expressions or control blocks'],
		['an expression attribute', '<InlineDisclosure label="x"><img src={expression}></InlineDisclosure>', 'Svelte expressions or control blocks'],
		['an attach directive', '<InlineDisclosure label="x">{@attach handler}</InlineDisclosure>', 'Svelte expressions or control blocks'],
		['a spread attribute', '<InlineDisclosure {...props} label="x">x</InlineDisclosure>', 'only label and defaultOpen'],
		['an unclosed component', '<InlineDisclosure label="x">x', 'no closing tag'],
		[
			'a nested component',
			'<InlineDisclosure label="outer"><InlineDisclosure label="inner">x</InlineDisclosure></InlineDisclosure>',
			'nested InlineDisclosure',
		],
	])('rejects %s', (_name, markdown, expected) => {
		expect(() => validateReviewedComponentMarkdown(markdown)).toThrow(expected);
	});
});
