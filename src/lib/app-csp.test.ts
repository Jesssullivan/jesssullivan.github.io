import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');

function cspDirective(name: string): string[] {
	const content = appHtml.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
	if (!content) {
		throw new Error('Content-Security-Policy meta tag not found');
	}

	const directive = content
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name} `));

	if (!directive) {
		throw new Error(`${name} directive not found`);
	}

	return directive.split(/\s+/).slice(1);
}

describe('app CSP', () => {
	it('allows the Tinyland hub broker origin for runtime Pulse/blog streams', () => {
		expect(cspDirective('connect-src')).toEqual(
			expect.arrayContaining(['https://hub.tinyland.dev', 'https://tinyland.dev']),
		);
	});
});
