import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { startVitest } from 'vitest/node';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-vitest-'));
const buildRoot = join(runtimeRoot, 'workspace');
const configPath = resolve(buildRoot, 'vitest.bazel.config.ts');

mkdirSync(buildRoot, { recursive: true });
copyInputsToBuildRoot();
linkNodeModules();
run('tsx', ['scripts/generate-search-index.mts']);
run('svelte-kit', ['sync']);
process.chdir(buildRoot);

if (!existsSync(configPath)) {
	console.error(`Bazel Vitest config not found: ${configPath}`);
	process.exit(1);
}

process.env.CI = 'true';
process.env.NODE_ENV = 'test';

const vitest = await startVitest('test', process.argv.slice(2), {
	config: configPath,
	root: buildRoot,
	reporters: ['verbose'],
	watch: false,
});

if (!vitest) {
	process.exit(1);
}

await vitest.close();
const failed = vitest.state.getCountOfFailedTests();
const errors = vitest.state.getUnhandledErrors().length;
process.exit(failed > 0 || errors > 0 ? 1 : 0);

function copyInputsToBuildRoot() {
	for (const dir of ['packages', 'scripts', 'src']) {
		copyPath(resolve(workspaceRoot, dir), resolve(buildRoot, dir));
	}
	copyPath(resolve(workspaceRoot, 'static', 'data'), resolve(buildRoot, 'static', 'data'));

	for (const file of [
		'.npmrc',
		'package-lock.json',
		'package.json',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
		'svelte.config.js',
		'tsconfig.json',
		'vite.config.ts',
		'vitest.bazel.config.ts',
		'vitest.config.ts',
	]) {
		copyPath(resolve(workspaceRoot, file), resolve(buildRoot, file));
	}
}

function copyPath(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing declared Vitest input: ${source}`);
	}

	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, {
		dereference: true,
		errorOnExist: false,
		force: true,
		filter: (sourcePath) => !sourcePath.split(sep).includes('node_modules'),
		preserveTimestamps: false,
		recursive: true,
	});
}

function linkNodeModules() {
	const sourceNodeModules = resolve(workspaceRoot, 'node_modules');
	const buildNodeModules = resolve(buildRoot, 'node_modules');
	if (!existsSync(sourceNodeModules)) {
		throw new Error(`Missing Bazel node_modules tree: ${sourceNodeModules}`);
	}

	mkdirSync(buildNodeModules, { recursive: true });
	for (const entry of readdirSync(sourceNodeModules, { withFileTypes: true })) {
		if (entry.name === '@blog') {
			continue;
		}

		const sourcePath = resolve(sourceNodeModules, entry.name);
		const destinationPath = resolve(buildNodeModules, entry.name);
		if (entry.name.startsWith('@') && entry.isDirectory()) {
			mkdirSync(destinationPath, { recursive: true });
			for (const scopedEntry of readdirSync(sourcePath, { withFileTypes: true })) {
				symlinkSync(resolve(sourcePath, scopedEntry.name), resolve(destinationPath, scopedEntry.name), 'dir');
			}
		} else {
			symlinkSync(sourcePath, destinationPath, entry.isDirectory() ? 'dir' : 'file');
		}
	}

	const blogScope = resolve(buildNodeModules, '@blog');
	mkdirSync(blogScope, { recursive: true });
	for (const [name, packageDir] of [
		['pulse-client', 'pulse-client'],
		['pulse-core', 'pulse-core'],
	]) {
		symlinkSync(resolve(buildRoot, 'packages', packageDir), resolve(blogScope, name), 'dir');
	}

	linkWorkspaceNodeModules(['pulse-client', 'pulse-core']);
	linkBinEntrypoint(buildNodeModules, 'tsx', 'tsx');
}

function resolvePackagePath(nodeModules, packageName, ...segments) {
	return resolve(nodeModules, ...packageName.split('/'), ...segments);
}

function linkWorkspaceNodeModules(packageDirs) {
	for (const packageDir of packageDirs) {
		const source = resolve(workspaceRoot, 'packages', packageDir, 'node_modules');
		const destination = resolve(buildRoot, 'packages', packageDir, 'node_modules');
		if (!existsSync(source)) {
			throw new Error(`Missing Bazel node_modules tree for packages/${packageDir}: ${source}`);
		}

		mkdirSync(dirname(destination), { recursive: true });
		symlinkSync(source, destination, 'dir');
	}
}

function linkBinEntrypoint(buildNodeModules, packageName, binName) {
	const binDir = resolve(buildNodeModules, '.bin');
	const destination = resolve(binDir, binName);
	if (existsSync(destination)) {
		return;
	}

	const packagePath = resolvePackagePath(buildNodeModules, packageName);
	const packageJsonPath = resolve(packagePath, 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];
	if (!bin) {
		throw new Error(`Package ${packageName} does not declare bin ${binName}`);
	}

	mkdirSync(binDir, { recursive: true });
	symlinkSync(resolve(packagePath, bin), destination, 'file');
}

function run(binaryName, args) {
	const binary = resolveBinEntrypoint(binaryName);
	const result = spawnSync(binary, args, {
		cwd: buildRoot,
		env: {
			...process.env,
			PATH: `${resolve(buildRoot, 'node_modules', '.bin')}:${process.env.PATH ?? ''}`,
		},
		stdio: 'inherit',
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${binaryName} ${args.join(' ')} failed with exit code ${result.status}`);
	}
}

function resolveBinEntrypoint(name) {
	const packageName = {
		'svelte-kit': '@sveltejs/kit',
		tsx: 'tsx',
	}[name];
	if (!packageName) {
		throw new Error(`Unknown npm binary ${name}`);
	}

	const packageJsonPath = resolvePackagePath(resolve(buildRoot, 'node_modules'), packageName, 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[name];
	if (!bin) {
		throw new Error(`Package ${packageName} does not declare bin ${name}`);
	}
	return resolve(dirname(packageJsonPath), bin);
}
