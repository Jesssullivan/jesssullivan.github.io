/**
 * Default-branch-owned admission for an explicit tss-shadow Pages upload.
 * This module never checks out or executes code from the requested PR.
 */

export const SHADOW_PAGES_REPOSITORY = 'Jesssullivan/jesssullivan.github.io';
export const SHADOW_PAGES_DISPATCH = 'tss-shadow-pages-publish-v2';
export const SHADOW_SOURCE_WORKFLOW = '.github/workflows/shadow-source-build-v2.yml';
export const CACHE_FREE_WORKFLOW = '.github/workflows/cache-free-pr-diagnostic.yml';

// Reviewed diagnostic recipe at candidate 5f7161f627f987c0e7d7ae4b2cda5d7a9d5b7d97.
// The workflow is not yet on default main. Pin both the workflow and its invoked
// script so an arbitrary PR-authored green job cannot become Pages authority.
export const REVIEWED_CACHE_FREE_WORKFLOW_BLOB = '6030d479c17b91c9b367b1d83c94b7f4f3c26e15';
export const REVIEWED_CACHE_FREE_SCRIPT_BLOB = 'd5d82a618134aa55c41c0dc749120ad9b413026b';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SOURCE_JOB = 'Build unprivileged OCI archive';
const DIAGNOSTIC_JOB = 'Supplemental cache-free Bazel check, test, e2e';
const DIAGNOSTIC_STEPS = [
	'Direct public Bazel check (supplemental)',
	'Direct public Bazel test (supplemental)',
	'Direct public Bazel e2e (supplemental)',
];

function requireThat(condition, message) {
	if (!condition) throw new Error(message);
}

function positiveInteger(value) {
	return Number.isSafeInteger(value) && value > 0;
}

function workflowPath(run) {
	return String(run?.path || '').split('@')[0];
}

function successfulJob(jobs, name) {
	const matches = jobs.filter((job) => job.name === name);
	requireThat(matches.length === 1 && matches[0].conclusion === 'success', `Required job ${name} did not succeed exactly once.`);
	return matches[0];
}

function successfulStep(job, name) {
	const matches = (job.steps || []).filter((step) => step.name === name);
	requireThat(matches.length === 1 && matches[0].conclusion === 'success', `Required step ${name} did not succeed exactly once.`);
}

export function validateShadowPagesRequest({ eventName, action, repository, ref, payload }) {
	requireThat(eventName === 'repository_dispatch' && action === SHADOW_PAGES_DISPATCH, 'Shadow Pages requires its typed repository dispatch.');
	requireThat(repository === SHADOW_PAGES_REPOSITORY && ref === 'refs/heads/main', 'Shadow Pages must run from the canonical default branch.');
	requireThat(payload && typeof payload === 'object' && !Array.isArray(payload), 'Shadow Pages request payload is missing.');
	const allowed = new Set([
		'deploy',
		'source_pr',
		'source_sha',
		'source_run_id',
		'source_run_attempt',
		'diagnostic_run_id',
		'diagnostic_run_attempt',
	]);
	requireThat(Object.keys(payload).every((key) => allowed.has(key)), 'Shadow Pages request contains an unsupported input.');
	requireThat(payload.deploy === true, 'Shadow Pages requires deploy=true.');
	requireThat(positiveInteger(payload.source_pr), 'source_pr must be a positive integer.');
	requireThat(SHA.test(payload.source_sha || ''), 'source_sha must be an exact lowercase commit SHA.');
	requireThat(positiveInteger(payload.source_run_id), 'source_run_id must be a positive integer.');
	requireThat(positiveInteger(payload.source_run_attempt), 'source_run_attempt must be a positive integer.');
	requireThat(positiveInteger(payload.diagnostic_run_id), 'diagnostic_run_id must be a positive integer.');
	requireThat(positiveInteger(payload.diagnostic_run_attempt), 'diagnostic_run_attempt must be a positive integer.');
	return payload;
}

export function validateShadowPagesMetadata(metadata, request) {
	requireThat(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'Source metadata is missing.');
	requireThat(metadata.schemaVersion === 2, 'Source metadata schema is not v2.');
	requireThat(metadata.repository === SHADOW_PAGES_REPOSITORY, 'Source metadata repository mismatch.');
	requireThat(metadata.eventName === 'repository_dispatch', 'Source metadata event mismatch.');
	requireThat(typeof metadata.sourceBranch === 'string' && metadata.sourceBranch.length > 0, 'Source metadata branch is missing.');
	requireThat(metadata.sourceSha === request.source_sha, 'Source metadata SHA mismatch.');
	requireThat(metadata.prNumber === request.source_pr, 'Source metadata PR mismatch.');
	requireThat(metadata.sourceWorkflowRunId === request.source_run_id, 'Source metadata run ID mismatch.');
	requireThat(metadata.sourceWorkflowRunAttempt === request.source_run_attempt, 'Source metadata run attempt mismatch.');
	requireThat(metadata.sourceRunner === 'ubuntu-latest', 'Source metadata runner mismatch.');
	requireThat(DIGEST.test(metadata.archiveDigest || ''), 'Source metadata archive digest is malformed.');
	const tag = `shadow-pr-${request.source_pr}-${request.source_sha.slice(0, 12)}-amd64`;
	requireThat(metadata.imageTag === tag, 'Source metadata image tag mismatch.');
	return { branch: metadata.sourceBranch, tag, digest: metadata.archiveDigest };
}

/**
 * Read-only, exact-project Cloudflare preflight before the separate upload.
 * Never return or include the token, response body, or headers in an error.
 * A successful read does not establish Pages Write permission.
 */
export async function verifyTssPagesProject({ accountId, apiToken, fetchImpl = globalThis.fetch }) {
	requireThat(/^[0-9a-f]{32}$/i.test(accountId || ''), 'Cloudflare account ID is missing or malformed.');
	requireThat(typeof apiToken === 'string' && apiToken.length > 0, 'Cloudflare Pages token is missing.');
	let response;
	try {
		response = await fetchImpl(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/tss-shadow`,
			{
				method: 'GET',
				redirect: 'error',
				headers: { Accept: 'application/json', Authorization: `Bearer ${apiToken}` },
				signal: AbortSignal.timeout(10_000),
			},
		);
	} catch {
		throw new Error('Cloudflare Pages project preflight transport failed.');
	}
	requireThat(response.status === 200, `Cloudflare Pages project preflight returned HTTP ${response.status}.`);
	let payload;
	try {
		const body = await response.text();
		requireThat(body.length <= 1_000_000, 'Cloudflare Pages project preflight response is oversized.');
		payload = JSON.parse(body);
	} catch {
		throw new Error('Cloudflare Pages project preflight response is invalid.');
	}
	requireThat(
		payload?.success === true &&
			payload.result?.name === 'tss-shadow' &&
			payload.result?.production_branch === 'main' &&
			Array.isArray(payload.result?.domains) &&
			payload.result.domains.includes('tss.tinyland.dev') &&
			payload.result.domains.every((domain) =>
				domain === 'tss-shadow.pages.dev' || domain === 'tss.tinyland.dev'),
		'Cloudflare Pages project is not the existing tss-shadow/main target with tss.tinyland.dev.',
	);
	return { project: 'tss-shadow', productionBranch: 'main', domain: 'tss.tinyland.dev' };
}

/** Resolve provenance through the GitHub REST client supplied by github-script. */
export async function resolveShadowPagesPublish({ github, context, metadata, initialEnabled }) {
	const repository = `${context.repo.owner}/${context.repo.repo}`;
	const request = validateShadowPagesRequest({
		eventName: context.eventName,
		action: context.payload.action,
		repository,
		ref: context.ref,
		payload: context.payload.client_payload,
	});
	requireThat(initialEnabled === 'true', 'TSS_SHADOW_PAGES_ENABLED is not true.');
	const checked = validateShadowPagesMetadata(metadata, request);
	const { owner, repo } = context.repo;

	const pr = (await github.rest.pulls.get({ owner, repo, pull_number: request.source_pr })).data;
	requireThat(
		pr.state === 'open' &&
			pr.base?.ref === 'main' &&
			pr.head?.repo?.full_name === repository &&
			pr.head?.sha === request.source_sha &&
			pr.head?.ref === checked.branch,
		'PR is closed, forked, retargeted or no longer at the exact source head.',
	);
	// Draft is allowed for this explicitly requested nonproduction TSS upload.

	const source = (await github.rest.actions.getWorkflowRun({ owner, repo, run_id: request.source_run_id })).data;
	requireThat(
		source.id === request.source_run_id &&
			source.run_attempt === request.source_run_attempt &&
			source.status === 'completed' &&
			source.conclusion === 'success' &&
			source.name === 'Build shadow source v2' &&
			workflowPath(source) === SHADOW_SOURCE_WORKFLOW &&
			source.event === 'repository_dispatch' &&
			source.repository?.full_name === repository &&
			source.head_repository?.full_name === repository &&
			source.head_branch === 'main',
		'Source run does not match the successful default-owned shadow build contract.',
	);
	const sourceJobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
		owner,
		repo,
		run_id: request.source_run_id,
		filter: 'latest',
		per_page: 100,
	});
	const build = successfulJob(sourceJobs, SOURCE_JOB);
	for (const name of ['Build source image without registry authority', 'Record immutable build metadata', 'Upload unprivileged OCI archive']) {
		successfulStep(build, name);
	}

	const diagnostic = (await github.rest.actions.getWorkflowRun({ owner, repo, run_id: request.diagnostic_run_id })).data;
	requireThat(
		diagnostic.id === request.diagnostic_run_id &&
			diagnostic.run_attempt === request.diagnostic_run_attempt &&
			diagnostic.status === 'completed' &&
			diagnostic.conclusion === 'success' &&
			diagnostic.name === 'Cache-free PR Bazel diagnostic' &&
			workflowPath(diagnostic) === CACHE_FREE_WORKFLOW &&
			diagnostic.event === 'pull_request' &&
			diagnostic.repository?.full_name === repository &&
			diagnostic.head_repository?.full_name === repository &&
			diagnostic.head_sha === request.source_sha &&
			diagnostic.head_branch === checked.branch &&
			diagnostic.pull_requests?.some((item) => item.number === request.source_pr && item.head?.sha === request.source_sha && item.base?.ref === 'main'),
		'Diagnostic run is not a successful exact-head same-repository PR proof.',
	);
	const diagnosticJobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
		owner,
		repo,
		run_id: request.diagnostic_run_id,
		filter: 'latest',
		per_page: 100,
	});
	successfulJob(diagnosticJobs, 'Resolve labeled exact open PR source');
	const diagnosticJob = successfulJob(diagnosticJobs, DIAGNOSTIC_JOB);
	for (const name of DIAGNOSTIC_STEPS) successfulStep(diagnosticJob, name);

	for (const [path, expected] of [
		[CACHE_FREE_WORKFLOW, REVIEWED_CACHE_FREE_WORKFLOW_BLOB],
		['scripts/check-cache-free-pr-diagnostic.sh', REVIEWED_CACHE_FREE_SCRIPT_BLOB],
	]) {
		const file = (await github.rest.repos.getContent({ owner, repo, path, ref: request.source_sha })).data;
		requireThat(!Array.isArray(file) && file.type === 'file' && file.sha === expected, `Reviewed diagnostic source blob changed: ${path}.`);
	}

	return {
		prNumber: String(request.source_pr),
		sourceSha: request.source_sha,
		sourceBranch: checked.branch,
		sourceRunId: String(request.source_run_id),
		sourceRunAttempt: String(request.source_run_attempt),
		diagnosticRunId: String(request.diagnostic_run_id),
		imageTag: checked.tag,
		archiveDigest: checked.digest,
	};
}
