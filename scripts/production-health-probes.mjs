// Pure helpers for the freshness / provenance / sitemap-coverage probes in
// scripts/check-production-health.mts. Kept side-effect free and network free so
// scripts/test-production-health-probes.mjs can exercise the parsing and age math
// without touching production.

export const DAY_MS = 86_400_000;
export const PROD_FRESHNESS_WARN_DAYS = 7;
export const SITEMAP_URL_CAP = 60;
export const SITEMAP_CONCURRENCY = 6;
export const SITEMAP_TIMEOUT_MS = 10_000;

/**
 * SvelteKit writes `kit.version.name` into /_app/version.json. This repo leaves it at
 * the default, so the value is the build timestamp in epoch milliseconds.
 * @param {string} text
 * @returns {number | null}
 */
export function parseAppVersionMs(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const raw = /** @type {Record<string, unknown>} */ (parsed).version;
	if (typeof raw !== 'string' && typeof raw !== 'number') return null;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return null;
	return value;
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatAgeDays(ms) {
	return `${(ms / DAY_MS).toFixed(1)}d`;
}

/**
 * Production promotion is an explicit operator ceremony: the publisher lane is
 * dispatch-gated and its kill switch defaults false, so a stale build is a
 * deliberate state, never a broken one. This probe therefore warns and never
 * fails -- it exists so that a multi-week silent freeze cannot recur unnoticed,
 * not to force a promotion the operator is intentionally holding.
 * @param {{ name: string, versionText: string | null, nowMs: number, warnAfterDays?: number, error?: string }} input
 * @returns {{ name: string, ok: true, warn?: boolean, detail: string }}
 */
export function buildFreshnessCheck(input) {
	const { name, versionText, nowMs, warnAfterDays = PROD_FRESHNESS_WARN_DAYS, error } = input;
	if (versionText === null) {
		return { name, ok: true, warn: true, detail: `version.json unavailable: ${error ?? 'no response body'}` };
	}

	const builtMs = parseAppVersionMs(versionText);
	if (builtMs === null) {
		return { name, ok: true, warn: true, detail: 'version.json has no parsable epoch-ms version field' };
	}

	const ageMs = nowMs - builtMs;
	const built = new Date(builtMs).toISOString();
	const detail = `built=${built}; age=${formatAgeDays(ageMs)}`;
	if (ageMs > warnAfterDays * DAY_MS) {
		return {
			name,
			ok: true,
			warn: true,
			detail: `${detail}; older than ${warnAfterDays}d (promotion is an operator ceremony; not a failure)`,
		};
	}

	return { name, ok: true, detail };
}

/**
 * @param {string} html
 * @returns {Record<string, string>[]}
 */
function metaTags(html) {
	const tags = [];
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		/** @type {Record<string, string>} */
		const attributes = {};
		for (const attribute of match[0].matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
			attributes[attribute[1].toLowerCase()] = attribute[2];
		}
		tags.push(attributes);
	}
	return tags;
}

/**
 * Reads the shadow provenance stamp emitted by src/routes/+layout.svelte and
 * scripts/stamp-deploy-tier-output.mjs on shadow-tier builds.
 * @param {string} html
 * @returns {{ sourceSha: string | null, shadowRobots: boolean }}
 */
export function parseDeployTierMeta(html) {
	const tags = metaTags(html);
	const source = tags.find((tag) => tag.name === 'tinyland-source-sha');
	const sourceSha = source?.content && source.content.length > 0 ? source.content : null;
	const shadowRobots = tags.some(
		(tag) => tag.name === 'robots' && tag.content?.replace(/\s+/g, '').toLowerCase() === 'noindex,nofollow',
	);
	return { sourceSha, shadowRobots };
}

/**
 * @param {{ name: string, sourceSha: string | null, expectedSha?: string | null, error?: string }} input
 * @returns {{ name: string, ok: true, warn?: boolean, detail: string }}
 */
export function buildTssProvenanceCheck(input) {
	const { name, sourceSha, expectedSha, error } = input;
	if (error) {
		return { name, ok: true, warn: true, detail: `tss unreachable: ${error}` };
	}
	if (sourceSha === null) {
		return { name, ok: true, warn: true, detail: 'tss serves a pre-v2 artifact (no source-sha meta)' };
	}
	if (!expectedSha) {
		return { name, ok: true, detail: `tss source-sha=${sourceSha}; EXPECTED_MAIN_SHA unset, parity not evaluated` };
	}
	if (sourceSha !== expectedSha) {
		return { name, ok: true, warn: true, detail: `tss source-sha=${sourceSha}; expected main=${expectedSha}` };
	}
	return { name, ok: true, detail: `tss source-sha=${sourceSha} matches main` };
}

/**
 * Mixed robots stamping means a misconfigured build mixing tiers, which is a real
 * failure. Missing everywhere is the pre-v2 artifact currently served by tss.
 * @param {{ name: string, routes: { path: string, shadowRobots: boolean }[] }} input
 * @returns {{ name: string, ok: boolean, warn?: boolean, detail: string }}
 */
export function buildTssRobotsCheck(input) {
	const { name, routes } = input;
	if (routes.length === 0) {
		return { name, ok: true, warn: true, detail: 'no tss routes fetched' };
	}

	const stamped = routes.filter((route) => route.shadowRobots).map((route) => route.path);
	const missing = routes.filter((route) => !route.shadowRobots).map((route) => route.path);

	if (missing.length === 0) {
		return { name, ok: true, detail: `noindex,nofollow on ${stamped.length}/${routes.length} routes` };
	}
	if (stamped.length === 0) {
		return { name, ok: true, warn: true, detail: 'tss serves a pre-v2 artifact (no shadow robots meta on any route)' };
	}
	return {
		name,
		ok: false,
		detail: `mixed shadow robots stamping: present=${stamped.join(', ')}; missing=${missing.join(', ')}`,
	};
}

/**
 * @param {string} xml
 * @param {{ host: string, cap?: number }} options
 * @returns {{ urls: string[], total: number, sameHost: number, cap: number }}
 */
export function parseSitemapLocs(xml, options) {
	const cap = options.cap ?? SITEMAP_URL_CAP;
	/** @type {string[]} */
	const sameHost = [];
	let total = 0;

	for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
		total++;
		const raw = match[1].replace(/&amp;/g, '&');
		let url;
		try {
			url = new URL(raw);
		} catch {
			continue;
		}
		if (url.hostname !== options.host) continue;
		if (sameHost.includes(url.toString())) continue;
		sameHost.push(url.toString());
	}

	return { urls: sameHost.slice(0, cap), total, sameHost: sameHost.length, cap };
}

/**
 * @param {{ name: string, results: { url: string, status: number, error?: string }[], sameHost: number, cap: number, error?: string }} input
 * @returns {{ name: string, ok: boolean, warn?: boolean, detail: string }}
 */
export function buildSitemapCoverageCheck(input) {
	const { name, results, sameHost, cap, error } = input;
	if (error) {
		return { name, ok: false, detail: `sitemap.xml unavailable: ${error}` };
	}
	if (results.length === 0) {
		return { name, ok: false, detail: 'sitemap.xml contained no same-host <loc> URLs' };
	}

	const bad = results.filter((result) => result.status !== 200);
	const capped = sameHost > cap ? `; capped ${results.length}/${sameHost}` : '';
	if (bad.length === 0) {
		return { name, ok: true, detail: `${results.length}/${results.length} return 200${capped}` };
	}
	const listed = bad.map((result) =>
		result.status === 0
			? `${result.url} unreachable (${result.error ?? 'transport error'})`
			: `${result.url} status=${result.status}`,
	);
	return {
		name,
		ok: false,
		detail: `${bad.length}/${results.length} non-200: ${listed.join(', ')}${capped}`,
	};
}
