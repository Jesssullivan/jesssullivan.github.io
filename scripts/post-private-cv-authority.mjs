#!/usr/bin/env node
// Private CV authority, run locally (R163, per Jess 2026-10-01; TIN-5260).
//
// GitHub-hosted runners are forbidden, so the former
// .github/workflows/private-cv-authority-v2.yml is gone. This script is its
// replacement until the spoke-ci-v4 lane lands: for the checked-out, clean
// commit that is already on origin, it runs //static/cv:pdfs_synced_test
// (which needs the private spear_resumes module) and, only when that passes,
// records the commit status `private-cv-authority` = success on the exact
// SHA. Production publish and the Pages rollback require that status.
//
// The GitHub token never appears in argv or in this process: `gh api` uses
// gh's own stored auth. Usage: npm run cv:authority [-- --dry-run]
import { execFileSync, spawnSync } from 'node:child_process';

export const STATUS_CONTEXT = 'private-cv-authority';
export const BAZEL_TARGET = '//static/cv:pdfs_synced_test';
export const HATCH_REASON = 'private cv authority';

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** Pure preflight, exported for tests: returns the refusal reason or null. */
export function preflight({ sha, porcelain, remoteBranches, repoSlug }) {
	if (!/^[0-9a-f]{40}$/.test(sha)) return `HEAD is not a full commit SHA: ${sha}`;
	if (porcelain.trim() !== '') return 'the working tree is dirty; commit or stash first';
	if (remoteBranches.trim() === '') return `${sha} is not on any origin branch; push it first`;
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoSlug)) return `cannot resolve the GitHub repository: ${repoSlug}`;
	return null;
}

/** The exact gh invocation; no token, only fixed fields. */
export function statusArgs(repoSlug, sha) {
	return [
		'api',
		'--method',
		'POST',
		`repos/${repoSlug}/statuses/${sha}`,
		'-f',
		'state=success',
		'-f',
		`context=${STATUS_CONTEXT}`,
		'-f',
		`description=${BAZEL_TARGET} passed locally`,
	];
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const sha = git(['rev-parse', 'HEAD']);
	git(['fetch', '--quiet', 'origin']);
	const porcelain = git(['status', '--porcelain']);
	const remoteBranches = git(['branch', '-r', '--contains', sha]);
	const repoSlug = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
		encoding: 'utf8',
	}).trim();
	const refusal = preflight({ sha, porcelain, remoteBranches, repoSlug });
	if (refusal) {
		console.error(`private CV authority refused: ${refusal}`);
		process.exit(2);
	}

	console.log(`private CV authority: ${BAZEL_TARGET} at ${sha}`);
	const test = spawnSync('bazel', ['test', BAZEL_TARGET], {
		stdio: 'inherit',
		env: { ...process.env, TINYLAND_ALLOW_LOCAL_BUILD: HATCH_REASON },
	});
	if (test.status !== 0) {
		console.error(`private CV authority: ${BAZEL_TARGET} failed (status ${test.status}); no commit status posted`);
		process.exit(1);
	}
	if (git(['rev-parse', 'HEAD']) !== sha || git(['status', '--porcelain']) !== '') {
		console.error('private CV authority: the checkout changed during the test; no commit status posted');
		process.exit(1);
	}
	const args = statusArgs(repoSlug, sha);
	if (dryRun) {
		console.log(`dry run, would run: gh ${args.join(' ')}`);
		return;
	}
	execFileSync('gh', args, { stdio: ['ignore', 'ignore', 'inherit'] });
	console.log(`private CV authority: posted ${STATUS_CONTEXT}=success on ${repoSlug}@${sha}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main();
}
