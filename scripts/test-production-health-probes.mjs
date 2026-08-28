import assert from 'node:assert/strict';

import {
	DAY_MS,
	buildFreshnessCheck,
	buildSitemapCoverageCheck,
	buildTssProvenanceCheck,
	buildTssRobotsCheck,
	parseAppVersionMs,
	parseDeployTierMeta,
	parseSitemapLocs,
} from './production-health-probes.mjs';

const nowMs = Date.UTC(2026, 7, 28, 12, 0, 0);

// version.json parsing
assert.equal(parseAppVersionMs('{"version":"1786570603829"}'), 1786570603829);
assert.equal(parseAppVersionMs('{"version":1786570603829}'), 1786570603829);
assert.equal(parseAppVersionMs('{"version":"not-a-timestamp"}'), null);
assert.equal(parseAppVersionMs('{"version":""}'), null);
assert.equal(parseAppVersionMs('not json'), null);
assert.equal(parseAppVersionMs('[]'), null);

// freshness age math: fresh, stale, boundary, unparsable, unreachable
const fresh = buildFreshnessCheck({
	name: 'freshness',
	versionText: JSON.stringify({ version: String(nowMs - 2 * DAY_MS) }),
	nowMs,
});
assert.equal(fresh.ok, true);
assert.equal(fresh.warn, undefined);
assert.match(fresh.detail, /age=2\.0d/);

const stale = buildFreshnessCheck({
	name: 'freshness',
	versionText: JSON.stringify({ version: String(nowMs - 16 * DAY_MS) }),
	nowMs,
});
assert.equal(stale.ok, true, 'a frozen production build must never fail the run');
assert.equal(stale.warn, true);
assert.match(stale.detail, /age=16\.0d/);
assert.match(stale.detail, /older than 7d/);

const boundary = buildFreshnessCheck({
	name: 'freshness',
	versionText: JSON.stringify({ version: String(nowMs - 7 * DAY_MS) }),
	nowMs,
});
assert.equal(boundary.warn, undefined, 'exactly 7d old is not yet a warning');

const overBoundary = buildFreshnessCheck({
	name: 'freshness',
	versionText: JSON.stringify({ version: String(nowMs - 7 * DAY_MS - 1) }),
	nowMs,
});
assert.equal(overBoundary.warn, true);

const custom = buildFreshnessCheck({
	name: 'freshness',
	versionText: JSON.stringify({ version: String(nowMs - 2 * DAY_MS) }),
	nowMs,
	warnAfterDays: 1,
});
assert.equal(custom.warn, true);

const unparsable = buildFreshnessCheck({ name: 'freshness', versionText: '{"version":"nope"}', nowMs });
assert.equal(unparsable.ok, true);
assert.equal(unparsable.warn, true);

const unreachable = buildFreshnessCheck({ name: 'freshness', versionText: null, nowMs, error: 'status=404' });
assert.equal(unreachable.ok, true);
assert.equal(unreachable.warn, true);
assert.match(unreachable.detail, /status=404/);

// deploy-tier meta parsing
const shadowHtml = `<head>
	<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow">
	<meta name="tinyland-source-sha" content="7aed5bebd1aa066745aa996f59238af1cdc434d4" data-deploy-tier="shadow">
</head>`;
const shadowMeta = parseDeployTierMeta(shadowHtml);
assert.equal(shadowMeta.sourceSha, '7aed5bebd1aa066745aa996f59238af1cdc434d4');
assert.equal(shadowMeta.shadowRobots, true);

// self-closing and whitespace-tolerant variants (Svelte SSR output)
assert.equal(parseDeployTierMeta('<meta name="robots" content="noindex, nofollow"/>').shadowRobots, true);
assert.equal(parseDeployTierMeta('<META NAME="robots" CONTENT="NOINDEX,NOFOLLOW">').shadowRobots, true);

// today's tss artifact: plain noindex only, no source-sha stamp
const preV2Meta = parseDeployTierMeta('<meta name="robots" content="noindex"/>');
assert.equal(preV2Meta.sourceSha, null);
assert.equal(preV2Meta.shadowRobots, false, 'plain noindex is not the shadow stamp');

// provenance check states
assert.equal(
	buildTssProvenanceCheck({ name: 'p', sourceSha: null, expectedSha: 'abc' }).detail,
	'tss serves a pre-v2 artifact (no source-sha meta)',
);
assert.equal(buildTssProvenanceCheck({ name: 'p', sourceSha: null, expectedSha: 'abc' }).ok, true);
assert.equal(buildTssProvenanceCheck({ name: 'p', sourceSha: null, expectedSha: 'abc' }).warn, true);

const drifted = buildTssProvenanceCheck({ name: 'p', sourceSha: 'aaa', expectedSha: 'bbb' });
assert.equal(drifted.ok, true, 'a stale tss must never fail the production run');
assert.equal(drifted.warn, true);
assert.match(drifted.detail, /aaa/);
assert.match(drifted.detail, /bbb/);

const matched = buildTssProvenanceCheck({ name: 'p', sourceSha: 'aaa', expectedSha: 'aaa' });
assert.equal(matched.warn, undefined);

const noExpectation = buildTssProvenanceCheck({ name: 'p', sourceSha: 'aaa', expectedSha: '' });
assert.equal(noExpectation.warn, undefined);
assert.match(noExpectation.detail, /EXPECTED_MAIN_SHA unset/);

const tssDown = buildTssProvenanceCheck({ name: 'p', sourceSha: null, expectedSha: 'aaa', error: '/: timeout' });
assert.equal(tssDown.ok, true);
assert.equal(tssDown.warn, true);

// robots coverage: all / none / mixed
const allStamped = buildTssRobotsCheck({
	name: 'r',
	routes: [
		{ path: '/', shadowRobots: true },
		{ path: '/blog', shadowRobots: true },
	],
});
assert.equal(allStamped.ok, true);
assert.equal(allStamped.warn, undefined);

const noneStamped = buildTssRobotsCheck({
	name: 'r',
	routes: [
		{ path: '/', shadowRobots: false },
		{ path: '/blog', shadowRobots: false },
	],
});
assert.equal(noneStamped.ok, true);
assert.equal(noneStamped.warn, true);

const mixed = buildTssRobotsCheck({
	name: 'r',
	routes: [
		{ path: '/', shadowRobots: true },
		{ path: '/blog', shadowRobots: false },
	],
});
assert.equal(mixed.ok, false, 'mixed stamping is a misconfigured build and must fail');
assert.match(mixed.detail, /missing=\/blog/);

// sitemap parsing: same-host filter, dedupe, cap
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
	<url><loc>https://transscendsurvival.org/</loc></url>
	<url><loc>https://transscendsurvival.org/blog</loc></url>
	<url><loc>https://transscendsurvival.org/blog</loc></url>
	<url><loc>https://www.transscendsurvival.org/blog</loc></url>
	<url><loc>https://hub.tinyland.dev/elsewhere</loc></url>
	<url><loc>not a url</loc></url>
</urlset>`;
const parsedSitemap = parseSitemapLocs(sitemap, { host: 'transscendsurvival.org' });
assert.equal(parsedSitemap.total, 6);
assert.equal(parsedSitemap.sameHost, 2, 'www and hub hosts are excluded, duplicates collapse');
assert.deepEqual(parsedSitemap.urls, ['https://transscendsurvival.org/', 'https://transscendsurvival.org/blog']);

const many = `<urlset>${Array.from(
	{ length: 80 },
	(_, index) => `<url><loc>https://transscendsurvival.org/p/${index}</loc></url>`,
).join('')}</urlset>`;
const capped = parseSitemapLocs(many, { host: 'transscendsurvival.org', cap: 60 });
assert.equal(capped.sameHost, 80);
assert.equal(capped.urls.length, 60);

// sitemap coverage verdicts
const allOk = buildSitemapCoverageCheck({
	name: 's',
	results: [
		{ url: 'https://transscendsurvival.org/', status: 200 },
		{ url: 'https://transscendsurvival.org/blog', status: 200 },
	],
	sameHost: 2,
	cap: 60,
});
assert.equal(allOk.ok, true);
assert.equal(allOk.detail, '2/2 return 200');

const broken = buildSitemapCoverageCheck({
	name: 's',
	results: [
		{ url: 'https://transscendsurvival.org/', status: 200 },
		{ url: 'https://transscendsurvival.org/search', status: 404 },
	],
	sameHost: 2,
	cap: 60,
});
assert.equal(broken.ok, false);
assert.match(broken.detail, /1\/2 non-200/);
assert.match(broken.detail, /\/search status=404/);

const unreachableRoute = buildSitemapCoverageCheck({
	name: 's',
	results: [{ url: 'https://transscendsurvival.org/blog', status: 0, error: 'fetch failed' }],
	sameHost: 1,
	cap: 60,
});
assert.equal(unreachableRoute.ok, false);
assert.match(unreachableRoute.detail, /unreachable \(fetch failed\)/);

const cappedCoverage = buildSitemapCoverageCheck({
	name: 's',
	results: [{ url: 'https://transscendsurvival.org/', status: 200 }],
	sameHost: 144,
	cap: 60,
});
assert.match(cappedCoverage.detail, /capped 1\/144/);

assert.equal(buildSitemapCoverageCheck({ name: 's', results: [], sameHost: 0, cap: 60 }).ok, false);
assert.equal(
	buildSitemapCoverageCheck({ name: 's', results: [], sameHost: 0, cap: 60, error: 'status=500' }).ok,
	false,
);

console.log('production health probe helpers: all assertions passed');
