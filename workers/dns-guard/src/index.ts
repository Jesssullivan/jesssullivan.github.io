/**
 * transscend-dns-guard — Cloudflare Worker
 *
 * Belt-and-suspenders production monitor for https://transscendsurvival.org, run
 * from Cloudflare's edge across many independent public resolvers.
 *
 * WHY THIS EXISTS
 * The apex A/AAAA records live OUT OF BAND in the DreamHost zone (this repo only
 * ships static/CNAME). On 2026-06-22 the apex lost ALL FOUR AAAA records while
 * keeping A, and while www kept AAAA via its github.io CNAME — so IPv6-preferring
 * visitors got ERR_NAME_NOT_RESOLVED while IPv4 clients (and the owner) saw a
 * healthy site. A plain IPv4 HTTP uptime check stays GREEN through that outage.
 *
 * This Worker asserts, across MANY public resolvers via DoH, that the apex AND
 * www resolve the full GitHub Pages A and AAAA sets — the exact failure a normal
 * monitor misses — then fetches the apex over HTTPS and verifies the canonical
 * redirects. The expected sets are kept byte-identical to
 * scripts/check-production-health.mts.
 *
 * COMPLEMENTS (see ../README.md):
 *   - GH Actions  scripts/check-production-health.mts — authoritative DreamHost NS
 *                 + stale-deploy self-heal (branch fix/content-stats-dispatch-pages)
 *   - UptimeRobot true IPv6-transport HTTP monitor (the v6 socket this can't force)
 *   - StatusCake  DNS record-value monitor + HTTPS
 *   - Healthchecks.io  alert routing (email) + dead-man's-switch
 *
 * ALERTING (both optional, fired in parallel):
 *  - HEALTHCHECK_URL -> Healthchecks.io: ping on success, /fail on failure. EMAIL + dead-man's-switch.
 *  - NTFY_TOPIC_URL  -> ntfy topic: failure-only PUSH. This is the reachable seam of the tinyland
 *    alerting bus (Prometheus + Alertmanager in ~/git/blahaj, which fans out to ntfy + Postfix
 *    email). That Alertmanager is ClusterIP-only, so we post to the ntfy topic directly until it
 *    is exposed off-cluster; full Alertmanager POST /api/v2/alerts is the long-term path (TIN-2148).
 */

export interface Env {
	/** Healthchecks.io ping URL. success -> POST url ; failure -> POST url/fail. Delivers EMAIL. */
	HEALTHCHECK_URL?: string;
	/**
	 * ntfy topic URL (e.g. https://ntfy.sh/blahaj-blog-alerts) — the only internet-reachable
	 * seam of the tinyland alert fan-out (its Alertmanager is ClusterIP-only). Failure-only PUSH.
	 */
	NTFY_TOPIC_URL?: string;
	/** Optional bearer token for an access-protected ntfy topic. */
	NTFY_TOKEN?: string;
}

const APEX = 'transscendsurvival.org';
const WWW = `www.${APEX}`;
const BLOG_BROKER_STREAM_URL = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';

// Canonical GitHub Pages address sets (verbatim — keep in sync with the GH checker).
const EXPECTED_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const EXPECTED_AAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];

// Independent public resolvers exposing JSON DoH. Each is a distinct recursive
// view of the zone — "all resolver permutations". Trivially extensible.
const DOH_RESOLVERS: { label: string; url: (name: string, type: RecordType) => string }[] = [
	{ label: 'Cloudflare', url: (n, t) => `https://cloudflare-dns.com/dns-query?name=${n}&type=${t}` },
	{ label: 'Google', url: (n, t) => `https://dns.google/resolve?name=${n}&type=${t}` },
	{ label: 'Quad9', url: (n, t) => `https://dns.quad9.net:5053/dns-query?name=${n}&type=${t}` },
	{ label: 'AdGuard', url: (n, t) => `https://dns.adguard-dns.com/resolve?name=${n}&type=${t}` },
];

type RecordType = 'A' | 'AAAA';
const DNS_TYPE_CODE: Record<RecordType, number> = { A: 1, AAAA: 28 };
const QUERY_TIMEOUT_MS = 5000;

type Status = 'pass' | 'fail' | 'skip';
interface CheckResult {
	name: string;
	status: Status;
	detail: string;
}

/** Normalize for set comparison: lowercase IPv4; canonical-compress IPv6. */
function normalize(addr: string): string {
	const a = addr.trim().toLowerCase();
	if (!a.includes(':')) return a;
	try {
		return new URL(`http://[${a}]`).hostname.replace(/^\[|\]$/g, '');
	} catch {
		return a;
	}
}

function hasAll(actual: string[], expected: string[]): boolean {
	const seen = new Set(actual.map(normalize));
	return expected.every((e) => seen.has(normalize(e)));
}

function fmt(values: string[]): string {
	return values.length ? [...values].sort().join(', ') : '(none)';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPublicDisplayMembershipPolicy(policy: Record<string, unknown>): boolean {
	const legacyReviewPolicy = policy.unreviewedContentIncluded === false;
	const displayMembershipPolicy =
		policy.projectionPolicy === 'publicPublishedManagedPosts-display-stream' &&
		policy.displayMembershipPolicy === 'public-published-display-membership' &&
		policy.displayMembershipGate === 'frontmatter-published-status-visibility';

	return legacyReviewPolicy || displayMembershipPolicy;
}

function isPublicPublishedFrontmatter(frontmatter: Record<string, unknown>): boolean {
	return frontmatter.published === true && frontmatter.status === 'published' && frontmatter.visibility === 'public';
}

interface DohAnswer {
	type: number;
	data: string;
}
interface DohResponse {
	Status?: number;
	Answer?: DohAnswer[];
}

async function dohQuery(url: string, type: RecordType): Promise<{ ok: boolean; addrs: string[]; note: string }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
	try {
		const res = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: controller.signal });
		if (!res.ok) return { ok: false, addrs: [], note: `HTTP ${res.status}` };
		const body = (await res.json()) as DohResponse;
		if (body.Status !== 0) return { ok: false, addrs: [], note: `DNS status ${body.Status}` };
		const wanted = DNS_TYPE_CODE[type];
		const addrs = (body.Answer ?? []).filter((a) => a.type === wanted).map((a) => a.data);
		return { ok: true, addrs, note: 'ok' };
	} catch (err) {
		return { ok: false, addrs: [], note: err instanceof Error ? err.name : String(err) };
	} finally {
		clearTimeout(timer);
	}
}

async function recordCheck(label: string, url: string, type: RecordType, expected: string[]): Promise<CheckResult> {
	const { ok, addrs, note } = await dohQuery(url, type);
	// A transport/timeout/non-NOERROR hiccup is resolver noise, not a record defect:
	// skip it so a single flaky resolver never pages. A clean NOERROR answer that is
	// MISSING expected records (exactly the 2026-06-22 AAAA outage) is a hard fail.
	if (!ok) return { name: label, status: 'skip', detail: `lookup unavailable (${note})` };
	const pass = hasAll(addrs, expected);
	return {
		name: label,
		status: pass ? 'pass' : 'fail',
		detail: pass ? fmt(addrs) : `expected ${fmt(expected)}; got ${fmt(addrs)}`,
	};
}

async function dnsChecks(): Promise<CheckResult[]> {
	const jobs: Promise<CheckResult>[] = [];
	for (const r of DOH_RESOLVERS) {
		jobs.push(recordCheck(`${r.label} apex A`, r.url(APEX, 'A'), 'A', EXPECTED_A));
		jobs.push(recordCheck(`${r.label} apex AAAA`, r.url(APEX, 'AAAA'), 'AAAA', EXPECTED_AAAA));
		jobs.push(recordCheck(`${r.label} www AAAA`, r.url(WWW, 'AAAA'), 'AAAA', EXPECTED_AAAA));
	}
	return Promise.all(jobs);
}

async function head(url: string): Promise<Response> {
	return fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'user-agent': 'transscend-dns-guard/1.0' } });
}

async function httpChecks(): Promise<CheckResult[]> {
	const out: CheckResult[] = [];
	const livePaths: [string, string][] = [
		['HTTPS apex 200', `https://${APEX}/`],
		['HTTPS /blog 200', `https://${APEX}/blog`],
		['HTTPS /blog/ 200', `https://${APEX}/blog/`],
		['HTTPS representative post 200', `https://${APEX}/blog/tmpui-the-merlin-sound-id-project`],
		['HTTPS representative post slash 200', `https://${APEX}/blog/tmpui-the-merlin-sound-id-project/`],
	];

	for (const [name, url] of livePaths) {
		try {
			const res = await head(url);
			out.push({ name, status: res.status === 200 ? 'pass' : 'fail', detail: `status=${res.status}` });
		} catch (err) {
			out.push({ name, status: 'skip', detail: `fetch failed (${err instanceof Error ? err.name : String(err)})` });
		}
	}

	const redirects: [string, string][] = [
		[`http://${APEX}/`, `https://${APEX}/`],
		[`http://${WWW}/`, `https://${APEX}/`],
		[`https://${WWW}/`, `https://${APEX}/`],
	];
	for (const [from, to] of redirects) {
		try {
			const res = await head(from);
			const loc = res.headers.get('location') ?? '';
			const pass = res.status >= 300 && res.status < 400 && loc === to;
			out.push({
				name: `${from} -> apex`,
				status: pass ? 'pass' : 'fail',
				detail: `status=${res.status}; location=${loc || '(none)'}`,
			});
		} catch (err) {
			out.push({
				name: `${from} -> apex`,
				status: 'skip',
				detail: `fetch failed (${err instanceof Error ? err.name : String(err)})`,
			});
		}
	}
	return out;
}

function validateBrokerStream(data: unknown): string {
	if (!isRecord(data)) return 'broker payload is not an object';
	if (data.schemaVersion !== 'tinyland.blog.broker-stream.v1') return 'unexpected schemaVersion';
	if (data.sourceAuthority !== 'tinyland.dev') return 'unexpected sourceAuthority';
	if (data.contentAuthority !== 'tinyland.dev') return 'unexpected contentAuthority';
	if (data.spokeRef !== 'jesssullivan-github-io') return 'unexpected spokeRef';
	if (data.spokeTarget !== APEX) return 'unexpected spokeTarget';
	if (data.runtimeBrokerFetch !== true) return 'runtimeBrokerFetch must be true';
	if (data.publicFediverseDelivery !== false) return 'publicFediverseDelivery must be false';

	if (!isRecord(data.policy)) return 'policy is not an object';
	if (data.policy.contentTransport !== 'dynamic-broker-stream') return 'unexpected contentTransport';
	if (data.policy.contentMarkdownIncluded !== true) return 'contentMarkdownIncluded must be true';
	if (data.policy.draftContentIncluded !== false) return 'draftContentIncluded must be false';
	if (data.policy.publicFediverseDelivery !== false) return 'policy publicFediverseDelivery must be false';
	if (!hasPublicDisplayMembershipPolicy(data.policy)) return 'missing public display membership policy';

	if (!Array.isArray(data.posts)) return 'posts is not an array';
	if (data.posts.length === 0) return 'posts is empty';

	for (const [index, post] of data.posts.entries()) {
		if (!isRecord(post)) return `post ${index} is not an object`;
		if (post.type !== 'Article') return `post ${index} type is not Article`;
		if (post.publicFediverseDelivery !== false) return `post ${index} publicFediverseDelivery must be false`;
		if (typeof post.contentMarkdown !== 'string' || post.contentMarkdown.length === 0) {
			return `post ${index} contentMarkdown is empty`;
		}
		if (!isRecord(post.frontmatter)) return `post ${index} frontmatter is not an object`;
		if (typeof post.reviewStatus === 'string' && post.reviewStatus !== 'operator-reviewed-source-public') {
			return `post ${index} unexpected reviewStatus`;
		}
		const legacyReviewGate = post.reviewStatus === 'operator-reviewed-source-public';
		const displayMembershipGate =
			post.displayStatus === 'public-published-display-source' && isPublicPublishedFrontmatter(post.frontmatter);
		if (!legacyReviewGate && !displayMembershipGate) {
			return `post ${index} is not public published display content`;
		}
	}

	if (!isRecord(data.counts)) return 'counts is not an object';
	if (
		data.counts.reviewedStreamPosts !== data.posts.length &&
		data.counts.publicPublishedDisplayPosts !== data.posts.length
	) {
		return `post count mismatch: posts=${data.posts.length}`;
	}

	return '';
}

async function brokerChecks(): Promise<CheckResult[]> {
	try {
		const res = await fetch(BLOG_BROKER_STREAM_URL, {
			headers: { accept: 'application/json', 'user-agent': 'transscend-dns-guard/1.0' },
		});
		if (!res.ok) {
			return [{ name: 'Tinyland blog broker stream contract', status: 'fail', detail: `status=${res.status}` }];
		}
		const data = await res.json();
		const error = validateBrokerStream(data);
		const postCount = isRecord(data) && Array.isArray(data.posts) ? data.posts.length : 0;
		return [
			{
				name: 'Tinyland blog broker stream contract',
				status: error ? 'fail' : 'pass',
				detail: error || `posts=${postCount}`,
			},
		];
	} catch (err) {
		return [
			{
				name: 'Tinyland blog broker stream contract',
				status: 'skip',
				detail: `fetch failed (${err instanceof Error ? err.name : String(err)})`,
			},
		];
	}
}

async function runChecks(): Promise<{ checks: CheckResult[]; failures: CheckResult[]; skipped: CheckResult[] }> {
	const checks = [...(await dnsChecks()), ...(await httpChecks()), ...(await brokerChecks())];
	return {
		checks,
		failures: checks.filter((c) => c.status === 'fail'),
		skipped: checks.filter((c) => c.status === 'skip'),
	};
}

function summarize(failures: CheckResult[], skipped: CheckResult[], total: number): string {
	if (failures.length === 0 && skipped.length === 0) return `OK: ${total}/${total} passed for ${APEX}`;
	if (failures.length === 0) {
		const lines = skipped.map((f) => `  SKIP ${f.name}: ${f.detail}`);
		return `DNS GUARD DEGRADED for ${APEX} — ${skipped.length} skipped check(s):\n${lines.join('\n')}`;
	}
	const lines = failures.map((f) => `  FAIL ${f.name}: ${f.detail}`);
	return (
		`DNS GUARD FAILED for ${APEX} — ${failures.length} problem(s):\n${lines.join('\n')}\n\n` +
		`Apex A/AAAA live out of band in the DreamHost zone; add the missing records under the BARE apex owner.`
	);
}

async function reportHealthchecks(env: Env, failed: boolean, summary: string): Promise<void> {
	if (!env.HEALTHCHECK_URL) return;
	const base = env.HEALTHCHECK_URL.replace(/\/$/, '');
	await fetch(failed ? `${base}/fail` : base, { method: 'POST', body: summary }).catch(() => {});
}

// Failure-only push to the tinyland-reachable ntfy topic. No per-cron OK spam: a stateless
// Worker can't detect recovery transitions without a KV binding, so we page on failure only.
async function notifyNtfy(env: Env, failed: boolean, summary: string): Promise<void> {
	if (!env.NTFY_TOPIC_URL || !failed) return;
	const headers: Record<string, string> = {
		Title: 'transscendsurvival.org DNS guard FAILED',
		Priority: '5',
		Tags: 'rotating_light,dns',
	};
	if (env.NTFY_TOKEN) headers.Authorization = `Bearer ${env.NTFY_TOKEN}`;
	await fetch(env.NTFY_TOPIC_URL, { method: 'POST', headers, body: summary }).catch(() => {});
}

async function report(env: Env, failed: boolean, summary: string): Promise<void> {
	await Promise.all([reportHealthchecks(env, failed, summary), notifyNtfy(env, failed, summary)]);
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const { checks, failures, skipped } = await runChecks();
		const summary = summarize(failures, skipped, checks.length);
		const failed = failures.length > 0 || skipped.length > 0;
		ctx.waitUntil(report(env, failed, summary));
		if (failed) console.error(summary);
		else console.log(summary);
	},

	// On-demand verdict. /badge -> shields.io endpoint JSON (README uptime badge).
	// / (default) -> full JSON, 503 when records are wrong so StatusCake / UptimeRobot
	// can monitor THIS endpoint and inherit the whole multi-resolver check.
	async fetch(req: Request, _env: Env): Promise<Response> {
		const path = new URL(req.url).pathname;
		const { checks, failures, skipped } = await runChecks();
		const healthy = failures.length === 0 && skipped.length === 0;
		const degraded = failures.length === 0 && skipped.length > 0;

		if (path === '/badge') {
			return Response.json(
				{
					schemaVersion: 1,
					label: 'dns guard',
					message: healthy ? 'operational' : degraded ? `${skipped.length} skipped` : `${failures.length} failing`,
					color: healthy ? 'brightgreen' : degraded ? 'yellow' : 'red',
				},
				{ headers: { 'cache-control': 'max-age=300' } },
			);
		}

		const body = { target: APEX, ok: healthy, failures: failures.length, skipped: skipped.length, checks };
		return new Response(JSON.stringify(body, null, 2), {
			status: healthy ? 200 : 503,
			headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
		});
	},
};
