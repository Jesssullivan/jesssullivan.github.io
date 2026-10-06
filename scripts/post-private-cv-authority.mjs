#!/usr/bin/env node
// Private CV authority, run locally (R163, per Jess 2026-10-01; TIN-5260).
//
// R163 overrides the blog's hosted-runner exception for this one check: the
// former GitHub-hosted .github/workflows/private-cv-authority-v2.yml is gone,
// and until a spoke-ci-v4 lane replaces it (TIN-4302) this script is the only
// thing that may post the `private-cv-authority` commit status. For the
// checked-out, clean commit that is already on origin, it runs
// //static/cv:pdfs_synced_test (which needs the private spear_resumes module)
// through the local-build hatch. On a pass it posts `success` on the exact
// SHA; on a failure it posts `failure`, so production publish and the Pages
// rollback (which require the newest status to be success) fail fast.
//
// Trust model: the gate proves that Jess's gh credential posted the status
// after a local test run. The token never appears in argv or in this process:
// `gh api` uses gh's own stored auth. Usage: npm run cv:authority [-- --dry-run]
import { execFileSync, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STATUS_CONTEXT = 'private-cv-authority';
export const BAZEL_TARGET = '//static/cv:pdfs_synced_test';
export const HATCH_REASON = 'private cv authority';

/** Pure preflight: returns the refusal reason or null. */
export function preflight({ sha, porcelain, remoteBranches, repoSlug }) {
	if (!/^[0-9a-f]{40}$/.test(sha)) return `HEAD is not a full commit SHA: ${sha}`;
	if (porcelain.trim() !== '') return 'the working tree is dirty; commit or stash first';
	if (remoteBranches.trim() === '') return `${sha} is not on any origin branch; push it first`;
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoSlug)) return `cannot resolve the GitHub repository: ${repoSlug}`;
	return null;
}

/** The exact gh invocation; no token, only fixed fields. */
export function statusArgs(repoSlug, sha, state = 'success') {
	if (state !== 'success' && state !== 'failure') throw new Error(`unsupported status state ${state}`);
	return [
		'api',
		'--method',
		'POST',
		`repos/${repoSlug}/statuses/${sha}`,
		'-f',
		`state=${state}`,
		'-f',
		`context=${STATUS_CONTEXT}`,
		'-f',
		`description=${BAZEL_TARGET} ${state === 'success' ? 'passed' : 'failed'} locally`,
	];
}

/**
 * Runs the check. `exec` and `spawn` default to node:child_process and are
 * injectable for tests. Returns the process exit code.
 */
export function main({
	argv = process.argv,
	exec = execFileSync,
	spawn = spawnSync,
	log = console.log,
	error = console.error,
} = {}) {
	const dryRun = argv.includes('--dry-run');
	const git = (args) => String(exec('git', args, { encoding: 'utf8' })).trim();
	const sha = git(['rev-parse', 'HEAD']);
	git(['fetch', '--prune', '--quiet', 'origin']);
	const porcelain = git(['status', '--porcelain']);
	const remoteBranches = git(['branch', '-r', '--contains', sha]);
	const repoSlug = String(
		exec('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }),
	).trim();
	const refusal = preflight({ sha, porcelain, remoteBranches, repoSlug });
	if (refusal) {
		error(`private CV authority refused: ${refusal}`);
		return 2;
	}

	const post = (state) => {
		const args = statusArgs(repoSlug, sha, state);
		if (dryRun) {
			log(`dry run, would run: gh ${args.join(' ')}`);
			return;
		}
		exec('gh', args, { stdio: ['ignore', 'ignore', 'inherit'] });
		log(`private CV authority: posted ${STATUS_CONTEXT}=${state} on ${repoSlug}@${sha}`);
	};

	log(`private CV authority: ${BAZEL_TARGET} at ${sha}`);
	const test = spawn('bazel', ['test', BAZEL_TARGET], {
		stdio: 'inherit',
		env: { ...process.env, TINYLAND_ALLOW_LOCAL_BUILD: HATCH_REASON },
	});
	if (git(['rev-parse', 'HEAD']) !== sha || git(['status', '--porcelain']) !== '') {
		error('private CV authority: the checkout changed during the test; no commit status posted');
		return 1;
	}
	if (test.status !== 0) {
		error(`private CV authority: ${BAZEL_TARGET} failed (status ${test.status})`);
		post('failure');
		return 1;
	}
	post('success');
	return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
	process.exitCode = main();
}
