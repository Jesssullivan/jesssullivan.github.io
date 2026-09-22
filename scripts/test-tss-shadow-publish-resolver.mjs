import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/tss-shadow-publish-v2.yml', import.meta.url), 'utf8');
const resolverSource = extractGithubScript('Resolve exact shadow source');
assert.match(resolverSource, /requireAuthorityJobs/);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const executeResolver = new AsyncFunction('github', 'context', 'core', 'process', resolverSource);

const repository = 'Jesssullivan/jesssullivan.github.io';
const sourceSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

function authorityJobs(overrides = {}) {
	return [
		{ name: 'build-and-test', conclusion: overrides.build ?? 'success' },
		{ name: 'bazel-remote-gates', conclusion: overrides.bazel ?? 'success' },
	].filter((job) => !overrides.missing?.includes(job.name));
}

function ciRun(overrides = {}) {
	return {
		id: 101,
		name: 'CI',
		conclusion: 'success',
		event: 'push',
		head_branch: 'main',
		head_repository: { full_name: repository },
		head_sha: sourceSha,
		html_url: 'https://github.example/ci/101',
		...overrides,
	};
}

function pullRequest(overrides = {}) {
	return {
		number: 263,
		state: 'open',
		base: { ref: 'main' },
		head: { sha: sourceSha, repo: { full_name: repository } },
		...overrides,
	};
}

async function runFixture({
	eventName = 'repository_dispatch',
	dispatchAction = 'tss-shadow-publish-v2',
	manualSha = sourceSha,
	manualPr = '',
	manualDeploy = 'true',
	tssEnabled = 'true',
	tssProject = 'tss-shadow',
	tssBranch = 'main',
	mainSha = sourceSha,
	pr = pullRequest(),
	runs = [ciRun()],
	jobs = authorityJobs(),
} = {}) {
	const outputs = {};
	const github = {
		rest: {
			actions: {
				listJobsForWorkflowRun: async () => ({ data: { jobs } }),
				listWorkflowRuns: async (args) => ({
					data: { workflow_runs: runs.filter((run) => run.event === args.event).map((run) => ({ status: 'completed', ...run })) },
				}),
			},
			git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) },
			pulls: { get: async () => ({ data: pr }) },
		},
		paginate: async (method, args) => {
			const response = await method(args);
			return response.data.jobs ?? response.data.workflow_runs;
		},
	};
	const summary = {
		addHeading() {
			return this;
		},
		addRaw() {
			return this;
		},
		addLink() {
			return this;
		},
		async write() {},
	};
	const context = {
		eventName,
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { action: dispatchAction },
	};
	const core = {
		summary,
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
	await executeResolver(github, context, core, {
		env: {
			REQUEST_SOURCE_SHA: manualSha,
			REQUEST_SOURCE_PR: manualPr,
			REQUEST_DEPLOY: manualDeploy,
			TSS_ENABLED: tssEnabled,
			TSS_PROJECT: tssProject,
			TSS_BRANCH: tssBranch,
		},
	});
	return outputs;
}

assert.deepEqual(await runFixture(), {
	source_sha: sourceSha,
	source_ref: 'main',
	pr_number: '',
	ci_url: 'https://github.example/ci/101',
	project: 'tss-shadow',
	branch: 'main',
	deploy: 'true',
});
assert.equal((await runFixture({ tssProject: ' tss-shadow ' })).project, 'tss-shadow', 'surrounding whitespace is trimmed, never shell-interpolated');
await assert.rejects(() => runFixture({ tssProject: 'transscendsurvival-org' }), /never target the production Pages project/, 'production project refused');
await assert.rejects(() => runFixture({ tssProject: 'transscendsurvival-org ' }), /never target the production Pages project/, 'production project with trailing space still refused');
await assert.rejects(() => runFixture({ tssProject: 'tss-shadow; rm -rf' }), /lowercase Pages project slug/, 'shell metacharacters refused');
await assert.rejects(() => runFixture({ tssProject: '' }), /lowercase Pages project slug/, 'empty project refused');
await assert.rejects(() => runFixture({ tssBranch: 'main $(x)' }), /plain branch name/, 'branch metacharacters refused');
assert.deepEqual(
	await runFixture({ manualPr: '263', runs: [ciRun({ event: 'pull_request', head_branch: 'feature' })], mainSha: otherSha }),
	{ source_sha: sourceSha, source_ref: 'pr-263', pr_number: '263', ci_url: 'https://github.example/ci/101', project: 'tss-shadow', branch: 'main', deploy: 'true' },
	'open same-repo PR head with green pull_request CI resolves',
);
await assert.rejects(() => runFixture({ eventName: 'workflow_dispatch' }), /exact repository dispatch type/, 'manual carrier fails closed');
await assert.rejects(() => runFixture({ dispatchAction: 'cloudflare-pages-production-v2' }), /exact repository dispatch type/, 'wrong dispatch type');
await assert.rejects(() => runFixture({ manualSha: 'a'.repeat(39) }), /exact 40-character lowercase commit SHA/, 'non-exact SHA');
await assert.rejects(() => runFixture({ mainSha: otherSha }), /not the current main SHA/, 'stale main SHA without a PR fails closed');
await assert.rejects(() => runFixture({ manualPr: '0' }), /positive integer/, 'non-positive PR number');
await assert.rejects(() => runFixture({ manualPr: '263', pr: pullRequest({ state: 'closed' }) }), /not an open same-repo main PR/, 'closed PR');
await assert.rejects(
	() => runFixture({ manualPr: '263', pr: pullRequest({ head: { sha: sourceSha, repo: { full_name: 'fork/blog' } } }) }),
	/not an open same-repo main PR/,
	'fork PR',
);
await assert.rejects(
	() => runFixture({ manualPr: '263', pr: pullRequest({ head: { sha: otherSha, repo: { full_name: repository } } }) }),
	/not an open same-repo main PR/,
	'PR head drift',
);
await assert.rejects(() => runFixture({ runs: [] }), /No successful canonical CI push run/, 'missing CI run');
await assert.rejects(() => runFixture({ runs: [ciRun({ conclusion: 'failure' })] }), /No successful canonical CI push run/, 'red CI run');
await assert.rejects(() => runFixture({ jobs: authorityJobs({ bazel: 'failure' }) }), /bazel-remote-gates was missing or not successful/, 'gates red');
await assert.rejects(() => runFixture({ jobs: authorityJobs({ missing: ['build-and-test'] }) }), /build-and-test was missing/, 'job missing');
await assert.rejects(() => runFixture({ manualDeploy: 'false' }), /deploy must be the string true/, 'deploy not requested');
await assert.rejects(() => runFixture({ tssEnabled: 'false' }), /BLOG_TSS_PUBLISH_ENABLED must be true/, 'kill switch off');

console.log('TSS shadow publish resolver fixtures passed');

function extractGithubScript(stepName) {
	const marker = `      - name: ${stepName}`;
	const markerIndex = workflow.indexOf(marker);
	assert.notEqual(markerIndex, -1, `${stepName} step exists`);
	const lines = workflow.slice(markerIndex).split('\n');
	const scriptStart = lines.findIndex((line) => line === '          script: |');
	assert.notEqual(scriptStart, -1, `${stepName} has an inline script`);
	const scriptLines = [];
	for (const line of lines.slice(scriptStart + 1)) {
		if (line === '') {
			scriptLines.push('');
			continue;
		}
		if (!line.startsWith('            ')) break;
		scriptLines.push(line.slice(12));
	}
	return scriptLines.join('\n');
}
