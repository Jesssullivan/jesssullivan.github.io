import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../.github/workflows/cloudflare-pages-production.yml', import.meta.url);
const workflow = await readFile(workflowUrl, 'utf8');
const resolverSource = extractGithubScript('Resolve and verify exact source SHA');
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

function canonicalRun(overrides = {}) {
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

async function runFixture({
	eventName,
	run = canonicalRun(),
	runs = [canonicalRun()],
	jobs = authorityJobs(),
	mainSha = sourceSha,
	manualSha = sourceSha,
	manualDeploy = 'false',
	productionEnabled = 'false',
}) {
	const outputs = {};
	const listJobsForWorkflowRun = async () => ({ data: { jobs } });
	const listWorkflowRuns = async () => ({ data: { workflow_runs: runs } });
	const github = {
		rest: {
			actions: { listJobsForWorkflowRun, listWorkflowRuns },
			git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) },
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
	const core = {
		setOutput(name, value) {
			outputs[name] = value;
		},
		summary,
	};
	const context = {
		eventName,
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: eventName === 'workflow_run' ? { workflow_run: run } : {},
	};
	const processFixture = {
		env: {
			MANUAL_SOURCE_SHA: manualSha,
			MANUAL_DEPLOY: manualDeploy,
			PRODUCTION_ENABLED: productionEnabled,
		},
	};

	await executeResolver(github, context, core, processFixture);
	return outputs;
}

async function rejects(label, fixture, pattern) {
	await assert.rejects(() => runFixture(fixture), pattern, label);
}

assert.deepEqual(
	await runFixture({ eventName: 'workflow_run', productionEnabled: 'true' }),
	{ source_sha: sourceSha, ci_url: 'https://github.example/ci/101', deploy: 'true' },
	'successful canonical CI run is deploy-eligible only when the operator gate is enabled',
);
assert.equal(
	(await runFixture({ eventName: 'workflow_run' })).deploy,
	'false',
	'unset production gate keeps automatic publication build-only',
);

for (const conclusion of ['cancelled', 'skipped', 'failure']) {
	await rejects(
		`${conclusion} Bazel authority job fails closed`,
		{ eventName: 'workflow_run', jobs: authorityJobs({ bazel: conclusion }) },
		/Required CI job bazel-remote-gates was missing or not successful/,
	);
}
await rejects(
	'missing hosted authority job fails closed',
	{ eventName: 'workflow_run', jobs: authorityJobs({ missing: ['build-and-test'] }) },
	/Required CI job build-and-test was missing or not successful/,
);
await rejects(
	'wrong workflow conclusion fails closed',
	{ eventName: 'workflow_run', run: canonicalRun({ conclusion: 'failure' }) },
	/did not satisfy the production provenance contract/,
);
await rejects(
	'wrong workflow branch fails closed',
	{ eventName: 'workflow_run', run: canonicalRun({ head_branch: 'feature' }) },
	/did not satisfy the production provenance contract/,
);
await rejects(
	'wrong workflow repository fails closed',
	{ eventName: 'workflow_run', run: canonicalRun({ head_repository: { full_name: 'fork/blog' } }) },
	/did not satisfy the production provenance contract/,
);
await rejects(
	'older successful automatic run cannot roll production backward',
	{ eventName: 'workflow_run', mainSha: otherSha },
	/is stale; current main is/,
);

assert.equal(
	(
		await runFixture({
			eventName: 'workflow_dispatch',
			manualDeploy: 'true',
			productionEnabled: 'true',
		})
	).deploy,
	'true',
	'exact current-main manual SHA with canonical CI and both gates can deploy',
);
assert.equal(
	(await runFixture({ eventName: 'workflow_dispatch', manualDeploy: 'true' })).deploy,
	'false',
	'manual deploy request stays build-only while operator gate is unset',
);
await rejects(
	'manual SHA must equal current main',
	{ eventName: 'workflow_dispatch', mainSha: otherSha },
	/is not the current main SHA/,
);
await rejects(
	'manual SHA must have a successful exact-SHA CI run',
	{ eventName: 'workflow_dispatch', runs: [canonicalRun({ head_sha: otherSha })] },
	/No successful canonical CI push run found for exact SHA/,
);
await rejects(
	'manual CI with skipped remote authority fails closed',
	{ eventName: 'workflow_dispatch', jobs: authorityJobs({ bazel: 'skipped' }) },
	/Required CI job bazel-remote-gates was missing or not successful/,
);
await rejects(
	'PR events cannot enter the production resolver',
	{ eventName: 'pull_request' },
	/Unsupported event pull_request/,
);

const revalidationSource = extractGithubScript('Revalidate current main immediately before publish');
const executeRevalidation = new AsyncFunction('github', 'context', 'process', revalidationSource);
const revalidationContext = { repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' } };
const revalidationProcess = { env: { EXPECTED_SHA: sourceSha } };
const githubAtMain = {
	rest: { git: { getRef: async () => ({ data: { object: { sha: sourceSha } } }) } },
};
await executeRevalidation(githubAtMain, revalidationContext, revalidationProcess);
await assert.rejects(
	() =>
		executeRevalidation(
			{ rest: { git: { getRef: async () => ({ data: { object: { sha: otherSha } } }) } } },
			revalidationContext,
			revalidationProcess,
		),
	/Refusing stale production publish/,
	'pre-publish revalidation rejects a SHA made stale during the build',
);

console.log('Cloudflare production resolver fixtures passed');

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
