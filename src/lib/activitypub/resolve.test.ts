import { describe, expect, it } from 'vitest';
import { resolveActivity, stripHtml } from './resolve';
import type { AS2Activity } from './types';

const baseActivity: AS2Activity = {
	'@context': 'https://www.w3.org/ns/activitystreams',
	id: 'https://example.com/activities/1',
	type: 'Create',
	actor: 'https://example.com/@jess',
	published: '2026-04-27T12:00:00Z',
	object: {
		id: 'https://example.com/notes/1',
		type: 'Note',
		content: '<p>Hello <strong>fediverse</strong>.</p><script>alert("nope")</script>',
		tag: [{ type: 'Hashtag', name: '#notes' }],
	},
};

describe('stripHtml', () => {
	it('removes markup from ActivityPub content', () => {
		expect(stripHtml('<p>hello <em>there</em></p>')).toBe('hello there');
	});
});

describe('resolveActivity', () => {
	it('keeps note content as plain text for Svelte rendering', () => {
		const resolved = resolveActivity(baseActivity);

		expect(resolved.kind).toBe('note');
		expect(resolved.content).toBe('Hello fediverse.');
		expect(resolved.content).not.toContain('<script>');
		expect(resolved.tags).toEqual(['notes']);
	});
});
