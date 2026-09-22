import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ReviewedInlineDisclosureFixture from './fixtures/reviewed-inline-disclosure.svx';

describe('reviewed interactive SVX static rendering', () => {
	it('keeps the disclosure label and full body in SSR/no-JS HTML', () => {
		const { html } = render(ReviewedInlineDisclosureFixture);

		expect(html).toContain('data-reviewed-component="InlineDisclosure"');
		expect(html).toContain('Show the reviewed body');
		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain('The reviewed Markdown body is present in the static HTML before JavaScript.');
	});
});
