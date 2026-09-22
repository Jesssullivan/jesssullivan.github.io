/**
 * Portable, reviewed interactive-document syntax.
 *
 * The Tinyland public broker carries Markdown, never Svelte source.  A small
 * reviewed native-SVX invocation is the one exception that can become an
 * interactive component at static-build time. The importer owns the Svelte
 * import; this module deliberately has no mechanism for a document to name a
 * file, pass arbitrary attributes, or provide executable code.
 */

export const REVIEWED_COMPONENT_TOKEN_VERSION = 'tinyland.reviewed-components.v1';

export const REVIEWED_COMPONENT_NAMES = ['InlineDisclosure'] as const;
export type ReviewedComponentName = (typeof REVIEWED_COMPONENT_NAMES)[number];

export type InlineDisclosureProps = Readonly<{
	label: string;
	defaultOpen: boolean;
}>;

export type ReviewedComponentBlock = Readonly<{
	name: 'InlineDisclosure';
	props: InlineDisclosureProps;
	body: string;
}>;

const INLINE_DISCLOSURE_OPEN = /<InlineDisclosure\s+([^>]*?)>/g;
const INLINE_DISCLOSURE_CLOSE = /<\/InlineDisclosure\s*>/g;
const RAW_TAG = /<\/?[A-Za-z][^>]*>/g;

function fail(message: string): never {
	throw new Error(`reviewed component content is invalid: ${message}`);
}

function parseInlineDisclosureProps(raw: string): InlineDisclosureProps {
	// Native SVX surface: <InlineDisclosure label="Read the notes" defaultOpen={true}>.
	// Only quoted label text and an optional literal boolean are accepted.
	const labelFirst = raw.match(/^label=(['"])([^{}<>]*?)\1(?:\s+defaultOpen=\{(true|false)\})?$/);
	const defaultOpenFirst = raw.match(/^defaultOpen=\{(true|false)\}\s+label=(['"])([^{}<>]*?)\2$/);
	if (!labelFirst && !defaultOpenFirst) {
		return fail('InlineDisclosure may contain only label and defaultOpen attributes');
	}
	const label = labelFirst?.[2] ?? defaultOpenFirst?.[3] ?? '';
	const defaultOpen = labelFirst?.[3] ?? defaultOpenFirst?.[1];
	if (label.trim().length === 0 || label.length > 160) {
		return fail('InlineDisclosure label must be a non-empty string of at most 160 characters');
	}

	return { label: label.trim(), defaultOpen: defaultOpen !== 'false' };
}

function documentSurface(markdown: string): string {
	// Code examples are data, including examples that contain import statements
	// or script tags. Only document prose/SVX surface is executable.
	return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

/** Validate the content without changing it. Used before broker data is displayed. */
export function validateReviewedComponentMarkdown(markdown: string): void {
	if (typeof markdown !== 'string') fail('document must be a string');

	const surface = documentSurface(markdown);
	let remainingSurface = surface;
	let depth = 0;
	const events: { at: number; kind: 'open' | 'close'; props?: string }[] = [];
	for (const match of surface.matchAll(INLINE_DISCLOSURE_OPEN)) {
		events.push({ at: match.index ?? 0, kind: 'open', props: match[1] });
	}
	for (const match of surface.matchAll(INLINE_DISCLOSURE_CLOSE)) {
		events.push({ at: match.index ?? 0, kind: 'close' });
	}
	events.sort((a, b) => a.at - b.at);

	for (const event of events) {
		if (event.kind === 'open') {
			if (depth > 0) fail('nested InlineDisclosure components are not supported');
			parseInlineDisclosureProps(event.props ?? '');
			depth += 1;
		} else {
			if (depth === 0) fail('InlineDisclosure closing tag has no opening tag');
			depth -= 1;
		}
	}
	if (depth !== 0) fail('InlineDisclosure has no closing tag');

	INLINE_DISCLOSURE_OPEN.lastIndex = 0;
	INLINE_DISCLOSURE_CLOSE.lastIndex = 0;
	remainingSurface = remainingSurface.replace(INLINE_DISCLOSURE_OPEN, '').replace(INLINE_DISCLOSURE_CLOSE, '');
	if (/[{}]/.test(remainingSurface)) {
		fail('document may not contain Svelte expressions or control blocks');
	}
	if (/^\s*(?:import|export)\s/m.test(remainingSurface)) {
		fail('document may not contain module statements');
	}
	if (RAW_TAG.test(remainingSurface)) {
		fail('document may not contain raw HTML or unknown components');
	}
	RAW_TAG.lastIndex = 0;
}

/**
 * Validates native SVX and records its compiler-owned imports. This is
 * intentionally available only to the static projection importer.
 */
export function compileReviewedComponentMarkdown(markdown: string): {
	readonly markdown: string;
	readonly imports: readonly string[];
} {
	validateReviewedComponentMarkdown(markdown);
	const imports = new Set<string>();
	if (INLINE_DISCLOSURE_OPEN.test(documentSurface(markdown))) imports.add('InlineDisclosure');
	INLINE_DISCLOSURE_OPEN.lastIndex = 0;
	return { markdown, imports: [...imports] };
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * The live broker is enhancement-only, so it cannot compile Svelte. Preserve
 * approved interaction there as native disclosure HTML after the same strict
 * validation. Static projections use `compileReviewedComponentMarkdown` and
 * the hydrated Svelte component instead.
 */
export function renderReviewedComponentsForRuntime(markdown: string): string {
	validateReviewedComponentMarkdown(markdown);
	return markdown
		.split(/(```[\s\S]*?```)/)
		.map((segment, index) => {
			if (index % 2 === 1) return segment;
			INLINE_DISCLOSURE_OPEN.lastIndex = 0;
			INLINE_DISCLOSURE_CLOSE.lastIndex = 0;
			return segment
				.replace(INLINE_DISCLOSURE_OPEN, (_whole, rawProps: string) => {
					const props = parseInlineDisclosureProps(rawProps);
					return `<details data-reviewed-component="InlineDisclosure"${props.defaultOpen ? ' open' : ''}><summary>${escapeHtml(props.label)}</summary>`;
				})
				.replace(INLINE_DISCLOSURE_CLOSE, '</details>');
		})
		.join('');
}

export function reviewedComponentImportBlock(imports: readonly string[]): string {
	if (imports.length === 0) return '';
	if (imports.some((name) => name !== 'InlineDisclosure')) fail('compiler received an unknown component import');
	return `<script>\nimport InlineDisclosure from '$lib/components/InlineDisclosure.svelte';\n</script>\n\n`;
}
