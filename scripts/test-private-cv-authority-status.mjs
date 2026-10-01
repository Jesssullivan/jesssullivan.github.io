#!/usr/bin/env node
// R163 (per Jess, 2026-10-01; TIN-5260): the private CV authority is a
// locally posted commit status, not a hosted workflow. These fixtures pin the
// poster's refusals and its exact gh call (no token, fixed fields only).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BAZEL_TARGET, HATCH_REASON, preflight, STATUS_CONTEXT, statusArgs } from './post-private-cv-authority.mjs';

const sha = 'a'.repeat(40);
const ok = { sha, porcelain: '', remoteBranches: '  origin/main\n', repoSlug: 'Jesssullivan/jesssullivan.github.io' };

assert.equal(STATUS_CONTEXT, 'private-cv-authority');
assert.equal(BAZEL_TARGET, '//static/cv:pdfs_synced_test');
assert.equal(HATCH_REASON, 'private cv authority');
assert.equal(preflight(ok), null);
assert.match(preflight({ ...ok, porcelain: ' M src/app.html\n' }), /dirty/);
assert.match(preflight({ ...ok, remoteBranches: '' }), /not on any origin branch/);
assert.match(preflight({ ...ok, sha: 'a'.repeat(39) }), /full commit SHA/);
assert.match(preflight({ ...ok, repoSlug: '' }), /cannot resolve/);

const args = statusArgs(ok.repoSlug, sha);
assert.deepEqual(args.slice(0, 4), ['api', '--method', 'POST', `repos/${ok.repoSlug}/statuses/${sha}`]);
assert.ok(args.includes('state=success'));
assert.ok(args.includes(`context=${STATUS_CONTEXT}`));
assert.ok(!args.some((a) => /token|authorization|bearer/i.test(a)), 'the token must never be in argv');

assert.equal(
	existsSync(new URL('../.github/workflows/private-cv-authority-v2.yml', import.meta.url)),
	false,
	'the hosted private CV workflow stays deleted (R163)',
);
console.log('private CV authority status fixtures passed');
