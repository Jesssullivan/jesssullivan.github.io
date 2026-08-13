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

async function runFixture({
	eventName,
	run = canonicalRun(),
	runs = [canonicalRun()],
	cvRuns = [canonicalRun({ id: 202, html_url: 'https://github.example/cv/202' })],
	jobs = authorityJobs(),
	mainSha = sourceSha,
	manualSha = sourceSha,
	manualDeploy = 'true',
	productionEnabled = 'false',
	dispatchAction = 'cloudflare-pages-production-v2',
}) {
	const outputs = {};
	const listJobsForWorkflowRun = async () => ({ data: { jobs } });
	const listWorkflowRuns = async (args) => {
		const selected = args.workflow_id === 'private-cv-authority-v2.yml' ? cvRuns : runs;
		return { data: { workflow_runs: selected.map((run) => ({ status: 'completed', ...run })) } };
	};
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
	{ eventName: 'repository_dispatch', cvRuns: [canonicalRun({ head_sha: otherSha })] },
	/No successful private CV authority run completed for exact SHA/,
);
await rejects(
	'PR events cannot enter the production resolver',
	{ eventName: 'pull_request' },
	/Unsupported event pull_request/,
);

// Ambiguous API responses must fail closed rather than let ordering decide.
await rejects(
	'conflicting completed CI conclusions for the same SHA fail closed',
	{
		eventName: 'repository_dispatch',
		runs: [canonicalRun(), canonicalRun({ id: 102, conclusion: 'failure' })],
	},
	/Ambiguous CI evidence: 2 completed canonical CI push runs matched exact SHA/,
);
await rejects(
	'multiple matching successful CI runs for the same SHA fail closed',
	{
		eventName: 'repository_dispatch',
		runs: [canonicalRun(), canonicalRun({ id: 103 })],
	},
	/Ambiguous CI evidence: 2 completed canonical CI push runs matched exact SHA/,
);
await rejects(
	'conflicting completed private CV authority runs for the same SHA fail closed',
	{
		eventName: 'repository_dispatch',
		cvRuns: [
			canonicalRun({ id: 202, html_url: 'https://github.example/cv/202' }),
			canonicalRun({ id: 203, conclusion: 'failure', html_url: 'https://github.example/cv/203' }),
		],
	},
	/Ambiguous private CV authority evidence: 2 completed runs for exact SHA/,
);
await rejects(
	'duplicate latest authority jobs with conflicting conclusions fail closed',
	{
		eventName: 'workflow_run',
		jobs: [
			{ name: 'build-and-test', conclusion: 'success' },
			{ name: 'build-and-test', conclusion: 'failure' },
			{ name: 'bazel-remote-gates', conclusion: 'success' },
		],
	},
	/Ambiguous CI evidence: 2 latest jobs named build-and-test/,
);

const revalidationSource = extractGithubScript(
	'Revalidate production kill switch and current main immediately before publish',
);
const executeRevalidation = new AsyncFunction('github', 'context', 'process', revalidationSource);
const revalidationContext = { repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' } };
const revalidationProcess = { env: { EXPECTED_SHA: sourceSha } };
const githubAtMain = {
	rest: {
		actions: {
			getRepoVariable: async () => ({ data: { value: 'true' } }),
		},
		git: { getRef: async () => ({ data: { object: { sha: sourceSha } } }) },
	},
};
await executeRevalidation(githubAtMain, revalidationContext, revalidationProcess);
await assert.rejects(
	() =>
		executeRevalidation(
			{
				rest: {
					actions: { getRepoVariable: async () => ({ data: { value: 'true' } }) },
					git: { getRef: async () => ({ data: { object: { sha: otherSha } } }) },
				},
			},
			revalidationContext,
			revalidationProcess,
		),
	/Refusing stale production publish/,
	'pre-publish revalidation rejects a SHA made stale during the build',
);
await assert.rejects(
	() =>
		executeRevalidation(
			{
				rest: {
					actions: { getRepoVariable: async () => ({ data: { value: 'false' } }) },
					git: { getRef: async () => ({ data: { object: { sha: sourceSha } } }) },
				},
			},
			revalidationContext,
			revalidationProcess,
		),
	/not true at publish time/,
	'production kill switch changing during the build fails immediately before publish',
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
