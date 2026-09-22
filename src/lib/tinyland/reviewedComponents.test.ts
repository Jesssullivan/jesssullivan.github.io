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

	it('converts the reviewed invocation to native disclosure markup for runtime broker enhancement', () => {
		expect(renderReviewedComponentsForRuntime(reviewedDocument)).toContain(
			'<details data-reviewed-component="InlineDisclosure"><summary>Show the tested command</summary>',
		);
		expect(renderReviewedComponentsForRuntime(reviewedDocument)).toContain('</details>');
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
