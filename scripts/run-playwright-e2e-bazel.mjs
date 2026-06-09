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
	rmSync,
	statSync,
	symlinkSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { configureChromiumFontconfig } from './chromium-fontconfig.mjs';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-playwright-e2e-'));
const buildRoot = join(runtimeRoot, 'workspace');
const chromiumExecutable = findChromiumExecutable();

if (!chromiumExecutable) {
	console.error(
		'No Chromium executable found. Set GF_RBE_CHROMIUM_EXECUTABLE, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, or CHROME_BIN.',
	);
	process.exit(1);
}

mkdirSync(buildRoot, { recursive: true });
ensureWritableEnvDir('HOME', join(runtimeRoot, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeRoot, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeRoot, 'xdg-cache'));
configureChromiumFontconfig(runtimeRoot);
process.env.CI = 'true';
process.env.NODE_ENV = 'production';
process.env.MERMAID_PRERENDER = process.env.MERMAID_PRERENDER ?? 'optional';
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromiumExecutable;
process.env.PLAYWRIGHT_E2E_PORT = process.env.PLAYWRIGHT_E2E_PORT ?? String(await findOpenLoopbackPort());

try {
	copyInputsToBuildRoot();
	linkNodeModules();

	for (const command of [
		['tsx', 'scripts/ingest-tinyland-posts.mts', '--check'],
		['tsx', 'scripts/generate-search-index.mts'],
		['tsx', 'scripts/optimize-images.mts'],
		['tsx', 'scripts/render-mermaid.mts'],
		['tsx', 'scripts/generate-blog-stats.mts'],
		['tsx', 'scripts/generate-tag-graph.mts'],
		['tsx', 'scripts/generate-photo-gallery.mts'],
		['tsx', 'scripts/validate-pulse-snapshot.mts'],
		['svelte-kit', 'sync'],
		['vite', 'build'],
		['tsx', 'scripts/generate-redirects.mts'],
		['pagefind', '--site', 'build'],
	]) {
		run(command[0], command.slice(1));
	}

	run('playwright', ['test', '--config', 'playwright.bazel.config.ts', ...process.argv.slice(2)]);

	console.log(`Playwright Chromium e2e passed with ${chromiumExecutable}`);
} finally {
	if (process.env.GF_KEEP_BAZEL_BROWSER_TMP !== '1') {
		rmSync(runtimeRoot, { recursive: true, force: true });
	}
}

function copyInputsToBuildRoot() {
	for (const dir of ['e2e', 'packages', 'scripts', 'src', 'static']) {
		copyPath(resolve(workspaceRoot, dir), resolve(buildRoot, dir));
	}

	for (const file of [
		'.npmrc',
		'package-lock.json',
		'package.json',
		'playwright.bazel.config.ts',
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
		throw new Error(`Missing declared e2e input: ${source}`);
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

	linkWorkspacePackageDependencies(buildNodeModules);
}

function linkWorkspacePackageDependencies(buildNodeModules) {
	for (const packageDir of ['pulse-client', 'pulse-core']) {
		const packageJsonPath = resolve(buildRoot, 'packages', packageDir, 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
			if (dependencyName.startsWith('@blog/')) {
				continue;
			}
			linkRootPackageIfMissing(buildNodeModules, dependencyName);
		}
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
		pagefind: 'pagefind',
		playwright: '@playwright/test',
		'svelte-kit': '@sveltejs/kit',
		tsx: 'tsx',
		vite: 'vite',
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

function findChromiumExecutable() {
	const candidates = [
		process.env.GF_RBE_CHROMIUM_EXECUTABLE,
		process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
		process.env.CHROME_BIN,
		'/bin/chromium',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
	].filter(Boolean);

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return '';
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

function findOpenLoopbackPort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				if (!port) {
					reject(new Error('Unable to allocate a loopback port for Playwright e2e'));
					return;
				}
				resolvePort(port);
			});
		});
	});
}
