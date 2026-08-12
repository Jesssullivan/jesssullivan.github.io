#!/usr/bin/env node
// Build @tummycrypt/tinyvectors' dist/ + dist-types/ from its pinned source
// archive after every install (wired as this repo's root `prepare` script).
//
// WHY THIS EXISTS: the package is deliberately NOT resolved from the public
// npm registry (versions past 0.3.0 were never published there; the
// tinyland-inc/bazel-registry tag-tarball rail is the channel of record).
// package.json pins the exact GitHub tag archive that the bazel-registry
// names in modules/tummycrypt_tinyvectors/<version>/source.json. That archive
// ships source only: no dist/, and upstream has no `prepare` script npm could
// run for us. So this hook compiles the package once per install, in a
// scratch directory, using the package's OWN pinned toolchain: its
// `packageManager` (pnpm) via corepack and its own committed pnpm-lock.yaml.
// This repo itself stays npm/package-lock based; pnpm is used only inside the
// verified tinyvectors tree.
//
// INVARIANTS:
// - This hook re-downloads the pinned archive itself, hard-fails unless its
//   sha256 matches PINNED_INTEGRITY (the same SRI the bazel-registry's
//   source.json carries), proves the npm-installed package is byte-identical
//   to the verified archive, and builds dist/ from the verified tree — never
//   from unverified bytes. (npm's package-lock sha512 for the remote tarball
//   is a second, independent layer; this one is pinned to the registry.)
// - Idempotent: exits fast when dist/ + dist-types/ are already present
//   (npm re-creates the package directory whenever the pinned resolution
//   changes, which clears the sentinel and forces a rebuild; the install
//   that populated it verified the bytes).
// - The scratch build happens OUTSIDE node_modules and only dist/ +
//   dist-types/ are copied back: the installed package must never gain a
//   nested node_modules (a second svelte runtime would break the site).
// - The nested install always goes through corepack so it uses the pnpm
//   version pinned by the tinyvectors tree's own `packageManager` field,
//   regardless of what (if anything) is on PATH here.

import {
	cpSync,
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every bump of the package.json tarball pin MUST add its registry SRI here
// (from bazel-registry modules/tummycrypt_tinyvectors/<version>/source.json);
// an unknown URL hard-fails the install. This is the frozen-lockfile analog
// for the first install, before package-lock has recorded the tarball.
const PINNED_INTEGRITY = {
	'https://github.com/tinyland-inc/tinyvectors/archive/refs/tags/v0.3.5.tar.gz':
		'sha256-hkpn28wmUctB85UqLRgpkVyYg5EwwYh74wrsrJnbwb0=',
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const linkPath = path.join(root, 'node_modules', '@tummycrypt', 'tinyvectors');

if (!existsSync(linkPath)) {
	console.error('build-tinyvectors: @tummycrypt/tinyvectors is not installed; run npm install first');
	process.exit(1);
}

const pkgDir = realpathSync(linkPath);
const sentinels = ['dist/index.js', 'dist/svelte/index.js', 'dist-types/index.d.ts'];
if (sentinels.every((rel) => existsSync(path.join(pkgDir, rel)))) {
	console.log('build-tinyvectors: dist/ already present, skipping');
	process.exit(0);
}

// The nested pnpm invocation must not inherit this npm install's lifecycle
// config (npm_config_* / npm_package_* / PNPM_* / NODE_ENV), or flags like
// legacy-peer-deps, --omit=dev, and registry/workspace state would leak into
// the package's own install.
const env = Object.fromEntries(
	Object.entries(process.env).filter(
		([key]) => !/^(npm_config_|npm_package_|npm_lifecycle_|PNPM_)/i.test(key) && key !== 'NODE_ENV',
	),
);
// corepack ships with Node >= 16.9; resolve it next to the running node so
// the hook works even when it is not on PATH (e.g. minimal CI shells). It
// selects the pnpm version pinned by the cwd package.json's `packageManager`.
env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0';
const corepackNextToNode = path.join(path.dirname(process.execPath), 'corepack');
const corepackCmd = existsSync(corepackNextToNode) ? corepackNextToNode : 'corepack';

const specifier = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies?.[
	'@tummycrypt/tinyvectors'
];
const expected = PINNED_INTEGRITY[specifier];
if (!expected) {
	console.error(
		`build-tinyvectors: no pinned integrity for specifier ${specifier}; add the registry source.json SRI to PINNED_INTEGRITY`,
	);
	process.exit(1);
}

const scratch = mkdtempSync(path.join(tmpdir(), 'tinyvectors-build-'));
const run = (args, cwd) => {
	const result = spawnSync(corepackCmd, ['pnpm', ...args], { cwd, stdio: 'inherit', env });
	if (result.error) {
		console.error(`build-tinyvectors: failed to spawn ${corepackCmd}: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) {
		console.error(`build-tinyvectors: corepack pnpm ${args.join(' ')} failed`);
		process.exit(result.status ?? 1);
	}
};

// Walk a tree (excluding build outputs + node_modules) and return relative
// file paths, for the byte-equality proof between the verified archive and
// what npm actually installed.
const EXCLUDED = new Set(['node_modules', 'dist', 'dist-types']);
const walk = (dir, base = dir) => {
	const out = [];
	for (const entry of readdirSync(dir)) {
		if (EXCLUDED.has(entry) && path.relative(base, dir) === '') continue;
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full, base));
		else out.push(path.relative(base, full));
	}
	return out;
};

try {
	// 1. Fetch the pinned archive and verify its sha256 against the registry
	//    SRI. package-lock's sha512 guards npm's copy; this check anchors the
	//    bytes to the bazel-registry pin independently of any lockfile state.
	const response = await fetch(specifier);
	if (!response.ok) {
		console.error(`build-tinyvectors: fetch of ${specifier} failed: ${response.status}`);
		process.exit(1);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	const actual = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
	if (actual !== expected) {
		console.error(
			`build-tinyvectors: INTEGRITY MISMATCH for ${specifier}\n  expected ${expected}\n  actual   ${actual}\nRefusing to build; the archive bytes do not match the bazel-registry pin.`,
		);
		process.exit(1);
	}

	// 2. Unpack the VERIFIED bytes; build from them, never from the npm copy.
	const archivePath = path.join(scratch, 'archive.tar.gz');
	writeFileSync(archivePath, bytes);
	const tar = spawnSync('tar', ['-xzf', archivePath, '-C', scratch], { stdio: 'inherit' });
	if (tar.error) {
		console.error(`build-tinyvectors: failed to spawn tar: ${tar.error.message}`);
		process.exit(1);
	}
	if (tar.status !== 0) {
		console.error('build-tinyvectors: tar extraction failed');
		process.exit(1);
	}
	const unpacked = readdirSync(scratch).find((d) => d.startsWith('tinyvectors-'));
	if (!unpacked) {
		console.error('build-tinyvectors: unexpected archive layout (no tinyvectors-* root)');
		process.exit(1);
	}
	const verifiedDir = path.join(scratch, unpacked);

	// 3. Prove the npm-installed package is byte-identical to the verified
	//    source (runtime resolves package.json/exports from the npm copy).
	//    One documented npm mutation is allowed: pacote renames a tarball's
	//    .gitignore to .npmignore while unpacking, so that name maps back to
	//    the verified .gitignore (bytes still compared below).
	const verifiedFiles = walk(verifiedDir);
	const installedFiles = walk(pkgDir);
	const verifiedSet = new Set(verifiedFiles);
	const installedSet = new Set(installedFiles);
	const gitignoreAlias = (rel) => path.join(path.dirname(rel), '.npmignore');
	for (const rel of installedFiles) {
		if (verifiedSet.has(rel)) continue;
		const isRenamedGitignore =
			path.basename(rel) === '.npmignore' && verifiedSet.has(path.join(path.dirname(rel), '.gitignore'));
		if (isRenamedGitignore) continue;
		console.error(`build-tinyvectors: installed package has file not in verified archive: ${rel}`);
		process.exit(1);
	}
	for (const rel of verifiedFiles) {
		let installedRel = rel;
		if (!installedSet.has(rel) && path.basename(rel) === '.gitignore' && installedSet.has(gitignoreAlias(rel))) {
			installedRel = gitignoreAlias(rel);
		}
		const installed = path.join(pkgDir, installedRel);
		if (!existsSync(installed) || !readFileSync(path.join(verifiedDir, rel)).equals(readFileSync(installed))) {
			console.error(`build-tinyvectors: installed package diverges from verified archive at: ${rel}`);
			process.exit(1);
		}
	}

	// 4. Build from the verified tree and copy only dist/ + dist-types/ back.
	run(['install', '--frozen-lockfile', '--ignore-workspace'], verifiedDir);
	run(['run', 'build'], verifiedDir);
	for (const dir of ['dist', 'dist-types']) {
		const built = path.join(verifiedDir, dir);
		if (!existsSync(built)) {
			console.error(`build-tinyvectors: expected build output ${dir}/ is missing`);
			process.exit(1);
		}
		rmSync(path.join(pkgDir, dir), { recursive: true, force: true });
		cpSync(built, path.join(pkgDir, dir), { recursive: true });
	}
	console.log(
		'build-tinyvectors: verified sha256 against the registry pin; built dist/ + dist-types/ from the pinned source archive',
	);
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
