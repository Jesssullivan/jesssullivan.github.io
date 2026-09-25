import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
	CACHE_FREE_WORKFLOW,
	REVIEWED_CACHE_FREE_SCRIPT_BLOB,
	REVIEWED_CACHE_FREE_WORKFLOW_BLOB,
	SHADOW_PAGES_DISPATCH,
	SHADOW_PAGES_REPOSITORY,
	SHADOW_SOURCE_WORKFLOW,
	resolveShadowPagesPublish,
	validateShadowPagesMetadata,
	validateShadowPagesRequest,
	verifyTssPagesProject,
} from './shadow-pages-resolver.mjs';

const SOURCE_SHA = '5f7161f627f987c0e7d7ae4b2cda5d7a9d5b7d97';
const ARCHIVE_DIGEST = `sha256:${'a'.repeat(64)}`;

function fixture() {
	const request = {
		deploy: true,
		source_pr: 280,
		source_sha: SOURCE_SHA,
		source_run_id: 36103241938,
		source_run_attempt: 1,
		diagnostic_run_id: 36103275221,
		diagnostic_run_attempt: 1,
	};
	const metadata = {
		schemaVersion: 2,
		repository: SHADOW_PAGES_REPOSITORY,
		eventName: 'repository_dispatch',
		sourceBranch: 'candidate/home-projections-20260925',
		sourceSha: SOURCE_SHA,
		prNumber: 280,
		imageTag: 'shadow-pr-280-5f7161f627f9-amd64',
		sourceRunner: 'ubuntu-latest',
		archiveDigest: ARCHIVE_DIGEST,
		sourceWorkflowRunId: 36103241938,
		sourceWorkflowRunAttempt: 1,
	};
	const context = {
		eventName: 'repository_dispatch',
		ref: 'refs/heads/main',
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { action: SHADOW_PAGES_DISPATCH, client_payload: request },
	};
	const pr = {
		state: 'open',
		draft: true,
		base: { ref: 'main' },
		head: { repo: { full_name: SHADOW_PAGES_REPOSITORY }, sha: SOURCE_SHA, ref: metadata.sourceBranch },
	};
	const source = {
		id: request.source_run_id,
		run_attempt: 1,
		status: 'completed',
		conclusion: 'success',
		name: 'Build shadow source v2',
		path: SHADOW_SOURCE_WORKFLOW,
		event: 'repository_dispatch',
		repository: { full_name: SHADOW_PAGES_REPOSITORY },
		head_repository: { full_name: SHADOW_PAGES_REPOSITORY },
		head_branch: 'main',
	};
	const diagnostic = {
		id: request.diagnostic_run_id,
		run_attempt: 1,
		status: 'completed',
		conclusion: 'success',
		name: 'Cache-free PR Bazel diagnostic',
		path: CACHE_FREE_WORKFLOW,
		event: 'pull_request',
		repository: { full_name: SHADOW_PAGES_REPOSITORY },
		head_repository: { full_name: SHADOW_PAGES_REPOSITORY },
		head_sha: SOURCE_SHA,
		head_branch: metadata.sourceBranch,
		pull_requests: [{ number: 280, head: { sha: SOURCE_SHA }, base: { ref: 'main' } }],
	};
	const sourceJobs = [
		{
			name: 'Build unprivileged OCI archive',
			conclusion: 'success',
			steps: [
				{ name: 'Build source image without registry authority', conclusion: 'success' },
				{ name: 'Record immutable build metadata', conclusion: 'success' },
				{ name: 'Upload unprivileged OCI archive', conclusion: 'success' },
			],
		},
	];
	const diagnosticJobs = [
		{ name: 'Resolve labeled exact open PR source', conclusion: 'success' },
		{
			name: 'Supplemental cache-free Bazel check, test, e2e',
			conclusion: 'success',
			steps: [
				{ name: 'Direct public Bazel check (supplemental)', conclusion: 'success' },
				{ name: 'Direct public Bazel test (supplemental)', conclusion: 'success' },
				{ name: 'Direct public Bazel e2e (supplemental)', conclusion: 'success' },
			],
		},
	];
	const blobs = {
		[CACHE_FREE_WORKFLOW]: REVIEWED_CACHE_FREE_WORKFLOW_BLOB,
		'scripts/check-cache-free-pr-diagnostic.sh': REVIEWED_CACHE_FREE_SCRIPT_BLOB,
	};
	const github = {
		rest: {
			pulls: { get: async () => ({ data: pr }) },
			actions: {
			getWorkflowRun: async ({ run_id }) => ({ data: run_id === request.source_run_id ? source : diagnostic }),
			listJobsForWorkflowRun: async () => { throw new Error('paginate should handle this call'); },
			},
			repos: { getContent: async ({ path }) => ({ data: { type: 'file', sha: blobs[path] } }) },
		},
		paginate: async (_method, { run_id }) => (run_id === request.source_run_id ? sourceJobs : diagnosticJobs),
	};
	return { request, metadata, context, pr, source, diagnostic, sourceJobs, diagnosticJobs, blobs, github };
}

const good = fixture();
assert.equal(validateShadowPagesRequest({
	eventName: good.context.eventName,
	action: good.context.payload.action,
	repository: SHADOW_PAGES_REPOSITORY,
	ref: good.context.ref,
	payload: good.request,
}), good.request);
assert.equal(validateShadowPagesMetadata(good.metadata, good.request).digest, ARCHIVE_DIGEST);
assert.deepEqual(await resolveShadowPagesPublish({ ...good, initialEnabled: 'true' }), {
	prNumber: '280',
	sourceSha: SOURCE_SHA,
	sourceBranch: good.metadata.sourceBranch,
	sourceRunId: String(good.request.source_run_id),
	sourceRunAttempt: '1',
	diagnosticRunId: String(good.request.diagnostic_run_id),
	imageTag: good.metadata.imageTag,
	archiveDigest: ARCHIVE_DIGEST,
});

function rejectRequest(change, expected) {
	const value = fixture();
	change(value);
	assert.throws(() => validateShadowPagesRequest({
		eventName: value.context.eventName,
		action: value.context.payload.action,
		repository: `${value.context.repo.owner}/${value.context.repo.repo}`,
		ref: value.context.ref,
		payload: value.context.payload.client_payload,
	}), expected);
}

rejectRequest((v) => { v.context.eventName = 'workflow_dispatch'; }, /typed repository dispatch/);
rejectRequest((v) => { v.context.ref = 'refs/heads/candidate'; }, /default branch/);
rejectRequest((v) => { v.context.payload.client_payload.deploy = 'true'; }, /deploy=true/);
rejectRequest((v) => { v.context.payload.client_payload.project = 'transscendsurvival-org'; }, /unsupported input/);
rejectRequest((v) => { v.context.payload.client_payload.source_sha = 'abc'; }, /exact lowercase/);

async function rejectResolution(change, expected) {
	const value = fixture();
	change(value);
	await assert.rejects(resolveShadowPagesPublish({
		github: value.github,
		context: value.context,
		metadata: value.metadata,
		initialEnabled: 'true',
	}), expected);
}

await assert.rejects(resolveShadowPagesPublish({
	github: good.github,
	context: good.context,
	metadata: good.metadata,
	initialEnabled: 'false',
}), /TSS_SHADOW_PAGES_ENABLED/);
await rejectResolution((v) => { v.metadata.sourceSha = '0'.repeat(40); }, /metadata SHA mismatch/);
await rejectResolution((v) => { v.metadata.archiveDigest = 'not-a-digest'; }, /archive digest is malformed/);
await rejectResolution((v) => { v.pr.head.sha = '0'.repeat(40); }, /no longer at the exact source head/);
await rejectResolution((v) => { v.source.conclusion = 'failure'; }, /source build contract/);
await rejectResolution((v) => { v.source.path = 'other.yml'; }, /source build contract/);
await rejectResolution((v) => { v.sourceJobs[0].steps[0].conclusion = 'skipped'; }, /Build source image/);
await rejectResolution((v) => { v.diagnostic.conclusion = 'failure'; }, /successful exact-head/);
await rejectResolution((v) => { v.diagnostic.head_sha = '0'.repeat(40); }, /successful exact-head/);
await rejectResolution((v) => { v.diagnosticJobs[1].conclusion = 'skipped'; }, /Supplemental cache-free/);
await rejectResolution((v) => { v.diagnosticJobs[1].steps[2].conclusion = 'skipped'; }, /Direct public Bazel e2e/);
await rejectResolution((v) => { v.blobs[CACHE_FREE_WORKFLOW] = '0'.repeat(40); }, /Reviewed diagnostic source blob changed/);
await rejectResolution((v) => { v.blobs['scripts/check-cache-free-pr-diagnostic.sh'] = '0'.repeat(40); }, /Reviewed diagnostic source blob changed/);

let preflightUrl = '';
let preflightInit;
const project = await verifyTssPagesProject({
	accountId: 'a'.repeat(32),
	apiToken: 'fixture-token',
	fetchImpl: async (url, init) => {
		preflightUrl = url;
		preflightInit = init;
		return {
			status: 200,
			text: async () => JSON.stringify({
				success: true,
				result: { name: 'tss-shadow', production_branch: 'main', domains: ['tss-shadow.pages.dev', 'tss.tinyland.dev'] },
			}),
		};
	},
});
assert.deepEqual(project, { project: 'tss-shadow', productionBranch: 'main', domain: 'tss.tinyland.dev' });
assert.equal(preflightUrl, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/pages/projects/tss-shadow`);
assert.equal(preflightInit.method, 'GET');
assert.equal(preflightInit.redirect, 'error');
assert.equal(preflightInit.headers.Authorization, 'Bearer fixture-token');
await assert.rejects(verifyTssPagesProject({
	accountId: 'a'.repeat(32),
	apiToken: 'fixture-token',
	fetchImpl: async () => ({ status: 403, text: async () => 'sensitive-body-must-not-appear' }),
}), (error) => error.message === 'Cloudflare Pages project preflight returned HTTP 403.');
await assert.rejects(verifyTssPagesProject({
	accountId: 'a'.repeat(32),
	apiToken: 'fixture-token',
	fetchImpl: async () => ({
		status: 200,
		text: async () => JSON.stringify({
			success: true,
			result: { name: 'transscendsurvival-org', production_branch: 'main', domains: ['tss.tinyland.dev'] },
		}),
	}),
}), /not the existing tss-shadow/);
for (const unexpectedDomain of ['transscendsurvival.org', 'www.transscendsurvival.org', 'unknown.example']) {
	await assert.rejects(verifyTssPagesProject({
		accountId: 'a'.repeat(32),
		apiToken: 'fixture-token',
		fetchImpl: async () => ({
			status: 200,
			text: async () => JSON.stringify({
				success: true,
				result: {
					name: 'tss-shadow',
					production_branch: 'main',
					domains: ['tss.tinyland.dev', unexpectedDomain],
				},
			}),
		}),
	}), /not the existing tss-shadow/);
}
await assert.rejects(verifyTssPagesProject({
	accountId: 'a'.repeat(32),
	apiToken: 'fixture-token',
	fetchImpl: async () => ({
		status: 200,
		text: async () => JSON.stringify({
			success: true,
			result: { name: 'tss-shadow', production_branch: 'preview', domains: [] },
		}),
	}),
}), /not the existing tss-shadow/);

const workflow = await readFile(new URL('../../.github/workflows/cloudflare-pages-shadow-v2.yml', import.meta.url), 'utf8');
assert.match(workflow, /types: \[tss-shadow-pages-publish-v2\]/);
assert.doesNotMatch(workflow, /^\s*workflow_dispatch:/m);
assert.match(workflow, /TSS_SHADOW_PAGES_ENABLED/);
assert.match(workflow, /workingDirectory: \$\{\{ runner\.temp \}\}\/tss-pages-publisher-cwd/);
assert.match(workflow, /command: pages deploy \$\{\{ runner\.temp \}\}\/build --project-name=tss-shadow --branch=main/);
assert.match(workflow, /trustedRoutes\.equals\(extractedRoutes\)/);
assert.match(workflow, /copyFileSync\(trustedFunction, join\(isolatedCwd, functionPath\)\)/);
assert.match(workflow, /shadow-pages-denial-guard-receipt\.json/);
assert.match(workflow, /Verify the held post remains denied on both URL forms/);
assert.match(workflow, /for route in '\/blog\/ssh-macos-kvm-hid-accessory-approval' '\/blog\/ssh-macos-kvm-hid-accessory-approval\/'/);
assert.match(workflow, /\[\[ "\$\{status\}" = '404' \]\]/);
assert.match(workflow, /grep -Eiq '\^cache-control:/);
assert.match(workflow, /grep -Eiq '\^x-robots-tag:/);
assert.ok(workflow.indexOf('Read-only preflight of the existing TSS Pages target') < workflow.indexOf('Revalidate TSS kill switch and exact live PR immediately before upload'));
assert.ok(workflow.indexOf('Revalidate TSS kill switch and exact live PR immediately before upload') < workflow.indexOf('Publish exact static artifact and trusted guard to the isolated TSS Pages project'));
