#!/usr/bin/env node
/**
 * Test support: writes the verified valid blog fixture of the
 * xoxd-projection/v2 contract into a directory, through the same step and
 * the same full verification a real build runs, with the contract's
 * published fixture key. The notes e2e build uses it. Nothing here runs in a
 * production build, and it never reads the pinned key.
 *
 * Usage: node projection/seed-fixture.mjs <out-dir>
 * Needs XOXD_PROJECTION_PKG and XOXD_PROJECTION_FIXTURES, as the Bazel
 * targets set them.
 */
import { resolve } from 'node:path';
import { loadProjectionModule, parseConfig, runProjectionStep } from './step.mjs';
import { FIXTURE_BASE, VALID_BLOG, fixtureFetch, fixturePublicKey, fixturesRoot } from './testing.mjs';

const outDir = process.argv[2];
if (!outDir) {
	process.stderr.write('usage: node projection/seed-fixture.mjs <out-dir>\n');
	process.exit(2);
}
const root = fixturesRoot();
const result = await runProjectionStep({
	config: parseConfig(
		JSON.stringify({
			target: 'blog',
			origin: 'https://transscendsurvival.org',
			publicKeyFile: 'hub-ed25519.pub',
			outDir: 'src/lib/projection-data',
			allowedBases: [FIXTURE_BASE],
			recoveryBase: FIXTURE_BASE,
		}),
	),
	key: { placeholder: false, key: await fixturePublicKey(root) },
	inputs: { base: FIXTURE_BASE, ...VALID_BLOG },
	outDir: resolve(outDir),
	projection: await loadProjectionModule(),
	fetch: fixtureFetch(root),
});
if (result.status !== 'verified') process.exit(1);
