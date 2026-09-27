import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import raw from '../../../static/profile/profile.v1.json?raw';
import legacyRaw from '../../../static/profile/facts.json?raw';
import receipt from '../../../static/profile/profile.v1.provenance.json';
import { profile as legacy } from '$lib/data/profile';
import { profileFallback } from './fallback';
import palette from './xoxd-palette.json';

function contrast(a: string, b: string) {
	const luminance = (hex: string) => {
		const c = [1, 3, 5]
			.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
			.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
	};
	const x = luminance(a),
		y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe('reviewed fallback and scoped theme', () => {
	it('matches its producer provenance receipt byte-for-byte', () => {
		expect(createHash('sha256').update(raw).digest('hex')).toBe(receipt.content_sha256);
		expect(profileFallback.source_commit).toBe(receipt.source_commit);
		expect(profileFallback.corpus_sha256).toBe(receipt.corpus_sha256);
		if ('legacy_facts_sha256' in receipt)
			expect(createHash('sha256').update(legacyRaw).digest('hex')).toBe(receipt.legacy_facts_sha256);
	});
	it('keeps the already-approved identity, role and venture prose', () => {
		expect(profileFallback.identity?.name).toBe(legacy.identity.name);
		expect(profileFallback.identity?.headline).toBe(legacy.identity.headline);
		expect(profileFallback.identity?.summary).toBe(legacy.identity.summary);
		expect(profileFallback.roles).toEqual(legacy.roles);
		expect(profileFallback.ventures).toEqual(legacy.ventures);
	});
	it('retains Jess’s corrected research, client and operating-as claims', () => {
		for (const data of [profileFallback, legacy]) {
			const curated = JSON.stringify({ roles: data.roles, ventures: data.ventures });
			expect(curated).not.toMatch(
				/iNaturalist|NATS JetStream|entire business stack|four (?:business )?expansions|full business stacks for clients/i,
			);
			const cornell = data.roles?.find((role) => role.org.startsWith('Macaulay Library'));
			expect(cornell?.summary).toContain('Developed & launched Merlin Sound ID');
			expect(cornell?.bullets.join(' ')).toContain('classification research with Visipedia.');
			const xoxd = data.ventures?.find((venture) => venture.name === 'xoxd.ai');
			expect(xoxd).toMatchObject({ role: 'Operating as', start: 2024 });
			expect(data.roles?.find((role) => role.title === 'Independent contractor')?.start).toBe(2017);
		}
	});
	it('keeps actual house semantic text colors accessible in both modes', () => {
		for (const mode of ['light', 'dark'] as const) {
			const roles = palette.roles[mode];
			for (const role of ['body', 'heading', 'link'] as const)
				expect(contrast(roles[role], roles.background)).toBeGreaterThanOrEqual(4.5);
		}
		expect(palette.roles.light.brand).toBe('#cc003b');
		expect(palette.roles.dark.background).toBe('#020103');
	});
});
