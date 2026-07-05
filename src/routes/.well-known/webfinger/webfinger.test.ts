import { describe, it, expect } from 'vitest';
import { GET, _WEBFINGER_RESPONSE as WEBFINGER_RESPONSE } from './+server';

/**
 * TIN-1456 / TIN-1537 doctrine: the blog apex is not an ActivityPub authority.
 * Every AP-authority link (self, aliases, subscribe) must delegate to the hub
 * projection broker (hub.tinyland.dev); the apex (tinyland.dev / the blog
 * domain) must never appear as an `application/activity+json` self target.
 */
describe('blog webfinger JRD', () => {
	it('delegates the AP self link to the hub actor, not the apex', () => {
		const self = WEBFINGER_RESPONSE.links.find((l) => l.rel === 'self');
		expect(self?.type).toBe('application/activity+json');
		expect(self?.href).toBe('https://hub.tinyland.dev/@jesssullivan');
	});

	it('never presents an apex host as an ActivityPub authority', () => {
		const apRefs = [
			WEBFINGER_RESPONSE.links.find((l) => l.rel === 'self')?.href,
			...WEBFINGER_RESPONSE.aliases,
			WEBFINGER_RESPONSE.links.find((l) => l.rel?.endsWith('subscribe'))?.template
		].filter(Boolean) as string[];
		for (const ref of apRefs) {
			expect(ref).not.toMatch(/https:\/\/tinyland\.dev\b/);
			expect(ref).not.toContain('transscendsurvival.org');
			expect(ref).toContain('hub.tinyland.dev');
		}
	});

	it('keeps the human profile page on the blog domain', () => {
		const profile = WEBFINGER_RESPONSE.links.find(
			(l) => l.rel === 'http://webfinger.net/rel/profile-page'
		);
		expect(profile?.href).toBe('https://transscendsurvival.org');
	});

	it('serves a JRD with the correct content type and subject', async () => {
		const res = GET();
		expect(res.headers.get('Content-Type')).toBe('application/jrd+json');
		const body = await res.json();
		expect(body.subject).toBe('acct:jess@transscendsurvival.org');
	});
});
