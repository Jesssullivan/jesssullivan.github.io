#!/usr/bin/env node
// Applies the pnpm `patchedDependencies` set (package.json -> pnpm) to an npm
// install, so the npm rail (CI `npm ci`, production `npm ci && npm run build`)
// runs the same patched dependencies as pnpm and the Bazel rules_js graph.
//
// RU13 (2026-10-08): the patches under patches/ let SvelteKit 3 and
// svelte-check run with TypeScript 7.0.2 as the `typescript` package.
//
// Behaviour:
// - pnpm installs (node_modules/.pnpm present) are skipped: pnpm applies the
//   patches itself.
// - A patch whose package is not installed, or installed at another version,
//   fails the install: a silent skip would hide an unpatched toolchain.
// - Already-applied patches are detected with a reverse dry run, so a second
//   `npm install` or a re-run of this script is a no-op.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');

if (existsSync(join(nodeModules, '.pnpm'))) {
	console.log('apply-dependency-patches: pnpm install detected; pnpm applies patchedDependencies itself');
	process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const patched = manifest.pnpm?.patchedDependencies ?? {};

function patchArgs(dir, file, extra = []) {
	return ['-p1', '--batch', '--silent', '-d', dir, '-i', file, ...extra];
}

function runs(args) {
	try {
		execFileSync('patch', args, { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

let failures = 0;
for (const [key, patchFile] of Object.entries(patched)) {
	const at = key.lastIndexOf('@');
	const name = key.slice(0, at);
	const version = key.slice(at + 1);
	const dir = join(nodeModules, name);
	const file = join(root, patchFile);
	const pkgJson = join(dir, 'package.json');

	if (!existsSync(pkgJson)) {
		console.error(`apply-dependency-patches: ${name} is not installed; cannot apply ${patchFile}`);
		failures++;
		continue;
	}
	const installed = JSON.parse(readFileSync(pkgJson, 'utf8')).version;
	if (installed !== version) {
		console.error(
			`apply-dependency-patches: ${name}@${installed} is installed but ${patchFile} targets ${version}`
		);
		failures++;
		continue;
	}
	if (runs(patchArgs(dir, file, ['--dry-run', '-R', '-f']))) {
		console.log(`apply-dependency-patches: ${key} already patched`);
		continue;
	}
	if (!runs(patchArgs(dir, file, ['--dry-run', '-N'])) || !runs(patchArgs(dir, file, ['-N']))) {
		console.error(`apply-dependency-patches: ${patchFile} does not apply cleanly to ${key}`);
		failures++;
		continue;
	}
	console.log(`apply-dependency-patches: applied ${patchFile}`);
}

process.exit(failures ? 1 : 0);
