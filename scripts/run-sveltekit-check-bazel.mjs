#!/usr/bin/env node
import {
	accessSync,
	constants,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	statSync,
	symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-sveltekit-check-'));
const buildRoot = join(runtimeRoot, 'workspace');

mkdirSync(buildRoot, { recursive: true });
ensureWritableEnvDir('HOME', join(runtimeRoot, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeRoot, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeRoot, 'xdg-cache'));
process.env.CI = 'true';
process.env.NODE_ENV = 'test';

copyInputsToBuildRoot();
linkNodeModules();

for (const command of [
	['tsx', 'scripts/ingest-tinyland-posts.mts', '--check'],
	['tsx', 'scripts/generate-search-index.mts'],
	['tsx', 'scripts/validate-pulse-snapshot.mts'],
	['svelte-kit', 'sync'],
	['svelte-check', '--tsconfig', './tsconfig.json'],
]) {
	run(command[0], command.slice(1));
}

console.log('SvelteKit remote check passed');

function copyInputsToBuildRoot() {
	for (const dir of ['packages', 'scripts', 'src', 'static']) {
		copyPath(resolve(workspaceRoot, dir), resolve(buildRoot, dir));
	}

	for (const file of [
		'.npmrc',
		'package-lock.json',
		'package.json',
		'pnpm-lock.yaml',
		'svelte.config.js',
		'tsconfig.json',
		'vite.config.ts',
	]) {
		copyPath(resolve(workspaceRoot, file), resolve(buildRoot, file));
	}
}

function copyPath(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing declared check input: ${source}`);
	}

	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, {
		dereference: true,
		errorOnExist: false,
		force: true,
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

	linkPackageDependencies(buildNodeModules, join(buildRoot, 'package.json'), [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
	]);
	linkWorkspacePackageDependencies(buildNodeModules);
}

function linkPackageDependencies(buildNodeModules, packageJsonPath, sections) {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	for (const dependencyName of sections.flatMap((section) => Object.keys(packageJson[section] ?? {}))) {
		if (dependencyName.startsWith('@blog/')) {
			continue;
		}
		linkRootPackageIfMissing(buildNodeModules, dependencyName);
	}
}

function linkWorkspacePackageDependencies(buildNodeModules) {
	for (const packageDir of ['pulse-client', 'pulse-core']) {
		const packageJsonPath = resolve(buildRoot, 'packages', packageDir, 'package.json');
		linkPackageDependencies(buildNodeModules, packageJsonPath, ['dependencies']);
	}
}

function linkRootPackageIfMissing(buildNodeModules, packageName) {
	const destination = resolvePackagePath(buildNodeModules, packageName);
	if (existsSync(destination)) {
		return;
	}

	const source = findAspectPackage(buildNodeModules, packageName);
	if (!source) {
		throw new Error(`Missing workspace dependency ${packageName} in Bazel npm store`);
	}

	mkdirSync(dirname(destination), { recursive: true });
	symlinkSync(source, destination, 'dir');
}

function resolvePackagePath(nodeModules, packageName, ...segments) {
	return resolve(nodeModules, ...packageName.split('/'), ...segments);
}

function findAspectPackage(buildNodeModules, packageName) {
	const aspectStore = resolve(buildNodeModules, '.aspect_rules_js');
	const packagePath = packageName.split('/');
	if (!existsSync(aspectStore)) {
		return '';
	}

	for (const entry of readdirSync(aspectStore, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const candidate = resolve(aspectStore, entry.name, 'node_modules', ...packagePath);
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return '';
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
		'svelte-check': 'svelte-check',
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

function ensureWritableEnvDir(name, fallback) {
	const current = process.env[name];
	if (current && isWritableDirectory(current)) {
		return current;
	}

	mkdirSync(fallback, { recursive: true });
	process.env[name] = fallback;
	return fallback;
}

function isWritableDirectory(path) {
	try {
		if (!existsSync(path) || !statSync(path).isDirectory()) {
			return false;
		}
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
