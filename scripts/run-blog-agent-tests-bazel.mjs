#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-blog-agent-test-'));
const buildRoot = join(runtimeRoot, 'workspace');
const packageRoot = resolve(buildRoot, 'packages', 'blog-agent');

mkdirSync(buildRoot, { recursive: true });
copyPath(resolve(workspaceRoot, 'packages', 'blog-agent'), packageRoot);
linkNodeModules();
linkPackageNodeModules();

const tests = readdirSync(resolve(packageRoot, 'test'))
	.filter((name) => name.endsWith('.test.ts'))
	.map((name) => resolve(packageRoot, 'test', name));

if (tests.length === 0) {
	throw new Error('No blog-agent node:test files found');
}

run('tsx', ['--test', ...tests], packageRoot);

function copyPath(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing declared blog-agent input: ${source}`);
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

	symlinkSync(sourceNodeModules, buildNodeModules, 'dir');
}

function linkPackageNodeModules() {
	const sourceNodeModules = resolve(workspaceRoot, 'packages', 'blog-agent', 'node_modules');
	const buildNodeModules = resolve(packageRoot, 'node_modules');
	if (!existsSync(sourceNodeModules)) {
		throw new Error(`Missing Bazel node_modules tree for packages/blog-agent: ${sourceNodeModules}`);
	}

	symlinkSync(sourceNodeModules, buildNodeModules, 'dir');
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
		tsx: 'tsx',
	}[name];
	if (!packageName) {
		throw new Error(`Unknown npm binary ${name}`);
	}

	const packageJsonPath = resolve(buildRoot, 'node_modules', ...packageName.split('/'), 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[name];
	if (!bin) {
		throw new Error(`Package ${packageName} does not declare bin ${name}`);
	}
	return resolve(dirname(packageJsonPath), bin);
}
