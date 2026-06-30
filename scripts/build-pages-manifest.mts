#!/usr/bin/env node

/**
 * build-pages-manifest.mts
 *
 * B9 / TIN-2273 — generate the AUTHORITATIVE Pages manifest.
 *
 * Enumerates Jesssullivan repos with `has_pages == true` via the read-only
 * GitHub API, plus the known Cloudflare Pages project(s), and emits a stable,
 * committed `static/pages-manifest.json`. That committed JSON is the single
 * source of truth for:
 *   - functions/[[path]].ts        → `ALLOW` (slugs where served && !exclude)
 *   - scripts/check-production-health.mts → `SEED_APEX_SLUGS` (same derivation)
 * so the apex allowlist + the canary seed stop drifting (they used to be three
 * hand-maintained copies). Adding a slug = add ONE manifest entry, not three.
 *
 * Bazel-SSOT / graph accuracy (TIN-2252): this generator performs a
 * NON-HERMETIC gh-API enumeration and is therefore CI-ONLY and OFF the RBE
 * cache path. It is NEVER wrapped in a Bazel target — exactly like
 * scripts/collect-external-posts.mts produces .github/external-posts.json from a
 * workflow and the build then consumes that committed artifact deterministically.
 * Do not add Bazel build work here; the RBE executor concurrency cap is 4.
 *
 * Determinism: output is fully sorted (entries by slug) with a FIXED key order
 * and pretty-printed with a trailing newline, so regenerating against the same
 * upstream is byte-stable and the schema test + drift alarm (B10/B21) can diff it.
 *
 * Environment (mirrors collect-external-posts.mts conventions):
 *   GH_TOKEN        — GitHub token with read access (GitHub App or PAT). CI only.
 *   DISPATCH_REPO   — single repo from repository_dispatch(pages-changed) (optional)
 *   MANUAL_REPOS    — comma-separated repos from workflow_dispatch (optional)
 *
 * Usage:
 *   tsx scripts/build-pages-manifest.mts            # full regen (committed output)
 *   tsx scripts/build-pages-manifest.mts --check    # regen in-memory; non-zero if drift
 *   tsx scripts/build-pages-manifest.mts --repos owner/name,owner/name2
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'static', 'pages-manifest.json');
const EXCLUDE_PATH = join(ROOT, '.github', 'pages-manifest-exclude.json');

// GitHub owner that owns the github.io child sites.
const OWNER = 'Jesssullivan';
// Where the github.io children actually serve from.
const CHILD_ORIGIN = 'https://jesssullivan.github.io';
// The apex CF Pages project that fronts everything (B3/B4 Function host).
const APEX = 'transscendsurvival.org';

export type PageSource = 'github-pages' | 'cf-pages';
export type PageKind = 'sveltekit' | 'mkdocs' | 'static';

export interface PagesManifestEntry {
	/** URL path segment under the apex (e.g. "zig-crypto" → /zig-crypto/). */
	slug: string;
	/** Where the child is hosted upstream. */
	source: PageSource;
	/** Build flavor; drives later embed/index behavior (B8/B11). */
	kind: PageKind;
	/** Live child origin URL (the github.io / cf project the Function proxies to). */
	origin: string;
	/**
	 * Pre-built, hydration-ready embed bundle URL. null until B8 fills it for
	 * SvelteKit children; static/mkdocs children never need one.
	 */
	embedArtifactUrl: string | null;
	/** True if the child can be embedded with apex chrome (B6/B8). Conservative. */
	embedCapable: boolean;
	/** Path to the child's Pagefind index for federated search. null until B15-B19. */
	pagefindIndexPath: string | null;
	/**
	 * Known sub-routes for the child. Index-only ([]) is VALID and NEVER an error
	 * — the Function proxies the whole subtree regardless. Populated later by B11.
	 */
	routes: string[];
	/**
	 * Operator hard-block (TIN-1692 exclusion intent): true removes the slug from
	 * EVERY derived surface (ALLOW + SEED + search). Use for retired/broken pages.
	 */
	exclude: boolean;
	/**
	 * Live-serve gate. The manifest may LIST a child (discovered, embed-capable)
	 * before the apex is wired to actually serve it. `served:false` keeps the
	 * entry present-but-dark: it is NOT added to ALLOW/SEED, so live apex behavior
	 * is unchanged. Flip to true (one place) to light a child up at the apex.
	 *
	 * Derived ALLOW/SEED = entries where `served && !exclude`.
	 */
	served: boolean;
}

export interface PagesManifest {
	/** Schema version for the drift alarm + validator (B10/B21). */
	version: 1;
	/** The apex host these children render under. */
	apex: string;
	/** Sorted, fixed-key-order entries. Sorted by slug for byte-stability. */
	pages: PagesManifestEntry[];
}

interface ExcludeConfig {
	/** Slugs to hard-exclude (TIN-1692). Removed from EVERY derived surface. */
	exclude: string[];
	/**
	 * Live-serve ALLOWLIST. A discovered/injected child is `served:true` ONLY if
	 * its slug appears here (and is not excluded). Everything else is listed
	 * present-but-dark (`served:false`) — discovery is automatic, but lighting a
	 * child up at the apex is a deliberate one-line edit here. This is the gate
	 * that keeps derived ALLOW/SEED == exactly the slugs the apex truly serves.
	 */
	served: string[];
	/** Repo names to skip entirely (never even listed). */
	skip: string[];
	/** Extra non-github-pages entries to inject (e.g. cf-pages projects). */
	cfPages: Array<{ slug: string; origin: string; kind?: PageKind }>;
}

const DEFAULT_EXCLUDE: ExcludeConfig = {
	exclude: [],
	served: [],
	skip: [],
	cfPages: [],
};

function loadExcludeConfig(): ExcludeConfig {
	if (!existsSync(EXCLUDE_PATH)) return DEFAULT_EXCLUDE;
	const raw = JSON.parse(readFileSync(EXCLUDE_PATH, 'utf-8')) as Partial<ExcludeConfig>;
	return {
		exclude: raw.exclude ?? [],
		served: raw.served ?? [],
		skip: raw.skip ?? [],
		cfPages: raw.cfPages ?? [],
	};
}

/** Run gh; throw on failure. Used where an error must NOT be swallowed. */
function ghRun(args: string[]): string {
	return execFileSync('gh', args, {
		encoding: 'utf-8',
		env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
	}).trim();
}

/**
 * Run gh and return stdout, or '' on failure. Use ONLY for best-effort content
 * probes (a missing path / one flaky probe must not abort a whole regen). Never
 * use this for the top-level enumeration — a swallowed failure there would emit
 * an EMPTY manifest and silently wipe the allowlist (see enumeratePagesRepos).
 */
function ghTry(args: string[]): string {
	try {
		return ghRun(args);
	} catch {
		return '';
	}
}

interface RepoMeta {
	name: string;
	fork: boolean;
	archived: boolean;
	defaultBranch: string;
}

/**
 * Enumerate OWNER repos with has_pages==true (read-only).
 *
 * THROWS on API failure — never returns [] for a network/auth error. An empty
 * manifest would wipe the derived ALLOW/SEED and 404 every aggregated child; a
 * hard failure keeps the last-good committed manifest in place instead. Retries
 * a couple times to ride out the transient timeouts seen against the gh API.
 */
function enumeratePagesRepos(): RepoMeta[] {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const out = ghRun([
				'api',
				'--paginate',
				`users/${OWNER}/repos?per_page=100`,
				'--jq',
				'.[] | select(.has_pages==true) | {name, fork, archived, defaultBranch: .default_branch}',
			]);
			// --jq emits one JSON object per line. Empty output = genuinely zero
			// has_pages repos, which for THIS owner is itself a red flag → reject.
			const repos = out
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as RepoMeta);
			if (repos.length === 0) {
				throw new Error('enumeration returned zero has_pages repos (suspect failure)');
			}
			return repos;
		} catch (err) {
			lastErr = err;
			console.error(`enumeratePagesRepos attempt ${attempt}/3 failed: ${String(err)}`);
		}
	}
	throw new Error(
		`Could not enumerate ${OWNER} Pages repos after 3 attempts: ${String(lastErr)}. ` +
			`Refusing to write an empty manifest (would wipe the apex allowlist).`
	);
}

/**
 * Kind heuristic — probe the repo's default branch for a build signature.
 * Conservative: unknown defaults to "static" (safe; never embeds, never errors).
 * Refined later (B11) once children publish a self-describing marker.
 */
function detectKind(repo: RepoMeta): { kind: PageKind; embedCapable: boolean } {
	const has = (path: string): boolean =>
		ghTry(['api', `repos/${OWNER}/${repo.name}/contents/${path}`, '--jq', '.name']) !== '';

	// mkdocs: zero-hydration static HTML with relative assets → proxies cleanly today.
	if (has('mkdocs.yml') || has('mkdocs.yaml')) {
		return { kind: 'mkdocs', embedCapable: false };
	}
	// sveltekit: needs the B8 embed-rebuild lane before it can be hosted under chrome.
	if (
		has('svelte.config.js') ||
		has('svelte.config.ts') ||
		has('svelte.config.mjs')
	) {
		return { kind: 'sveltekit', embedCapable: true };
	}
	// Default: plain static (GitHub Pages classic / mkdocs-built / hand-rolled).
	return { kind: 'static', embedCapable: false };
}

function buildEntry(
	slug: string,
	source: PageSource,
	kind: PageKind,
	origin: string,
	embedCapable: boolean,
	exclude: boolean,
	served: boolean
): PagesManifestEntry {
	// FIXED key order — do not reorder; the serializer relies on insertion order
	// for byte-stable output across regens.
	return {
		slug,
		source,
		kind,
		origin,
		embedArtifactUrl: null, // B8 fills for hydrating SvelteKit children.
		embedCapable,
		pagefindIndexPath: null, // B15-B19 fills for federated search.
		routes: [], // index-only is valid; B11 may populate.
		exclude,
		served,
	};
}

function buildManifest(): PagesManifest {
	const cfg = loadExcludeConfig();
	const skip = new Set(cfg.skip);
	const excludeSet = new Set(cfg.exclude);
	const servedSet = new Set(cfg.served);

	const cliReposIdx = process.argv.indexOf('--repos');
	const cliRepos =
		cliReposIdx !== -1 && process.argv[cliReposIdx + 1]
			? process.argv[cliReposIdx + 1].split(',').map((s) => s.trim().split('/').pop()!)
			: process.env.MANUAL_REPOS
				? process.env.MANUAL_REPOS.split(',').map((s) => s.trim().split('/').pop()!)
				: process.env.DISPATCH_REPO
					? [process.env.DISPATCH_REPO.split('/').pop()!]
					: null;

	const entries: PagesManifestEntry[] = [];

	// 1) github-pages children.
	let repos = enumeratePagesRepos();
	// Default policy: forks/archived are noise — list neither. Operators can still
	// hard-skip live repos via the exclude config's `skip`.
	repos = repos.filter((r) => !r.fork && !r.archived && !skip.has(r.name));
	if (cliRepos) repos = repos.filter((r) => cliRepos.includes(r.name));

	for (const repo of repos) {
		const slug = repo.name;
		const { kind, embedCapable } = detectKind(repo);
		const exclude = excludeSet.has(slug);
		// served = explicitly on the serve allowlist AND not excluded.
		const served = servedSet.has(slug) && !exclude;
		entries.push(
			buildEntry(
				slug,
				'github-pages',
				kind,
				`${CHILD_ORIGIN}/${slug}/`,
				embedCapable,
				exclude,
				served
			)
		);
	}

	// 2) Known Cloudflare Pages projects (config-injected; not gh-enumerable).
	for (const cf of cfg.cfPages) {
		if (skip.has(cf.slug)) continue;
		const exclude = excludeSet.has(cf.slug);
		const served = servedSet.has(cf.slug) && !exclude;
		entries.push(
			buildEntry(
				cf.slug,
				'cf-pages',
				cf.kind ?? 'static',
				cf.origin,
				false,
				exclude,
				served
			)
		);
	}

	// Deterministic: sort by slug.
	entries.sort((a, b) => a.slug.localeCompare(b.slug, 'en'));

	return { version: 1, apex: APEX, pages: entries };
}

/**
 * Serialize byte-stable. Pretty-printed, 2-space, trailing newline. Object key
 * order follows insertion order from buildEntry (fixed), so the output is a pure
 * function of (sorted entries) → string.
 */
export function serializeManifest(manifest: PagesManifest): string {
	return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * JSON-schema-ish validator (no external deps; runnable in the schema test).
 * Returns [] when valid, else a list of human-readable problems. routes:[] is
 * explicitly VALID (index-only children are normal, never an error).
 */
export function validatePagesManifest(value: unknown): string[] {
	const errs: string[] = [];
	const isObj = (v: unknown): v is Record<string, unknown> =>
		typeof v === 'object' && v !== null && !Array.isArray(v);

	if (!isObj(value)) return ['root: expected object'];
	if (value.version !== 1) errs.push('version: expected literal 1');
	if (typeof value.apex !== 'string' || value.apex.length === 0)
		errs.push('apex: expected non-empty string');
	if (!Array.isArray(value.pages)) {
		errs.push('pages: expected array');
		return errs;
	}

	const sources = new Set(['github-pages', 'cf-pages']);
	const kinds = new Set(['sveltekit', 'mkdocs', 'static']);
	const seen = new Set<string>();
	let prev = '';

	value.pages.forEach((entry, i) => {
		const at = `pages[${i}]`;
		if (!isObj(entry)) {
			errs.push(`${at}: expected object`);
			return;
		}
		if (typeof entry.slug !== 'string' || entry.slug.length === 0)
			errs.push(`${at}.slug: expected non-empty string`);
		else {
			if (seen.has(entry.slug)) errs.push(`${at}.slug: duplicate "${entry.slug}"`);
			seen.add(entry.slug);
			// Determinism guard: entries MUST be sorted by slug.
			if (prev && entry.slug.localeCompare(prev, 'en') < 0)
				errs.push(`${at}.slug: not sorted ("${entry.slug}" after "${prev}")`);
			prev = entry.slug;
		}
		if (typeof entry.source !== 'string' || !sources.has(entry.source))
			errs.push(`${at}.source: expected one of ${[...sources].join('|')}`);
		if (typeof entry.kind !== 'string' || !kinds.has(entry.kind))
			errs.push(`${at}.kind: expected one of ${[...kinds].join('|')}`);
		if (typeof entry.origin !== 'string' || !/^https?:\/\//.test(entry.origin))
			errs.push(`${at}.origin: expected http(s) URL`);
		if (!(entry.embedArtifactUrl === null || typeof entry.embedArtifactUrl === 'string'))
			errs.push(`${at}.embedArtifactUrl: expected string|null`);
		if (typeof entry.embedCapable !== 'boolean')
			errs.push(`${at}.embedCapable: expected boolean`);
		if (!(entry.pagefindIndexPath === null || typeof entry.pagefindIndexPath === 'string'))
			errs.push(`${at}.pagefindIndexPath: expected string|null`);
		if (!Array.isArray(entry.routes) || entry.routes.some((r) => typeof r !== 'string'))
			errs.push(`${at}.routes: expected string[] ([] is valid)`);
		if (typeof entry.exclude !== 'boolean') errs.push(`${at}.exclude: expected boolean`);
		if (typeof entry.served !== 'boolean') errs.push(`${at}.served: expected boolean`);
	});

	return errs;
}

/** The single SSOT derivation. ALLOW == SEED == servedSlugs(manifest). */
export function servedSlugs(manifest: PagesManifest): string[] {
	return manifest.pages
		.filter((p) => p.served && !p.exclude)
		.map((p) => p.slug)
		.sort((a, b) => a.localeCompare(b, 'en'));
}

// ── main ────────────────────────────────────────────────────────────────────
// Guarded so the validator/derivation helpers above can be imported by the
// schema test WITHOUT triggering a live gh enumeration or a manifest rewrite.
function main(): void {
	const isCheck = process.argv.includes('--check');

	const manifest = buildManifest();

	const problems = validatePagesManifest(manifest);
	if (problems.length > 0) {
		console.error('pages-manifest validation failed:');
		for (const p of problems) console.error(`  - ${p}`);
		process.exit(1);
	}

	const serialized = serializeManifest(manifest);

	if (isCheck) {
		const current = existsSync(MANIFEST_PATH) ? readFileSync(MANIFEST_PATH, 'utf-8') : '';
		if (current !== serialized) {
			console.error('pages-manifest DRIFT: static/pages-manifest.json is stale.');
			console.error('Run: tsx scripts/build-pages-manifest.mts');
			process.exit(1);
		}
		console.log(`pages-manifest up to date (${manifest.pages.length} pages).`);
		return;
	}

	writeFileSync(MANIFEST_PATH, serialized, 'utf-8');
	console.log(
		`Wrote static/pages-manifest.json: ${manifest.pages.length} pages, ` +
			`served=[${servedSlugs(manifest).join(', ')}].`
	);
}

// Run only as a CLI entrypoint (tsx scripts/build-pages-manifest.mts), not on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main();
}
