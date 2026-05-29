#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-package-checks-'));
const buildRoot = join(runtimeRoot, 'workspace');

mkdirSync(buildRoot, { recursive: true });
copyInputsToBuildRoot();
linkNodeModules();
linkPackageNodeModules();

for (const check of [
	{
		label: 'blog-agent typecheck',
		cwd: resolve(buildRoot, 'packages', 'blog-agent'),
		binary: 'tsc',
		args: ['--noEmit'],
	},
	{
		label: 'pulse-core typecheck',
		cwd: resolve(buildRoot, 'packages', 'pulse-core'),
		binary: 'tsc',
		args: ['--noEmit'],
	},
	{
		label: 'pulse-core proto guard',
		cwd: resolve(buildRoot, 'packages', 'pulse-core'),
		binary: 'tsx',
		args: ['scripts/validate-proto-reservations.mts'],
	},
	{
		label: 'pulse-client typecheck',
		cwd: resolve(buildRoot, 'packages', 'pulse-client'),
		binary: 'tsc',
		args: ['--noEmit'],
	},
]) {
	console.log(`Running ${check.label}`);
	run(check.binary, check.args, check.cwd);
}

console.log('Workspace package remote checks passed');

function copyInputsToBuildRoot() {
	for (const dir of ['packages/blog-agent', 'packages/pulse-client', 'packages/pulse-core']) {
		copyPath(resolve(workspaceRoot, dir), resolve(buildRoot, dir));
	}

	for (const file of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
		copyPath(resolve(workspaceRoot, file), resolve(buildRoot, file));
	}
}

function copyPath(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing declared package-check input: ${source}`);
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

	for (const packageDir of ['blog-agent', 'pulse-client', 'pulse-core']) {
		linkPackageDependencies(buildNodeModules, resolve(buildRoot, 'packages', packageDir, 'package.json'), [
			'dependencies',
			'devDependencies',
			'optionalDependencies',
		]);
	}

	linkBinEntrypoint(buildNodeModules, 'tsx', 'tsx');
	linkBinEntrypoint(buildNodeModules, 'typescript', 'tsc');
}

function linkPackageNodeModules() {
	for (const packageDir of ['blog-agent', 'pulse-client', 'pulse-core']) {
		const source = resolve(workspaceRoot, 'packages', packageDir, 'node_modules');
		const destination = resolve(buildRoot, 'packages', packageDir, 'node_modules');
		if (!existsSync(source)) {
			throw new Error(`Missing Bazel node_modules tree for packages/${packageDir}: ${source}`);
		}

		mkdirSync(dirname(destination), { recursive: true });
		symlinkSync(source, destination, 'dir');
	}
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

function run(binaryName, args, cwd) {
	const binary = resolveBinEntrypoint(binaryName);
	const result = spawnSync(binary, args, {
		cwd,
		env: {
			...process.env,
			CI: 'true',
			NODE_ENV: 'test',
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
		tsc: 'typescript',
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

function resolvePackagePath(nodeModules, packageName, ...segments) {
	return resolve(nodeModules, ...packageName.split('/'), ...segments);
}
