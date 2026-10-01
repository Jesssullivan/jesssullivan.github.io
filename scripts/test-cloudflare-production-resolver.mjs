import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../.github/workflows/cloudflare-pages-production-v2.yml', import.meta.url);
const workflow = await readFile(workflowUrl, 'utf8');
const resolverSource = extractGithubScript('Resolve and verify exact source SHA')
	.replace('20 * 60 * 1_000', '1')
	.replace('15_000', '0');
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

function cvStatus(overrides = {}) {
	return {
		context: 'private-cv-authority',
		state: 'success',
		created_at: '2026-10-01T12:00:00Z',
		updated_at: '2026-10-01T12:00:00Z',
		creator: { login: 'Jesssullivan' },
		...overrides,
	};
}

async function runFixture({
	eventName,
	run = canonicalRun(),
	runs = [canonicalRun()],
	// R163: the private CV authority is a commit status on the exact SHA.
	cvStatuses = { [sourceSha]: [cvStatus()] },
	statusError = null,
	jobs = authorityJobs(),
	mainSha = sourceSha,
	manualSha = sourceSha,
	manualDeploy = 'true',
	productionEnabled = 'false',
	dispatchAction = 'cloudflare-pages-production-v2',
}) {
	const outputs = {};
	const listJobsForWorkflowRun = async () => ({ data: { jobs } });
	const listWorkflowRuns = async () => ({
		data: { workflow_runs: runs.map((run) => ({ status: 'completed', ...run })) },
	});
	const listCommitStatusesForRef = async (args) => {
		if (statusError) throw statusError;
		return { data: cvStatuses[args.ref] ?? [] };
	};
	const github = {
		rest: {
			actions: { listJobsForWorkflowRun, listWorkflowRuns },
			repos: { listCommitStatusesForRef },
			git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) },
		},
		paginate: async (method, args) => {
			const response = await method(args);
			return Array.isArray(response.data) ? response.data : (response.data.jobs ?? response.data.workflow_runs);
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
		payload: eventName === 'workflow_run' ? { workflow_run: run } : { action: dispatchAction },
	};
	const processFixture = {
		env: {
			REQUEST_SOURCE_SHA: manualSha,
			REQUEST_DEPLOY: manualDeploy,
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
	{ source_sha: sourceSha, ci_url: 'https://github.example/ci/101', deploy: 'false' },
	'successful canonical CI run records provenance but never automatically deploys',
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
			eventName: 'repository_dispatch',
			manualDeploy: 'true',
			productionEnabled: 'true',
		})
	).deploy,
	'true',
	'exact current-main manual SHA with canonical CI and both gates can deploy',
);
await rejects(
	'repository-dispatch deploy request fails when operator gate is unset',
	{ eventName: 'repository_dispatch', manualDeploy: 'true' },
	/CLOUDFLARE_PAGES_PRODUCTION_ENABLED must be true/,
);
await rejects(
	'repository dispatch cannot masquerade as parity',
	{ eventName: 'repository_dispatch', manualDeploy: 'false', productionEnabled: 'true' },
	/client_payload\.deploy must be the string true/,
);
await rejects(
	'repository dispatch must use the exact v2 type',
	{ eventName: 'repository_dispatch', dispatchAction: 'arbitrary' },
	/Unsupported repository_dispatch action/,
);
await rejects(
	'repository-dispatch SHA must equal current main',
	{ eventName: 'repository_dispatch', mainSha: otherSha },
	/is not the current main SHA/,
);
await rejects(
	'repository-dispatch SHA must have a successful exact-SHA CI run',
	{ eventName: 'repository_dispatch', runs: [canonicalRun({ head_sha: otherSha })] },
	/No successful canonical CI push run found for exact SHA/,
);
await rejects(
	'repository-dispatch CI with skipped remote authority fails closed',
	{ eventName: 'repository_dispatch', jobs: authorityJobs({ bazel: 'skipped' }) },
	/Required CI job bazel-remote-gates was missing or not successful/,
);
await rejects(
	'missing exact-SHA private CV authority fails closed',
	{ eventName: 'repository_dispatch', cvStatuses: { [otherSha]: [cvStatus()] } },
	/No successful private-cv-authority commit status for exact SHA/,
);
await rejects(
	'a failed private CV authority status fails closed',
	{ eventName: 'repository_dispatch', cvStatuses: { [sourceSha]: [cvStatus({ state: 'failure' })] } },
	/Private CV authority status is failure for exact SHA/,
);
await rejects(
	'the newest private CV authority status wins',
	{
		eventName: 'repository_dispatch',
		cvStatuses: {
			[sourceSha]: [
				cvStatus(),
				cvStatus({ state: 'error', created_at: '2026-10-01T13:00:00Z', updated_at: '2026-10-01T13:00:00Z' }),
			],
		},
	},
	/Private CV authority status is error/,
);
await rejects(
	'a pending private CV authority status that never resolves times out closed',
	{ eventName: 'repository_dispatch', cvStatuses: { [sourceSha]: [cvStatus({ state: 'pending' })] } },
	/No successful private-cv-authority commit status for exact SHA .* within twenty minutes/,
);
assert.equal(
	(
		await runFixture({
			eventName: 'repository_dispatch',
			productionEnabled: 'true',
			cvStatuses: {
				[sourceSha]: [
					cvStatus({ state: 'failure' }),
					cvStatus({ created_at: '2026-10-01T14:00:00Z', updated_at: '2026-10-01T14:00:00Z' }),
				],
			},
		})
	).deploy,
	'true',
	'a newer success recovers an older failed private CV authority status',
);
await rejects(
	'the workflow_run path also requires the private CV authority status',
	{ eventName: 'workflow_run', cvStatuses: {} },
	/No successful private-cv-authority commit status for exact SHA/,
);
await rejects(
	'a commit-status API error fails closed',
	{ eventName: 'repository_dispatch', statusError: new Error('statuses API unavailable') },
	/statuses API unavailable/,
);
await rejects(
	'a private CV authority status from anyone but the owner fails closed',
	{ eventName: 'repository_dispatch', cvStatuses: { [sourceSha]: [cvStatus({ creator: { login: 'github-actions[bot]' } })] } },
	/was not posted by Jesssullivan/,
);
await rejects(
	'PR events cannot enter the production resolver',
	{ eventName: 'pull_request' },
	/Unsupported event pull_request/,
);

const revalidationSource = extractGithubScript(
	'Revalidate production kill switch and current main immediately before publish',
);
const executeRevalidation = new AsyncFunction('github', 'context', 'process', 'getOctokit', revalidationSource);
const revalidationContext = { repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' } };
const revalidationProcess = { env: { EXPECTED_SHA: sourceSha, VARIABLES_READ_TOKEN: 'variables-reader' } };
function githubForRevalidation({ mainSha = sourceSha, gateValue = 'true' } = {}) {
	const variablesClient = {
		rest: { actions: { getRepoVariable: async () => ({ data: { value: gateValue } }) } },
	};
	return {
		variablesClient,
		rest: { git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) } },
	};
}
function getVariablesReader(variablesClient) {
	return (token) => {
		assert.equal(token, 'variables-reader', 'only the dedicated Variables-read token reaches the variable API');
		return variablesClient;
	};
}
const githubAtMain = githubForRevalidation();
const runRevalidation = (github, process = revalidationProcess) => executeRevalidation(github, revalidationContext, process, getVariablesReader(github.variablesClient));
await runRevalidation(githubAtMain);
await assert.rejects(
	() =>
		runRevalidation(githubForRevalidation({ mainSha: otherSha })),
	/Refusing stale production publish/,
	'pre-publish revalidation rejects a SHA made stale during the build',
);
await assert.rejects(
	() =>
		runRevalidation(githubForRevalidation({ gateValue: 'false' })),
	/not true at publish time/,
	'production kill switch changing during the build fails immediately before publish',
);
await assert.rejects(
	() =>
		runRevalidation(githubForRevalidation(), { env: { EXPECTED_SHA: sourceSha } }),
	/VARIABLES_READ_TOKEN is required/,
	'production publish fails closed when the dedicated Variables-read credential is unavailable',
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
