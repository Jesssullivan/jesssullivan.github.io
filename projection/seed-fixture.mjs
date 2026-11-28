#!/usr/bin/env node
/**
 * Test support: writes the verified valid blog fixture of the
 * xoxd-projection/v3 contract into a directory, through the same step and
 * the same full verification a real build runs, with the contract's
 * published fixture key. The fixture tree is served from a loopback server
 * and fetched over HTTP. The notes e2e build uses it. Nothing here runs in a
 * production build, and it never reads the pinned key.
 *
 * Usage: node projection/seed-fixture.mjs <out-dir>
 * Needs XOXD_PROJECTION_PKG and XOXD_PROJECTION_FIXTURES, as the Bazel
 * targets set them.
 */
import { resolve } from 'node:path';
import { loadProjectionModule, runProjectionStep } from './step.mjs';
import {
	FIXTURE_CONTRACT,
	VALID_BLOG,
	fixtureConfig,
	fixturePublicKey,
	fixturesRoot,
	noRedirectFetch,
	startFixtureHub,
} from './testing.mjs';

const outDir = process.argv[2];
if (!outDir) {
	process.stderr.write('usage: node projection/seed-fixture.mjs <out-dir>\n');
	process.exit(2);
}
const hub = await startFixtureHub(fixturesRoot());
let status = 1;
try {
	const result = await runProjectionStep({
		config: fixtureConfig(hub.base),
		key: { placeholder: false, key: fixturePublicKey() },
		inputs: { contract: FIXTURE_CONTRACT, base: hub.base, ...VALID_BLOG },
		outDir: resolve(outDir),
		projection: await loadProjectionModule(),
		fetch: noRedirectFetch,
		allowLoopbackHttpForTests: true,
	});
	if (result.status === 'verified') status = 0;
} finally {
	await hub.close();
}
process.exit(status);
