import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Unit fixtures for scripts/validate-deploy-tier-output.mjs: synthetic build/
// trees prove the validator fails correctly on leaked, missing, or stale
// deploy-tier markers without requiring a full SvelteKit build.

const validatorPath = fileURLToPath(new URL('./validate-deploy-tier-output.mjs', import.meta.url));
const sourceSha = 'a'.repeat(40);
const staleSha = 'b'.repeat(40);

const REQUIRED_CSS = [
	'.bg-surface-200-800{background-color:red}',
	'.border-surface-300-700{border-color:red}',
	'.text-surface-600-400{color:red}',
	'.hover\\:bg-surface-200-800:hover{background-color:red}',
].join('\n');

const shadowRobots = `<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow" />`;
const shadowSource = (sha) =>
	`<meta name="tinyland-source-sha" content="${sha}" data-deploy-tier="shadow" />`;

function page(markers = '') {
	return `<!doctype html><html><head>${markers}</head><body><p>fixture</p></body></html>\n`;
}

async function runValidator({ tier, sha, html, css = REQUIRED_CSS }) {
	const fixtureDir = await mkdtemp(join(tmpdir(), 'deploy-tier-fixture-'));
	try {
		const nested = join(fixtureDir, 'build', 'blog');
		await mkdir(nested, { recursive: true });
		await writeFile(join(fixtureDir, 'build', 'index.html'), html);
		await writeFile(join(nested, 'index.html'), html);
		await writeFile(join(fixtureDir, 'build', 'app.css'), css);
		const args = [validatorPath, tier];
		if (sha !== undefined) args.push(sha);
		const result = spawnSync(process.execPath, args, { cwd: fixtureDir, encoding: 'utf8' });
		return result;
	} finally {
		await rm(fixtureDir, { recursive: true, force: true });
	}
}

function assertFails(result, pattern, label) {
	assert.notEqual(result.status, 0, `${label}: validator exits nonzero`);
	assert.match(result.stderr, pattern, label);
}

// Production tier: clean output passes; any shadow marker is a leak.
{
	const clean = await runValidator({ tier: 'production', html: page() });
	assert.equal(clean.status, 0, `clean production output passes: ${clean.stderr}`);
	assert.match(clean.stdout, /production deploy-tier output contract passed/, 'production success line');
}
assertFails(
	await runValidator({ tier: 'production', html: page(shadowRobots + shadowSource(sourceSha)) }),
	/Shadow-only marker leaked into production output/,
	'full shadow marker set leaked into production output',
);
assertFails(
	await runValidator({ tier: 'production', html: page(shadowSource(sourceSha)) }),
	/Shadow-only marker leaked into production output/,
	'a lone tinyland-source-sha meta leaked into production output',
);
assertFails(
	await runValidator({ tier: 'production', html: page(), css: '.unrelated{color:red}' }),
	/Skeleton paired utility missing from emitted CSS/,
	'missing Skeleton paired utility fails production output',
);

// Shadow tier: both markers with the exact SHA pass; missing or stale fail.
{
	const good = await runValidator({
		tier: 'shadow',
		sha: sourceSha,
		html: page(shadowRobots + shadowSource(sourceSha)),
	});
	assert.equal(good.status, 0, `exact shadow markers pass: ${good.stderr}`);
	assert.match(good.stdout, /shadow deploy-tier output contract passed/, 'shadow success line');
}
assertFails(
	await runValidator({ tier: 'shadow', sha: sourceSha, html: page(shadowSource(sourceSha)) }),
	/Shadow markers missing or stale/,
	'missing noindex robots marker fails shadow output',
);
assertFails(
	await runValidator({ tier: 'shadow', sha: sourceSha, html: page(shadowRobots) }),
	/Shadow markers missing or stale/,
	'missing source-sha marker fails shadow output',
);
assertFails(
	await runValidator({
		tier: 'shadow',
		sha: sourceSha,
		html: page(shadowRobots + shadowSource(staleSha)),
	}),
	/Shadow markers missing or stale/,
	'stale source SHA in the shadow marker fails shadow output',
);
assertFails(
	await runValidator({
		tier: 'shadow',
		sha: undefined,
		html: page(shadowRobots + shadowSource(sourceSha)),
	}),
	/exact 40-character lowercase source SHA/,
	'shadow validation without an exact SHA argument fails closed',
);
assertFails(
	await runValidator({ tier: 'staging', html: page() }),
	/Usage: validate-deploy-tier-output\.mjs/,
	'unknown tier fails closed',
);

console.log('validate-deploy-tier-output fixtures passed');
