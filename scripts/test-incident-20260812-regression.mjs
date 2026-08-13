import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Negative regression fixtures for the 2026-08-12 publication incident.
// Three real run signatures are encoded against the v2 resolver/publish
// classification logic:
//
//   31649363937  digest pushed, but nothing deployed
//   31649774009  receiver run completed with zero executed steps
//   31649623541  build ran, deploy step skipped
//
// The acceptance for this fixture is that it distinguishes "build ran" from
// "deploy ran": none of the three runs may ever classify as deploy-success.

const productionWorkflow = await readFile(
	new URL('../.github/workflows/cloudflare-pages-production-v2.yml', import.meta.url),
	'utf8',
);
const shadowPublishWorkflow = await readFile(
	new URL('../.github/workflows/shadow-source-publish-v2.yml', import.meta.url),
	'utf8',
);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const executeProductionResolver = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(productionWorkflow, 'Resolve and verify exact source SHA')
		.replace('20 * 60 * 1_000', '1')
		.replace('15_000', '0'),
);
const executeConsumeGate = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(shadowPublishWorkflow, 'Require successful unprivileged build job'),
);
const executeTrustedResolver = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript(shadowPublishWorkflow, 'Verify exact source metadata and live PR'),
);

const repository = 'Jesssullivan/jesssullivan.github.io';
const sourceSha = 'a'.repeat(40);
const archiveDigest = `sha256:${'d'.repeat(64)}`;
const DIGEST_PUSHED_UNDEPLOYED_RUN = 31649363937;
const ZERO_STEP_RECEIVER_RUN = 31649774009;
const BUILD_RAN_DEPLOY_SKIPPED_RUN = 31649623541;

// The only deploy-success signal the v2 production contract ever emits is the
// resolver output deploy === 'true'. Every incident fixture must classify as
// something weaker: build-only outputs or a fail-closed throw.
function deployRan(outputs) {
	return outputs.deploy === 'true';
}

function authorityJobs() {
	return [
		{ name: 'build-and-test', conclusion: 'success' },
		{ name: 'bazel-remote-gates', conclusion: 'success' },
	];
}

function ciRun(overrides = {}) {
	return {
		id: BUILD_RAN_DEPLOY_SKIPPED_RUN,
		name: 'CI',
		conclusion: 'success',
		event: 'push',
		head_branch: 'main',
		head_repository: { full_name: repository },
		head_sha: sourceSha,
		html_url: `https://github.example/ci/${BUILD_RAN_DEPLOY_SKIPPED_RUN}`,
		...overrides,
	};
}

async function runProduction({
	eventName,
	run = ciRun(),
	jobs = authorityJobs(),
	productionEnabled = 'true',
	manualDeploy = 'true',
}) {
	const outputs = {};
	const listJobsForWorkflowRun = async () => ({ data: { jobs } });
	const listWorkflowRuns = async () => ({
		data: { workflow_runs: [{ status: 'completed', ...ciRun() }] },
	});
	const github = {
		rest: {
			actions: { listJobsForWorkflowRun, listWorkflowRuns },
			git: { getRef: async () => ({ data: { object: { sha: sourceSha } } }) },
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
		payload:
			eventName === 'workflow_run'
				? { workflow_run: run }
				: { action: 'cloudflare-pages-production-v2' },
	};
	const processFixture = {
		env: {
			REQUEST_SOURCE_SHA: sourceSha,
			REQUEST_DEPLOY: manualDeploy,
			PRODUCTION_ENABLED: productionEnabled,
		},
	};
	await executeProductionResolver(github, context, core, processFixture);
	return outputs;
}

// --- 31649623541: build ran, deploy step skipped ---------------------------
// The canonical CI push run succeeded, the receiver resolved it, and the
// deploy step was skipped by design. This is build evidence only.
const buildOnly = await runProduction({
	eventName: 'workflow_run',
	run: ciRun(),
	productionEnabled: 'true',
});
assert.equal(buildOnly.source_sha, sourceSha, '31649623541: build provenance is recorded');
assert.equal(
	buildOnly.deploy,
	'false',
	'31649623541: successful build with skipped deploy classifies build-only',
);
assert.equal(
	deployRan(buildOnly),
	false,
	'31649623541: "build ran" must never read as "deploy ran"',
);

// --- 31649774009: receiver completed with zero executed steps --------------
// A workflow_run receiver that completes without executing any step leaves an
// empty jobs list behind. Anything consuming that run as authority must fail
// closed, and the shadow consume gate must classify it as nothing-to-publish.
await assert.rejects(
	() =>
		runProduction({
			eventName: 'workflow_run',
			run: ciRun({ id: ZERO_STEP_RECEIVER_RUN }),
			jobs: [],
		}),
	/Required CI job build-and-test was missing or not successful/,
	'31649774009: zero executed jobs can never satisfy production authority',
);
{
	const outputs = {};
	const github = {
		rest: { actions: { listJobsForWorkflowRun: async () => ({ data: { jobs: [] } }) } },
		paginate: async (method, args) => (await method(args)).data.jobs,
	};
	const context = {
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { workflow_run: { id: ZERO_STEP_RECEIVER_RUN } },
	};
	const core = {
		notice() {},
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
	await executeConsumeGate(github, context, core, { env: {} });
	assert.equal(
		outputs.consume,
		'false',
		'31649774009: zero-step upstream run is classified NOT-consumable, nothing publishes',
	);
	assert.equal(deployRan(outputs), false, '31649774009: zero-step run is never deploy-success');
}

// --- 31649363937: digest pushed, but nothing deployed ----------------------
// A valid OCI archive digest existed and the package could even be published,
// yet no deployment happened. Digest presence must not classify as deployment:
// the shadow publish contract has no deploy/apply output at all, and the
// publish flag is owned by the kill switch, not by digest availability.
async function runTrusted({ publishEnabled }) {
	const fixtureDir = await mkdtemp(join(tmpdir(), 'incident-20260812-'));
	const metadataPath = join(fixtureDir, 'shadow-source-metadata.json');
	const pr = {
		number: 251,
		state: 'open',
		draft: false,
		base: { ref: 'main' },
		head: {
			ref: 'jess/tin-603-skeleton-v5-parity',
			sha: sourceSha,
			repo: { full_name: repository },
		},
	};
	const metadata = {
		schemaVersion: 2,
		repository,
		eventName: 'repository_dispatch',
		sourceBranch: pr.head.ref,
		sourceSha,
		prNumber: pr.number,
		imageTag: `shadow-pr-${pr.number}-${sourceSha.slice(0, 12)}-amd64`,
		sourceRunner: 'ubuntu-latest',
		archiveDigest,
		sourceWorkflowRunId: DIGEST_PUSHED_UNDEPLOYED_RUN,
		sourceWorkflowRunAttempt: 1,
	};
	await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`);
	const outputs = {};
	const github = {
		rest: {
			actions: {
				getWorkflowRun: async () => ({
					data: {
						id: DIGEST_PUSHED_UNDEPLOYED_RUN,
						run_attempt: 1,
						name: 'Build shadow source v2',
						conclusion: 'success',
						repository: { full_name: repository },
						path: '.github/workflows/shadow-source-build-v2.yml@refs/heads/main',
						event: 'repository_dispatch',
						head_branch: 'main',
					},
				}),
			},
			pulls: { get: async () => ({ data: pr }) },
		},
	};
	const context = {
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { workflow_run: { id: DIGEST_PUSHED_UNDEPLOYED_RUN } },
	};
	const core = {
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
	try {
		await executeTrustedResolver(github, context, core, {
			env: { METADATA_PATH: metadataPath, SOURCE_PUBLISH_ENABLED: publishEnabled },
		});
		return outputs;
	} finally {
		await rm(fixtureDir, { recursive: true, force: true });
	}
}

const digestOnly = await runTrusted({ publishEnabled: 'false' });
assert.equal(digestOnly.archive_digest, archiveDigest, '31649363937: the digest really was present');
assert.equal(
	digestOnly.publish,
	'false',
	'31649363937: a pushed digest with the gate down classifies NOT-deployed',
);
const digestPublishable = await runTrusted({ publishEnabled: 'true' });
for (const outputs of [digestOnly, digestPublishable]) {
	assert.equal(deployRan(outputs), false, '31649363937: digest evidence is never deploy-success');
	assert.equal('deploy' in outputs, false, 'shadow publish contract emits no deploy output');
	assert.equal('apply' in outputs, false, 'shadow publish contract emits no apply output');
}

// --- positive control ------------------------------------------------------
// The classification logic CAN express deploy-ran, so the three negatives
// above are meaningful: only an operator repository_dispatch with the kill
// switch up ever yields deploy === 'true'.
const operatorDeploy = await runProduction({
	eventName: 'repository_dispatch',
	productionEnabled: 'true',
	manualDeploy: 'true',
});
assert.equal(deployRan(operatorDeploy), true, 'operator dispatch with gates up is deploy-success');

console.log('incident 2026-08-12 regression fixtures passed');

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
