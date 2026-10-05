import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const [operation, directory, expectedSha] = process.argv.slice(2);
if (!['verify', 'qualify', 'publish'].includes(operation) || !directory?.startsWith('/') || !/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('Usage: local-production-artifact.mjs verify|qualify|publish ABSOLUTE_ARTIFACT EXACT_SHA');
const root = resolve(directory);
const bazelStartup = ['--host_jvm_args=-Xmx1024m'];
const nodeOptions = '--max-old-space-size=3072';
const bazelOptions = ['--config=local', '--lockfile_mode=error', '--remote_cache=', '--remote_executor=', '--jobs=1', '--local_test_jobs=1', `--action_env=NODE_OPTIONS=${nodeOptions}`];
const checks = ['//:sveltekit_check', '//:vitest_unit_tests', '//:bazel_graph_hygiene', '//:local_production_artifact_contract', '//static/cv:pdfs_synced_test'];
const stages = [];
if (operation === 'qualify') {
	if (existsSync(root)) throw new Error('Qualification requires a new artifact directory');
	cleanSource();
	runStage('checks-private-cv', [...bazelStartup, 'test', ...bazelOptions, ...checks]);
	runStage('production-build-export', [...bazelStartup, 'run', ...bazelOptions, '//:local_production_build', '--', '--export-production', root, expectedSha]);
}
const manifestBytes = readFileSync(join(root, 'artifact.json'));
const manifest = JSON.parse(manifestBytes);
if (manifest.sourceSha !== expectedSha || manifest.sanitizer !== '3.4.16') throw new Error('Artifact source/sanitizer mismatch');
const build = join(root, 'build');
const actual = files(build).map(path => ({ path: path.slice(build.length + 1), sha256: hash(readFileSync(path)) }));
if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('Artifact bytes changed or include undeclared files');
for (const pdf of ['jess_sullivan_resume.pdf', 'jess_sullivan_precis.pdf', 'jess_sullivan_cv.pdf']) {
	if (!manifest.files.some(file => file.path === `cv/${pdf}`) || !readFileSync(join(build, 'cv', pdf)).subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Artifact missing the qualified generic public CV lane');
}
const manifestHash = hash(manifestBytes);
if (operation === 'qualify') {
	runStage('same-artifact-browser', [...bazelStartup, 'run', ...bazelOptions, '//:local_production_browser', '--', '--production-artifact', root]);
	if (hash(readFileSync(join(root, 'artifact.json'))) !== manifestHash || JSON.stringify(files(build).map(path => ({ path: path.slice(build.length + 1), sha256: hash(readFileSync(path)) }))) !== JSON.stringify(manifest.files)) throw new Error('Artifact changed during browser qualification');
	writeFileSync(join(root, 'qualification.json'), JSON.stringify({ schemaVersion: 'tss.local-production-qualification.v1', custody: 'same-uid-operator', sourceSha: expectedSha, manifestHash, qualifiedAt: new Date().toISOString(), gates: stages.map(stage => ({ ...stage, manifestHash })) }, null, 2) + '\n', { flag: 'wx' });
}
if (operation === 'publish') {
	const qualification = JSON.parse(readFileSync(join(root, 'qualification.json'), 'utf8'));
	if (qualification.schemaVersion !== 'tss.local-production-qualification.v1' || qualification.custody !== 'same-uid-operator' || qualification.sourceSha !== expectedSha || qualification.manifestHash !== manifestHash) throw new Error('Missing same-artifact qualification');
	const required = [
		['checks-private-cv', [...bazelStartup, 'test', ...bazelOptions, ...checks]],
		['production-build-export', [...bazelStartup, 'run', ...bazelOptions, '//:local_production_build', '--', '--export-production', root, expectedSha]],
		['same-artifact-browser', [...bazelStartup, 'run', ...bazelOptions, '//:local_production_browser', '--', '--production-artifact', root]],
	];
	if (!Array.isArray(qualification.gates) || qualification.gates.length !== required.length || required.some(([name, args], index) => {
		const gate = qualification.gates[index];
		return gate?.name !== name || gate.status !== 0 || gate.sourceSha !== expectedSha || gate.manifestHash !== manifestHash || gate.nodeOptions !== nodeOptions || gate.command !== 'bazelisk' || JSON.stringify(gate.args) !== JSON.stringify(args) || !Number.isFinite(Date.parse(gate.startedAt)) || !Number.isFinite(Date.parse(gate.finishedAt));
	})) throw new Error('Qualification lacks exact successful source/artifact-bound required gates');
	if (process.env.CONFIRM_LOCAL_PRODUCTION !== `publish-${expectedSha}`) throw new Error('Exact-source local publication confirmation required');
	if (output('git', ['rev-parse', 'HEAD']) !== expectedSha || output('git', ['status', '--porcelain']) || output('git', ['log', '-1', '--format=%G?']) !== 'G') throw new Error('Publisher source must be clean signed exact HEAD');
	const executable = process.env.LOCAL_WRANGLER_EXECUTABLE;
	if (!executable?.startsWith('/nix/store/') || !executable.endsWith('/bin/wrangler')) throw new Error('Use the declared Nix Wrangler executable, no npx/download');
	if (!output(executable, ['--version']).includes('4.62.0')) throw new Error('Declared local Wrangler version must be 4.62.0');
	const token = privateFile(process.env.CLOUDFLARE_API_TOKEN_FILE);
	const account = 'fdcb4fb750ab79be0800e885f09ddbdc';
	const project = 'transscendsurvival-org';
	const projectId = 'a5bca5d5-d565-43fd-8456-f62b297605e5';
	const api = async path => {
		const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { headers: { Authorization: `Bearer ${token}` } });
		if (!response.ok) throw new Error(`Cloudflare metadata GET failed: ${response.status}`);
		const body = await response.json(); if (!body.success) throw new Error('Cloudflare metadata result unsuccessful'); return body.result;
	};
	const metadata = await api(`/pages/projects/${project}`);
	if (metadata.id !== projectId || metadata.production_branch !== 'main' || !metadata.domains.includes('transscendsurvival.org')) throw new Error('Production project metadata mismatch');
	// Recheck live custody immediately before the only external mutation.
	if (output('gh', ['api', 'repos/Jesssullivan/jesssullivan.github.io/git/ref/heads/main', '--jq', '.object.sha']) !== expectedSha) throw new Error('Refusing stale or non-main production source');
	if (output('gh', ['api', 'repos/Jesssullivan/jesssullivan.github.io/actions/variables/CLOUDFLARE_PAGES_PRODUCTION_ENABLED', '--jq', '.value']) !== 'true') throw new Error('Production switch is not enabled');
	if (hash(readFileSync(join(root, 'artifact.json'))) !== manifestHash || JSON.stringify(files(build).map(path => ({ path: path.slice(build.length + 1), sha256: hash(readFileSync(path)) }))) !== JSON.stringify(manifest.files)) throw new Error('Artifact changed before publish');
	const result = spawnSync(executable, ['pages', 'deploy', build, `--project-name=${project}`, '--branch=main', `--commit-hash=${expectedSha}`, '--commit-dirty=false'], { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, WRANGLER_SEND_METRICS: 'false' } });
	if (result.status !== 0) throw new Error(`Wrangler failed: ${result.status}`);
	const live = await api(`/pages/projects/${project}`);
	const deployment = live.canonical_deployment;
	if (deployment?.deployment_trigger?.metadata?.commit_hash !== expectedSha || deployment?.latest_stage?.status !== 'success') throw new Error('Published deployment source/status readback mismatch');
	const response = await fetch('https://transscendsurvival.org/', { cache: 'no-store', redirect: 'error' });
	if (!response.ok) throw new Error(`Production homepage readback failed: ${response.status}`);
	const html = await response.text();
	if (hash(Buffer.from(html)) !== hash(readFileSync(join(build, 'index.html')))) throw new Error('Production homepage differs from qualified artifact');
	writeFileSync(join(root, 'published.json'), JSON.stringify({ sourceSha: expectedSha, manifestHash, projectId, deploymentId: deployment.id, checkedAt: new Date().toISOString(), homepageHash: hash(Buffer.from(html)) }, null, 2) + '\n', { flag: 'wx' });
	console.log(`Published and read back exact source ${expectedSha}; deployment ${deployment.id}`);
}
console.log(`${operation}: sha256:${manifestHash}`);

function output(command, args) { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function cleanSource() { if (output('git', ['rev-parse', 'HEAD']) !== expectedSha || output('git', ['status', '--porcelain']) || output('git', ['log', '-1', '--format=%G?']) !== 'G') throw new Error('Qualification requires clean signed exact source'); }
function runStage(name, args) {
	cleanSource(); const startedAt = new Date().toISOString();
	const result = spawnSync('bazelisk', args, { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } });
	if (result.status !== 0) throw new Error(`Qualification stage ${name} failed: ${result.status}`);
	cleanSource(); stages.push({ name, command: 'bazelisk', args, nodeOptions, status: result.status, sourceSha: expectedSha, startedAt, finishedAt: new Date().toISOString() });
}
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function files(path) {
	return readdirSync(path).sort().flatMap(name => {
		const file = join(path, name); const stat = lstatSync(file);
		if (stat.isSymbolicLink()) throw new Error('Artifact symlinks forbidden');
		if (stat.isDirectory()) return files(file);
		if (!stat.isFile()) throw new Error('Artifact special files forbidden');
		return [file];
	}).sort();
}
function privateFile(path) {
	if (!path?.startsWith('/')) throw new Error('Custodied token file required');
	const stat = lstatSync(path);
	if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('Token file must be owned, private, regular, single-link');
	const value = readFileSync(path, 'utf8').trim(); if (!value) throw new Error('Empty token file'); return value;
}
