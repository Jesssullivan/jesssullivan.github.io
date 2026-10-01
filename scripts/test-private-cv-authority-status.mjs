#!/usr/bin/env node
// R163 (per Jess, 2026-10-01; TIN-5260): the private CV authority is a
// locally posted commit status, not a hosted workflow. These fixtures pin the
// poster's refusals, its exact gh call (no token, fixed fields only) and the
// order of operations: the status is posted only after the Bazel test result,
// success on a pass and failure on a fail.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
	BAZEL_TARGET,
	HATCH_REASON,
	main,
	preflight,
	STATUS_CONTEXT,
	statusArgs,
} from './post-private-cv-authority.mjs';

const sha = 'a'.repeat(40);
const repoSlug = 'Jesssullivan/jesssullivan.github.io';
const ok = { sha, porcelain: '', remoteBranches: '  origin/main\n', repoSlug };

assert.equal(STATUS_CONTEXT, 'private-cv-authority');
assert.equal(BAZEL_TARGET, '//static/cv:pdfs_synced_test');
assert.equal(HATCH_REASON, 'private cv authority');
assert.equal(preflight(ok), null);
assert.match(preflight({ ...ok, porcelain: ' M src/app.html\n' }), /dirty/);
assert.match(preflight({ ...ok, remoteBranches: '' }), /not on any origin branch/);
assert.match(preflight({ ...ok, sha: 'a'.repeat(39) }), /full commit SHA/);
assert.match(preflight({ ...ok, repoSlug: '' }), /cannot resolve/);

const args = statusArgs(repoSlug, sha);
assert.deepEqual(args.slice(0, 4), ['api', '--method', 'POST', `repos/${repoSlug}/statuses/${sha}`]);
assert.ok(args.includes('state=success'));
assert.ok(args.includes(`context=${STATUS_CONTEXT}`));
assert.ok(statusArgs(repoSlug, sha, 'failure').includes('state=failure'));
assert.throws(() => statusArgs(repoSlug, sha, 'pending'), /unsupported status state/);
assert.ok(!args.some((a) => /token|authorization|bearer/i.test(a)), 'the token must never be in argv');

/** Runs main() against mocked git/gh/bazel and records every call in order. */
function run({ testStatus = 0, porcelain = '', remoteBranches = '  origin/main\n', changeHead = false } = {}) {
	const calls = [];
	let headReads = 0;
	const exec = (cmd, cmdArgs) => {
		calls.push([cmd, ...cmdArgs].join(' '));
		if (cmd === 'git' && cmdArgs[0] === 'rev-parse') {
			headReads++;
			return changeHead && headReads > 1 ? 'b'.repeat(40) : sha;
		}
		if (cmd === 'git' && cmdArgs[0] === 'status') return porcelain;
		if (cmd === 'git' && cmdArgs[0] === 'branch') return remoteBranches;
		if (cmd === 'gh' && cmdArgs[0] === 'repo') return repoSlug;
		return '';
	};
	const spawn = (cmd, cmdArgs, options) => {
		calls.push([cmd, ...cmdArgs].join(' '));
		assert.equal(options.env.TINYLAND_ALLOW_LOCAL_BUILD, HATCH_REASON);
		return { status: testStatus };
	};
	const code = main({ argv: ['node', 'x'], exec, spawn, log: () => {}, error: () => {} });
	return { code, calls };
}

const posts = (calls) => calls.filter((c) => c.startsWith('gh api --method POST'));
const testIndex = (calls) => calls.findIndex((c) => c === `bazel test ${BAZEL_TARGET}`);

{
	const { code, calls } = run();
	assert.equal(code, 0);
	assert.ok(calls.includes('git fetch --prune --quiet origin'), 'fetch --prune before the on-origin check');
	assert.ok(calls.indexOf('git fetch --prune --quiet origin') < calls.findIndex((c) => c.startsWith('git branch -r')));
	assert.equal(posts(calls).length, 1);
	assert.match(posts(calls)[0], /state=success/);
	assert.ok(calls.indexOf(posts(calls)[0]) > testIndex(calls), 'success is posted only after the Bazel test passes');
}
{
	const { code, calls } = run({ testStatus: 3 });
	assert.equal(code, 1);
	assert.equal(posts(calls).length, 1);
	assert.match(posts(calls)[0], /state=failure/, 'a failed test posts failure so production fails fast');
	assert.ok(!calls.some((c) => c.includes('state=success')));
}
for (const refusal of [{ porcelain: ' M x' }, { remoteBranches: '' }]) {
	const { code, calls } = run(refusal);
	assert.equal(code, 2);
	assert.equal(testIndex(calls), -1, 'a refusal never runs the test');
	assert.equal(posts(calls).length, 0, 'a refusal never posts');
}
{
	const { code, calls } = run({ changeHead: true });
	assert.equal(code, 1);
	assert.equal(posts(calls).length, 0, 'a checkout that moved during the test never posts');
}

assert.equal(
	existsSync(new URL('../.github/workflows/private-cv-authority-v2.yml', import.meta.url)),
	false,
	'the hosted private CV workflow stays deleted (R163)',
);
console.log('private CV authority status fixtures passed');
