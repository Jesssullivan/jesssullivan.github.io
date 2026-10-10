#!/usr/bin/env node
// Applies the pnpm `patchedDependencies` set (package.json -> pnpm) to an npm
// install, so the npm rail (CI `npm ci`, production `npm ci && npm run build`,
// Containerfile.node and Dockerfile.shadow) runs the same patched dependencies
// as pnpm and the Bazel rules_js graph.
//
// RU13 (2026-10-08): the patches under patches/ let SvelteKit 3 and
// svelte-check run with TypeScript 7.0.2 as the `typescript` package.
//
// Behaviour:
// - pnpm installs (node_modules/.pnpm present) are skipped: pnpm applies the
//   patches itself.
// - A patch whose package is not installed, or installed at another version,
//   fails the install: a silent skip would hide an unpatched toolchain.
// - Hunks are applied in pure Node (no `patch` binary), because the
//   node:22-alpine and node:22-bookworm-slim build images do not ship one.
//   Every hunk must match its context exactly; there is no fuzz.
// - Already-applied patches are detected first, by applying the reverse patch
//   as a dry run, so a second `npm install` or a re-run is a no-op.
// - `node_modules/.bin/tsc` is pinned to TypeScript 7. npm hoists the bins of
//   transitive packages, and `@typescript/typescript6` depends on
//   `@typescript/old` (an alias of typescript@6.0.3) whose `tsc` bin can win
//   the root `.bin/tsc` link. pnpm and rules_js link only direct-dependency
//   bins, so they are unaffected.
import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');

/** Parses a git-style unified diff into [{ path, hunks: [{ start, old, new }] }]. */
export function parsePatch(text) {
	const lines = text.split('\n');
	const files = [];
	let file = null;
	let hunk = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (hunk) {
			const tag = line[0];
			if (tag === '\\') continue; // "\ No newline at end of file"
			const body = line.slice(1);
			if (tag === ' ' || line === '') {
				hunk.old.push(body);
				hunk.new.push(body);
			} else if (tag === '-') {
				hunk.old.push(body);
			} else if (tag === '+') {
				hunk.new.push(body);
			} else {
				throw new Error(`malformed hunk line ${i + 1}: ${line.slice(0, 60)}`);
			}
			if (hunk.old.length > hunk.oldCount || hunk.new.length > hunk.newCount) {
				throw new Error(`hunk ending at line ${i + 1} is longer than its header`);
			}
			if (hunk.old.length === hunk.oldCount && hunk.new.length === hunk.newCount) hunk = null;
			continue;
		}
		if (line.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ')) {
			const target = lines[i + 1].slice(4).split('\t')[0];
			file = { path: target.replace(/^b\//, ''), hunks: [] };
			files.push(file);
			i++;
			continue;
		}
		const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (m) {
			if (!file) throw new Error(`hunk before any file header at line ${i + 1}`);
			hunk = {
				start: Number(m[1]),
				oldCount: m[2] === undefined ? 1 : Number(m[2]),
				newCount: m[4] === undefined ? 1 : Number(m[4]),
				old: [],
				new: [],
			};
			file.hunks.push(hunk);
		}
	}
	if (hunk) throw new Error('patch ends inside a hunk');
	return files;
}

function blockAt(lines, at, block) {
	if (at < 0 || at + block.length > lines.length) return false;
	for (let k = 0; k < block.length; k++) if (lines[at + k] !== block[k]) return false;
	return true;
}

/**
 * Applies hunks in order. Each hunk is matched exactly, at its header line
 * when possible, else at the nearest offset after the previous hunk.
 * Returns the new text, or null when any hunk does not match.
 */
export function applyHunks(text, hunks, reverse = false) {
	const lines = text.split('\n');
	let delta = 0;
	let floor = 0;
	for (const h of hunks) {
		const from = reverse ? h.new : h.old;
		const to = reverse ? h.old : h.new;
		const expected = Math.max(floor, h.start - 1 + delta);
		let at = -1;
		for (let d = 0; expected - d >= floor || expected + d < lines.length; d++) {
			if (expected - d >= floor && blockAt(lines, expected - d, from)) {
				at = expected - d;
				break;
			}
			if (blockAt(lines, expected + d, from)) {
				at = expected + d;
				break;
			}
		}
		if (at < 0) return null;
		lines.splice(at, from.length, ...to);
		delta += to.length - from.length;
		floor = at + to.length;
	}
	return lines.join('\n');
}

function applyPatches() {
	const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
	const patched = manifest.pnpm?.patchedDependencies ?? {};
	let failures = 0;
	for (const [key, patchFile] of Object.entries(patched)) {
		const at = key.lastIndexOf('@');
		const name = key.slice(0, at);
		const version = key.slice(at + 1);
		const dir = join(nodeModules, name);
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

		const files = parsePatch(readFileSync(join(root, patchFile), 'utf8'));
		const sources = files.map((f) => readFileSync(join(dir, f.path), 'utf8'));
		// Reverse first: an add-only hunk keeps its context after it is applied,
		// so a forward match alone cannot tell pristine from patched.
		if (files.every((f, i) => applyHunks(sources[i], f.hunks, true) !== null)) {
			console.log(`apply-dependency-patches: ${key} already patched`);
			continue;
		}
		const forward = files.map((f, i) => applyHunks(sources[i], f.hunks));
		if (forward.every((t) => t !== null)) {
			files.forEach((f, i) => writeFileSync(join(dir, f.path), forward[i]));
			console.log(`apply-dependency-patches: applied ${patchFile}`);
			continue;
		}
		console.error(`apply-dependency-patches: ${patchFile} does not apply cleanly to ${key}`);
		failures++;
	}
	return failures;
}

function pinTscBin() {
	const tsPkg = join(nodeModules, 'typescript', 'package.json');
	if (!existsSync(tsPkg)) return 0;
	const tsBin = JSON.parse(readFileSync(tsPkg, 'utf8')).bin?.tsc;
	if (!tsBin) return 0;
	const link = join(nodeModules, '.bin', 'tsc');
	const want = join('..', 'typescript', tsBin);
	let current = null;
	try {
		current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : 'not a symlink';
	} catch {}
	if (current !== null && resolve(dirname(link), current) === resolve(dirname(link), want)) return 0;
	if (current !== null) rmSync(link, { force: true });
	symlinkSync(want, link);
	console.log(`apply-dependency-patches: node_modules/.bin/tsc -> ${want} (was ${current ?? 'missing'})`);
	return 0;
}

function main() {
	if (existsSync(join(nodeModules, '.pnpm'))) {
		console.log('apply-dependency-patches: pnpm install detected; pnpm applies patchedDependencies itself');
		return 0;
	}
	return applyPatches() + pinTscBin();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exit(main() ? 1 : 0);
}
