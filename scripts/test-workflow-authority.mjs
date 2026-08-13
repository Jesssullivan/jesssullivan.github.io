import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';

const fromRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fromRoot(path), 'utf8');

const paths = {
	production: '.github/workflows/cloudflare-pages-production-v2.yml',
	parity: '.github/workflows/cloudflare-pages-parity-v2.yml',
	cachePurge: '.github/workflows/cloudflare-cache-purge-v2.yml',
	shadowSource: '.github/workflows/shadow-source-build-v2.yml',
	shadowPublish: '.github/workflows/shadow-source-publish-v2.yml',
	pagesRollback: '.github/workflows/github-pages-rollback-v2.yml',
	productionHealth: '.github/workflows/production-health-v2.yml',
	privateCv: '.github/workflows/private-cv-authority-v2.yml',
};

const [production, parity, cachePurge, shadowSource, shadowPublish, pagesRollback, productionHealth, privateCv] =
	await Promise.all(Object.values(paths).map(read));
const [dockerfile, layout, vite, packageJson, stamper, validator, themeSwitcher] = await Promise.all(
	[
		'Dockerfile.shadow',
		'src/routes/+layout.svelte',
		'vite.config.ts',
		'package.json',
		'scripts/stamp-deploy-tier-output.mjs',
		'scripts/validate-deploy-tier-output.mjs',
		'src/lib/components/ThemeSwitcher.svelte',
	].map(read),
);

function requireAll(source, needles, label) {
	for (const needle of needles) {
		assert.ok(source.includes(needle), `${label} is missing: ${needle}`);
	}
}

function forbid(source, pattern, label) {
	assert.doesNotMatch(source, pattern, label);
}

function requireOrder(source, needles, label) {
	let previous = -1;
	for (const needle of needles) {
		const current = source.indexOf(needle, previous + 1);
		assert.ok(current > previous, `${label}: ${needle}`);
		previous = current;
	}
}

function requireAbsent(path, label = path) {
	assert.equal(existsSync(fromRoot(path)), false, `${label} must remain retired`);
}

requireAll(
	shadowSource,
	[
		'name: Build shadow source v2',
		'permissions: {}',
		'types: [shadow-source-build-v2]',
		'github.event.client_payload.source_pr',
		'github.event.client_payload.source_sha',
		'pr.state !== "open"',
		'pr.head.repo?.full_name !== expectedRepository',
		'pr.head.sha !== sha',
		'allowedSourceRunners = new Set(["ubuntu-latest"])',
		'Build unprivileged OCI archive',
		'PUBLIC_SOURCE_SHA=${{ needs.resolve.outputs.sha }}',
		'push: false',
		'type=docker,dest=',
		'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
	],
	'shadow source workflow',
);
forbid(shadowSource, /^ {2}pull_request:|^\s*workflow_dispatch:/m, 'shadow source must be default-owned dispatch only');
forbid(shadowSource, /cache-from:|cache-to:/, 'PR image builds must not share mutable caches');
forbid(
	shadowSource,
	/secrets\.|packages: write|create-github-app-token|docker\/login-action|createWorkflowDispatch/,
	'shadow source must not carry publish, secret, or dispatch authority',
);

requireAll(
	shadowPublish,
	[
		'workflow_run:',
		"workflows: ['Build shadow source v2']",
		'candidate.name === "Build unprivileged OCI archive"',
		"if: steps.upstream.outputs.consume == 'true'",
		'workflowPath !== ".github/workflows/shadow-source-build-v2.yml"',
		'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c',
		'BLOG_SHADOW_SOURCE_PUBLISH_ENABLED',
		'upstream.event !== "repository_dispatch"',
		'const exactTag = `shadow-pr-${pr.number}-${metadata.sourceSha.slice(0, 12)}-amd64`',
		'pr.draft ||',
		'Revalidate publish authority immediately before package write',
		'name: "BLOG_SHADOW_SOURCE_PUBLISH_ENABLED"',
		'[[ ! "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]]',
	],
	'shadow publication workflow',
);
forbid(
	`${shadowSource}\n${shadowPublish}`,
	/request_apply|requestApply|apply_requested|createWorkflowDispatch|createDispatchEvent|create-github-app-token|BLOG_SHADOW_APPLY_ENABLED|BLOG_SHADOW_DISPATCH_APP|blog-shadow-preview-deploy\.yml|blog-shadow-preview-apply-v2\.yml|environment:\s*blog-shadow-dispatch/,
	'shadow authority must remain publish-only',
);
forbid(shadowPublish, /actions\/checkout/, 'trusted publication must never check out PR source');
forbid(shadowPublish, /BLOG_SHADOW_DISPATCH_TOKEN/, 'retired long-lived dispatch token must remain absent');
requireOrder(
	shadowPublish,
	['name: Revalidate publish authority immediately before package write', 'name: Login and publish exact source image'],
	'shadow live-authority recheck must precede publication',
);

requireAll(
	production,
	[
		"workflows: ['CI']",
		'types: [cloudflare-pages-production-v2]',
		"github.event.workflow_run.conclusion == 'success'",
		"github.event.workflow_run.event == 'push'",
		"github.event.workflow_run.head_branch == 'main'",
		'github.event.workflow_run.head_repository.full_name == github.repository',
		'for (const requiredName of ["build-and-test", "bazel-remote-gates"])',
		'job.conclusion !== "success"',
		'workflow_id: "ci.yml"',
		'workflow_id: "private-cv-authority-v2.yml"',
		'mainRef.data.object.sha !== sourceSha',
		'Successful CI SHA ${sourceSha} is stale; current main is ${mainRef.data.object.sha}.',
		"PRODUCTION_ENABLED: ${{ vars.CLOUDFLARE_PAGES_PRODUCTION_ENABLED || 'false' }}",
		'deploy = false',
		'process.env.REQUEST_DEPLOY !== "true"',
		'process.env.PRODUCTION_ENABLED !== "true"',
		'deploy = true',
		"if: github.event_name == 'repository_dispatch' && needs.resolve.outputs.deploy == 'true'",
		'ref: ${{ needs.resolve.outputs.source_sha }}',
		'PUBLIC_DEPLOY_TIER: production',
		'--commit-hash=${{ needs.resolve.outputs.source_sha }} --commit-dirty=false',
		'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0 # v4',
		'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6',
		'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6',
		'Static content digest:',
		'Revalidate production kill switch and current main immediately before publish',
		'name: "CLOUDFLARE_PAGES_PRODUCTION_ENABLED"',
		'Refusing stale production publish:',
	],
	'production workflow',
);
requireOrder(
	production,
	['Revalidate production kill switch and current main immediately before publish', 'Publish exact production build to Cloudflare Pages'],
	'production live-authority recheck must precede publication',
);
forbid(production, /^ {2}(?:push|pull_request):/m, 'production publication must not be branch-triggered');
forbid(
	production,
	/deployments:\s*write|secrets\.GITHUB_TOKEN|github\.token/,
	'production must not carry unrelated GitHub mutation authority',
);
requireAbsent('.github/workflows/cloudflare-pages-production.yml');

requireAll(
	parity,
	[
		'types: [cloudflare-pages-parity-v2]',
		'pr.head.repo?.full_name !== `${owner}/${repo}`',
		'pr.head.sha !== sourceSha',
		'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6',
		'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6',
	],
	'Cloudflare parity workflow',
);
forbid(parity, /secrets\.|deployments: write|cloudflare\/wrangler-action|pages deploy/, 'parity must remain secretless');

requireAll(
	vite,
	[
		"process.env.PUBLIC_DEPLOY_TIER || 'production'",
		"deployTier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)",
	],
	'deploy-tier Vite config',
);
requireAll(
	layout,
	[
		'<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow" />',
		'<meta name="tinyland-source-sha" content={__BLOG_SOURCE_SHA__} data-deploy-tier="shadow" />',
	],
	'shadow document metadata',
);
requireAll(packageJson, ['node scripts/stamp-deploy-tier-output.mjs'], 'post-build provenance stamping');
requireAll(stamper, ['rewriteCompressedSibling'], 'precompressed provenance stamping');
requireAll(production, ['node scripts/validate-deploy-tier-output.mjs production'], 'production output validation');
requireAll(
	dockerfile,
	[
		'node scripts/validate-deploy-tier-output.mjs shadow "${PUBLIC_SOURCE_SHA}"',
		'ARG PUBLIC_SOURCE_SHA',
		"grep -Eq '^[0-9a-f]{40}$'",
		'RUN npm ci --no-audit --no-fund',
	],
	'shadow image provenance',
);
requireAll(validator, ["'.bg-surface-200-800'"], 'emitted Skeleton paired-utility validation');

requireAll(
	pagesRollback,
	[
		'types: [github-pages-rollback-v2]',
		'github.event.client_payload.confirm_rollback',
		'BLOG_GITHUB_PAGES_ROLLBACK_ENABLED',
		'mainRef.data.object.sha !== sourceSha',
		'for (const requiredName of ["build-and-test", "bazel-remote-gates"])',
		'workflow_id: "private-cv-authority-v2.yml"',
		'Revalidate rollback kill switch and current main',
	],
	'GitHub Pages rollback workflow',
);
forbid(pagesRollback, /^ {2}push:|deploy-pages\.yml/m, 'Pages must remain an explicit rollback path');
forbid(
	`${production}\n${parity}\n${shadowSource}\n${pagesRollback}\n${privateCv}`,
	/^\s*workflow_dispatch:/m,
	'v2 authority paths must be default-owned',
);

for (const legacy of [
	'blog-post-bot.yml',
	'build-cv.yml',
	'cloudflare-cache-purge.yml',
	'cloudflare-dns-drift.yml',
	'cloudflare-dns-drift-v2.yml',
	'cloudflare-pages-shadow.yml',
	'collect-posts.yml',
	'production-health.yml',
	'auto-merge-scheduled.yml',
	'content-stats.yml',
	'content-stats-v2.yml',
	'collect-posts-v2.yml',
	'notify-blog-template.yml',
	'shadow-preview.yml',
	'shadow-image.yml',
	'shadow-publish-apply-v2.yml',
	'deploy-pages.yml',
]) {
	requireAbsent(`.github/workflows/${legacy}`);
}
forbid(productionHealth, /github-pages|deploy-pages\.yml|pages_deployment/, 'production health must observe Cloudflare');
forbid(themeSwitcher, /actions\/workflows\/deploy-pages\.yml/, 'UI must not link deprecated Pages CI/CD');

requireAll(
	cachePurge,
	[
		'ACCOUNT_ID: fdcb4fb750ab79be0800e885f09ddbdc',
		'types: [cloudflare-cache-purge-v2]',
		'CLOUDFLARE_CACHE_PURGE_ENABLED',
		"request GET 'https://api.cloudflare.com/client/v4/user/tokens/verify'",
		'request GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify"',
		'"$(jq -r \'.result.status // ""\' <<<"$REQUEST_BODY")" == active',
		'ZONE_ID: 602400322c1ecac4983542c76af90115',
		'target_url="https://transscendsurvival.org${TARGET_PATH}"',
		'{files:[$url]}',
		'[[ "$TARGET_PATH" == *%* || "$TARGET_PATH" == *\\\\* || "$TARGET_PATH" == *//* ]]',
		'[[ "$TARGET_PATH" == "/." || "$TARGET_PATH" == *"/./"* || "$TARGET_PATH" == *"/." ]]',
	],
	'Cloudflare cache-purge workflow',
);
forbid(cachePurge, /purge_everything/, 'cache purge must not expose purge-everything');
forbid(cachePurge, /^\s*workflow_dispatch:|^\s*pull_request(?:_target)?:/m, 'cache purge must be default-owned');
for (const key of ['tags', 'hosts', 'prefixes']) {
	forbid(cachePurge, new RegExp(`(?:^|[,{\\s])["']?${key}["']?\\s*:`, 'm'), `cache purge must not expose ${key}`);
}
assert.equal(cachePurge.split('if ! token_is_active; then').length - 1, 2, 'cache purge requires two active-token gates');
assert.equal(
	cachePurge.split('request POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" "$payload"').length - 1,
	1,
	'cache purge must issue exactly one fixed-zone purge request',
);
requireOrder(
	cachePurge,
	[
		"request GET 'https://api.cloudflare.com/client/v4/user/tokens/verify'",
		'if ! token_is_active; then',
		'request GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify"',
		'if ! token_is_active; then',
		'request GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID"',
		'request POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" "$payload"',
	],
	'cache purge authority checks must precede mutation',
);

const workflowDirectory = fromRoot('.github/workflows/');
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name));
for (const name of workflowNames) {
	const workflow = await read(`.github/workflows/${name}`);
	const hasPrTrigger = /^\s+(?:pull_request|pull_request_target)\s*:/m.test(workflow);
	const hasManualCarrier = /^\s+workflow_dispatch\s*:/m.test(workflow);
	const hasAuthority = /secrets\.|github\.token|id-token:\s*write|contents:\s*write|pull-requests:\s*write|issues:\s*write|actions:\s*write|deployments:\s*write|pages:\s*write|packages:\s*write|createWorkflowDispatch|create-pull-request|git push|pulls\.merge/.test(
		workflow,
	);
	assert.ok(!(hasPrTrigger && /secrets\.|github\.token|GITHUB_TOKEN/.test(workflow)), `${name}: PR trigger reaches credentials`);
	assert.ok(!(hasManualCarrier && hasAuthority), `${name}: branch-selectable manual trigger reaches mutation authority`);

	for (const match of workflow.matchAll(/^\s*-?\s*uses:\s+([^\s#]+)/gm)) {
		const action = match[1];
		if (action.startsWith('./')) continue;
		const separator = action.lastIndexOf('@');
		assert.ok(separator > 0 && /^[0-9a-f]{40}$/.test(action.slice(separator + 1)), `${name}: action is not pinned: ${action}`);
	}
}

for (const fixture of [
	'./test-shadow-preview-resolver.mjs',
	'./test-cloudflare-production-resolver.mjs',
	'./test-cloudflare-parity-resolver.mjs',
	'./test-github-pages-rollback-resolver.mjs',
	'./test-private-cv-authority-resolver.mjs',
	'./test-incident-20260812-regression.mjs',
	'./test-validate-deploy-tier-output.mjs',
]) {
	await import(fixture);
}

console.log('workflow authority contracts passed');
