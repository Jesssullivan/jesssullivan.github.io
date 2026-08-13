import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

const sourceWorkflow = await readFile(
	new URL('../.github/workflows/shadow-source-build-v2.yml', import.meta.url),
	'utf8',
);
const trustedWorkflow = await readFile(
	new URL('../.github/workflows/shadow-source-publish-v2.yml', import.meta.url),
	'utf8',
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const executeSourceResolver = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(sourceWorkflow, 'Resolve exact open same-repo PR'),
);
const executeTrustedResolver = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(trustedWorkflow, 'Verify exact source metadata and live PR'),
);
const executePublishRecheck = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(trustedWorkflow, 'Revalidate publish authority immediately before package write'),
);
const repository = 'Jesssullivan/jesssullivan.github.io';
const sourceSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const archiveDigest = `sha256:${'c'.repeat(64)}`;

function pullRequest(overrides = {}) {
	return {
		number: 251,
		state: 'open',
		draft: false,
		base: { ref: 'main' },
		head: {
			ref: 'jess/tin-603-skeleton-v5-parity',
			sha: sourceSha,
			repo: { full_name: repository },
		},
		...overrides,
	};
}

function sourceCore(outputs) {
	return {
		notice() {},
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
}

async function runSource({
	eventName = 'repository_dispatch',
	pr = pullRequest(),
	dispatchAction = 'shadow-source-build-v2',
	sourceRunner = 'ubuntu-latest',
	manualPr = '251',
	manualSha = sourceSha,
} = {}) {
	const outputs = {};
	const github = { rest: { pulls: { get: async () => ({ data: pr }) } } };
	const context = {
		eventName,
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { action: dispatchAction },
	};
	const processFixture = {
		env: {
			SOURCE_RUNNER: sourceRunner,
			REQUEST_PR_NUMBER: manualPr,
			REQUEST_SOURCE_SHA: manualSha,
		},
	};
	await executeSourceResolver(github, context, sourceCore(outputs), processFixture);
	return outputs;
}

assert.equal((await runSource()).build, 'true', 'exact manual same-repo PR builds');
await assert.rejects(
	() =>
		runSource({
			pr: pullRequest({ head: { ...pullRequest().head, repo: { full_name: 'fork/blog' } } }),
		}),
	/not an open same-repo main PR/,
	'fork PR is build-ineligible',
);
await assert.rejects(
	() => runSource({ pr: pullRequest({ state: 'closed' }) }),
	/not an open same-repo main PR/,
	'closed PR cannot be built manually',
);
await assert.rejects(
	() => runSource({ dispatchAction: 'arbitrary' }),
	/Unsupported event repository_dispatch/,
	'arbitrary repository dispatch type fails closed',
);
await assert.rejects(
	() => runSource({ manualSha: 'a'.repeat(39) }),
	/exact 40-character lowercase commit SHA/,
	'non-exact source SHA fails closed',
);
await assert.rejects(
	() => runSource({ sourceRunner: 'tinyland-dind' }),
	/Unsupported source runner/,
	'unsupported or privileged runner fails closed',
);
assert.equal(
	(await runSource({ pr: pullRequest({ draft: true }) })).build,
	'true',
	'draft PR may build source evidence',
);

function metadata(overrides = {}) {
	return {
		schemaVersion: 2,
		repository,
		eventName: 'repository_dispatch',
		sourceBranch: pullRequest().head.ref,
		sourceSha,
		prNumber: 251,
		imageTag: `shadow-pr-251-${sourceSha.slice(0, 12)}-amd64`,
		sourceRunner: 'ubuntu-latest',
		archiveDigest,
		sourceWorkflowRunId: 9001,
		sourceWorkflowRunAttempt: 1,
		...overrides,
	};
}

function upstreamRun(overrides = {}) {
	return {
		id: 9001,
		run_attempt: 1,
		name: 'Build shadow source v2',
		conclusion: 'success',
		repository: { full_name: repository },
		path: '.github/workflows/shadow-source-build-v2.yml@refs/heads/main',
		event: 'repository_dispatch',
		head_branch: 'main',
		...overrides,
	};
}

async function runTrusted({
	pr = pullRequest(),
	meta = metadata(),
	upstream = upstreamRun(),
	publishEnabled = 'true',
} = {}) {
	const fixtureDir = await mkdtemp(join(tmpdir(), 'shadow-resolver-'));
	const metadataPath = join(fixtureDir, 'shadow-source-metadata.json');
	await writeFile(metadataPath, `${JSON.stringify(meta)}\n`);
	const outputs = {};
	const github = {
		rest: {
			actions: { getWorkflowRun: async () => ({ data: upstream }) },
			pulls: { get: async () => ({ data: pr }) },
		},
	};
	const context = {
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { workflow_run: { id: 9001 } },
	};
	const core = {
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
	const processFixture = {
		env: {
			METADATA_PATH: metadataPath,
			SOURCE_PUBLISH_ENABLED: publishEnabled,
		},
	};
	try {
		await executeTrustedResolver(github, context, core, processFixture);
		return outputs;
	} finally {
		await rm(fixtureDir, { recursive: true, force: true });
	}
}

assert.deepEqual(
	await runTrusted(),
	{
		publish: 'true',
		branch: pullRequest().head.ref,
		sha: sourceSha,
		pr_number: '251',
		image_tag: `shadow-pr-251-${sourceSha.slice(0, 12)}-amd64`,
		archive_digest: archiveDigest,
		source_run_id: '9001',
		source_run_attempt: '1',
	},
	'exact default-owned repository-dispatch PR artifact may publish without requesting apply',
);
await assert.rejects(
	() => runTrusted({ pr: pullRequest({ state: 'closed' }) }),
	/closed, forked, retargeted, or no longer/,
	'closed PR fails trusted resolver',
);
await assert.rejects(
	() => runTrusted({ pr: pullRequest({ draft: true }) }),
	/closed, forked, retargeted, or no longer/,
	'redrafted PR fails trusted publication resolver',
);
await assert.rejects(
	() => runTrusted({ pr: pullRequest({ head: { ...pullRequest().head, sha: otherSha } }) }),
	/no longer at/,
	'head change after build fails trusted resolver',
);
await assert.rejects(
	() =>
		runTrusted({
			pr: pullRequest({
				head: { ...pullRequest().head, repo: { full_name: 'fork/blog' } },
			}),
		}),
	/closed, forked, retargeted, or no longer/,
	'fork substitution fails trusted resolver',
);
await assert.rejects(
	() => runTrusted({ meta: metadata({ archiveDigest: `sha256:${'c'.repeat(63)}` }) }),
	/malformed or does not bind/,
	'non-exact OCI digest fails trusted resolver',
);
await assert.rejects(
	() => runTrusted({ meta: metadata({ imageTag: 'shadow-latest' }) }),
	/does not equal exact tag/,
	'mutable or inexact tag fails trusted resolver',
);
await assert.rejects(
	() =>
		runTrusted({
			meta: metadata({ eventName: 'pull_request' }),
			upstream: upstreamRun({ event: 'pull_request', head_branch: pullRequest().head.ref }),
		}),
	/Upstream run does not satisfy/,
	'branch-authored pull_request workflow is not a trusted source',
);
assert.equal((await runTrusted({ publishEnabled: 'false' })).publish, 'false', 'unset publication gate is build-only');
await assert.rejects(
	() =>
		runTrusted({
			meta: metadata({ eventName: 'repository_dispatch' }),
			upstream: upstreamRun({ event: 'repository_dispatch', head_branch: 'release-tag' }),
		}),
	/arbitrary ref/,
	'trusted resolver rejects manual source workflow from arbitrary ref',
);

function liveGithub({ pr = pullRequest(), variables = {} } = {}) {
	return {
		rest: {
			actions: {
				getRepoVariable: async ({ name }) => {
					if (!(name in variables)) {
						const error = new Error('not found');
						error.status = 404;
						throw error;
					}
					return { data: { value: variables[name] } };
				},
			},
			pulls: { get: async () => ({ data: pr }) },
		},
	};
}

const liveContext = { repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' } };
const liveEnv = {
	EXPECTED_PR: '251',
	EXPECTED_SHA: sourceSha,
	EXPECTED_BRANCH: pullRequest().head.ref,
};
await executePublishRecheck(
	liveGithub({ variables: { BLOG_SHADOW_SOURCE_PUBLISH_ENABLED: 'true' } }),
	liveContext,
	{},
	{ env: liveEnv },
);
await assert.rejects(
	() => executePublishRecheck(liveGithub(), liveContext, {}, { env: liveEnv }),
	/not true at package-write time/,
	'publication kill switch changing during the build fails immediately before package write',
);
await assert.rejects(
	() =>
		executePublishRecheck(
			liveGithub({
				pr: pullRequest({ draft: true }),
				variables: { BLOG_SHADOW_SOURCE_PUBLISH_ENABLED: 'true' },
			}),
			liveContext,
			{},
			{ env: liveEnv },
		),
	/changed after source provenance resolution/,
	'redraft immediately before package write fails closed',
);
console.log('Shadow preview v2 resolver fixtures passed');

function extractGithubScript(workflow, stepName) {
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
