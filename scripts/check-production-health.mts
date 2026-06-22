import { Resolver } from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type Check = {
	name: string;
	ok: boolean;
	detail: string;
	warn?: boolean;
};

type ResolveAttempt = { ok: true; values: string[] } | { ok: false; detail: string };
type RecordCheck = Check & { values: string[] };
type DirectTarget = {
	host: string;
	ip: string;
	url: string;
	expectedStatus: number;
	expectedLocation?: string;
};

const apex = 'transscendsurvival.org';
const www = `www.${apex}`;
const brokerStreamUrl = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';
const cutoverNsNames = ['izabella.ns.cloudflare.com', 'sullivan.ns.cloudflare.com'] as const;

// Host-agnostic resolution health. The apex is migrating from GitHub Pages anycast
// (185.199.x / 2606:50c0::) to a Cloudflare-proxied CNAME whose A/AAAA rotate, so we
// assert the records RESOLVE (non-empty, no SERVFAIL) rather than matching fixed IPs.
// "Right site" is proven by the HTTP + broker-stream checks below. A SERVFAIL or empty
// AAAA is the exact DreamHost authoritative-DNS failure that broke IPv6 visitors — these
// checks stay RED until DNS reliably serves A + AAAA + SOA over UDP and TCP/53.

const publicResolvers = [
	['Cloudflare', '1.1.1.1'],
	['Google', '8.8.8.8'],
	['Quad9', '9.9.9.9'],
	['OpenDNS', '208.67.222.222'],
] as const;

function format(values: string[]) {
	return values.length > 0 ? values.sort().join(', ') : '(none)';
}

async function resolveRecords(server: string, name: string, family: 4 | 6) {
	const resolver = new Resolver();
	resolver.setServers([server]);

	try {
		return family === 4 ? await resolver.resolve4(name) : await resolver.resolve6(name);
	} catch (error) {
		const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
		if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
		throw error;
	}
}

async function tryResolveRecords(server: string, name: string, family: 4 | 6): Promise<ResolveAttempt> {
	try {
		return { ok: true, values: await resolveRecords(server, name, family) };
	} catch (error) {
		const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, detail: `${code}: ${message}` };
	}
}

function resolvesCheck(name: string, values: string[]): RecordCheck {
	const ok = values.length > 0;
	return { name, ok, detail: ok ? format(values) : 'NODATA (resolved but empty)', values };
}

async function authoritativeRecordCheck(
	name: string,
	server: string,
	host: string,
	family: 4 | 6,
): Promise<RecordCheck> {
	const attempts = 5;
	const failures: string[] = [];
	let lastGood: string[] = [];

	for (let attempt = 1; attempt <= attempts; attempt++) {
		const result = await tryResolveRecords(server, host, family);
		if (!result.ok) {
			failures.push(`attempt ${attempt}: ${result.detail}`);
			continue;
		}

		if (result.values.length === 0) {
			failures.push(`attempt ${attempt}: NODATA (empty)`);
			continue;
		}

		lastGood = result.values;
	}

	return {
		name,
		ok: failures.length === 0,
		detail: failures.length === 0 ? `${attempts}/${attempts} ${format(lastGood)}` : failures.join(' | '),
		values: lastGood,
	};
}

async function publicDnsChecks(): Promise<Check[]> {
	const checks: Check[] = [];
	const targets: DirectTarget[] = [];
	const seenTargets = new Set<string>();

	for (const [label, server] of publicResolvers) {
		const apexA = await publicRecordCheck(`${label} apex A resolves`, server, apex, 4);
		checks.push(apexA);
		checks.push(await publicRecordCheck(`${label} apex AAAA resolves`, server, apex, 6));
		const wwwA = await publicRecordCheck(`${label} www A resolves`, server, www, 4);
		checks.push(wwwA);
		checks.push(await publicRecordCheck(`${label} www AAAA resolves`, server, www, 6));
		queueDirectTargets(targets, seenTargets, apex, apexA.values);
		queueDirectTargets(targets, seenTargets, www, wwwA.values);
	}

	checks.push(...(await runDirectTargetChecks(targets)));
	return checks;
}

async function publicRecordCheck(name: string, server: string, host: string, family: 4 | 6): Promise<RecordCheck> {
	const result = await tryResolveRecords(server, host, family);
	if (!result.ok) {
		return { name, ok: false, detail: result.detail, values: [] };
	}
	return resolvesCheck(name, result.values);
}

function queueDirectTargets(targets: DirectTarget[], seenTargets: Set<string>, host: string, values: string[]) {
	for (const ip of values) {
		const key = `${host}|${ip}`;
		if (seenTargets.has(key)) continue;
		seenTargets.add(key);
		targets.push(
			host === apex
				? { host, ip, url: `https://${apex}/blog`, expectedStatus: 200 }
				: {
						host,
						ip,
						url: `https://${www}/blog`,
						expectedStatus: 301,
						expectedLocation: `https://${apex}/blog`,
					},
		);
	}
}

async function runDirectTargetChecks(targets: DirectTarget[]): Promise<Check[]> {
	const checks: Check[] = [];
	for (const target of targets) {
		checks.push(
			await directHttpsCheck(
				`direct HTTPS ${target.host} via ${target.ip}`,
				target.host,
				target.ip,
				target.url,
				target.expectedStatus,
				target.expectedLocation,
			),
		);
	}
	return checks;
}

async function authoritativeDnsChecks(): Promise<Check[]> {
	const bootstrap = new Resolver();
	bootstrap.setServers(['1.1.1.1']);
	const delegatedNsNames = await bootstrap.resolveNs(apex);
	const nsNames = [...new Set([...delegatedNsNames, ...cutoverNsNames])];
	const checks: Check[] = [];
	const targets: DirectTarget[] = [];
	const seenTargets = new Set<string>();

	for (const nsName of nsNames.sort()) {
		const addresses = await bootstrap.resolve4(nsName);
		const server = addresses[0];
		if (!server) {
			checks.push({ name: `authoritative ${nsName}`, ok: false, detail: 'no A record for nameserver' });
			continue;
		}

		const apexA = await authoritativeRecordCheck(`authoritative ${nsName} apex A resolves`, server, apex, 4);
		checks.push(apexA);
		checks.push(await authoritativeRecordCheck(`authoritative ${nsName} apex AAAA resolves`, server, apex, 6));
		const wwwA = await authoritativeRecordCheck(`authoritative ${nsName} www A resolves`, server, www, 4);
		checks.push(wwwA);
		checks.push(await authoritativeRecordCheck(`authoritative ${nsName} www AAAA resolves`, server, www, 6));
		checks.push(await authoritativeSoaCheck(`authoritative ${nsName} apex SOA resolves`, server));
		checks.push(await tcpDnsCheck(`authoritative ${nsName} answers over TCP/53`, server));
		queueDirectTargets(targets, seenTargets, apex, apexA.values);
		queueDirectTargets(targets, seenTargets, www, wwwA.values);
	}

	checks.push(...(await runDirectTargetChecks(targets)));
	return checks;
}

async function authoritativeSoaCheck(name: string, server: string): Promise<Check> {
	const resolver = new Resolver();
	resolver.setServers([server]);
	try {
		const soa = await resolver.resolveSoa(apex);
		return { name, ok: Boolean(soa), detail: soa ? `serial=${soa.serial}` : 'no SOA' };
	} catch (error) {
		const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
		const message = error instanceof Error ? error.message : String(error);
		return { name, ok: false, detail: `${code}: ${message}` };
	}
}

async function tcpDnsCheck(name: string, server: string): Promise<Check> {
	try {
		const { stdout } = await execFileAsync('dig', ['+tcp', '+time=3', '+tries=1', `@${server}`, apex, 'A'], {
			timeout: 8000,
		});
		const ok = /status:\s*NOERROR/.test(stdout);
		const status = stdout.match(/status:\s*\w+/)?.[0] ?? 'no answer';
		return { name, ok, detail: ok ? 'NOERROR over TCP/53' : `${status} (or TCP/53 blocked)` };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { name, ok: true, warn: true, detail: `TCP/53 unavailable: ${message}` };
	}
}

async function directHttpsCheck(
	name: string,
	host: string,
	ip: string,
	url: string,
	expectedStatus: number,
	expectedLocation?: string,
): Promise<Check> {
	try {
		const { stdout } = await execFileAsync(
			'curl',
			['-sS', '--max-time', '12', '--resolve', `${host}:443:${ip}`, '-I', '-o', '-', url],
			{ timeout: 15_000 },
		);
		const status = Number(stdout.match(/^HTTP\/\S+\s+(\d+)/m)?.[1] ?? 0);
		const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() ?? '';
		const statusOk = status === expectedStatus;
		const locationOk = expectedLocation === undefined || location === expectedLocation;
		return {
			name,
			ok: statusOk && locationOk,
			detail:
				expectedLocation === undefined ? `status=${status}` : `status=${status}; location=${location || '(none)'}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { name, ok: false, detail: `direct TLS/HTTPS failed: ${message}` };
	}
}

async function head(url: string) {
	return fetch(url, {
		method: 'HEAD',
		redirect: 'manual',
		signal: AbortSignal.timeout(15_000),
		headers: {
			'user-agent': 'transscendsurvival-production-health/1.0',
		},
	});
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

function validateBrokerStream(data: unknown): string {
	if (!isRecord(data)) return 'broker payload is not an object';
	if (data.schemaVersion !== 'tinyland.blog.broker-stream.v1') return 'unexpected schemaVersion';
	if (data.sourceAuthority !== 'tinyland.dev') return 'unexpected sourceAuthority';
	if (data.contentAuthority !== 'tinyland.dev') return 'unexpected contentAuthority';
	if (data.spokeRef !== 'jesssullivan-github-io') return 'unexpected spokeRef';
	if (data.spokeTarget !== apex) return 'unexpected spokeTarget';
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

async function brokerCheck(): Promise<Check> {
	try {
		const response = await fetch(brokerStreamUrl, {
			headers: {
				accept: 'application/json',
				'user-agent': 'transscendsurvival-production-health/1.0',
			},
		});
		if (!response.ok) {
			return {
				name: 'Tinyland blog broker stream contract',
				ok: false,
				detail: `status=${response.status}`,
			};
		}

		const data = await response.json();
		const error = validateBrokerStream(data);
		return {
			name: 'Tinyland blog broker stream contract',
			ok: error.length === 0,
			detail: error.length === 0 ? `posts=${Array.isArray(data.posts) ? data.posts.length : 0}` : error,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			name: 'Tinyland blog broker stream contract',
			ok: false,
			detail: message,
		};
	}
}

async function httpChecks(): Promise<Check[]> {
	const checks: Check[] = [];

	const livePaths = [
		['HTTPS apex returns 200', `https://${apex}/`],
		['HTTPS /blog returns 200', `https://${apex}/blog`],
		['HTTPS /blog/ returns 200', `https://${apex}/blog/`],
		['HTTPS representative post returns 200', `https://${apex}/blog/tmpui-the-merlin-sound-id-project`],
		['HTTPS representative post slash returns 200', `https://${apex}/blog/tmpui-the-merlin-sound-id-project/`],
	] as const;

	for (const [name, url] of livePaths) {
		checks.push(await httpStatusCheck(name, url, 200));
	}

	const redirectCases = [
		[`http://${apex}/`, `https://${apex}/`],
		[`http://${www}/`, `https://${apex}/`],
		[`https://${www}/`, `https://${apex}/`],
	] as const;

	for (const [from, to] of redirectCases) {
		checks.push(await redirectCheck(`${from} redirects to apex HTTPS`, from, to));
	}

	return checks;
}

async function httpStatusCheck(name: string, url: string, expectedStatus: number): Promise<Check> {
	try {
		const response = await head(url);
		return {
			name,
			ok: response.status === expectedStatus,
			detail: `status=${response.status}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			name,
			ok: false,
			detail: `fetch failed: ${message}`,
		};
	}
}

async function redirectCheck(name: string, from: string, to: string): Promise<Check> {
	try {
		const response = await head(from);
		const location = response.headers.get('location') ?? '';
		return {
			name,
			ok: response.status >= 300 && response.status < 400 && location === to,
			detail: `status=${response.status}; location=${location || '(none)'}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			name,
			ok: false,
			detail: `fetch failed: ${message}`,
		};
	}
}

const checks = [
	...(await authoritativeDnsChecks()),
	...(await publicDnsChecks()),
	...(await httpChecks()),
	await brokerCheck(),
];

let failures = 0;
for (const check of checks) {
	const marker = check.ok ? (check.warn ? 'WARN' : 'PASS') : 'FAIL';
	console.log(`${marker} ${check.name}: ${check.detail}`);
	if (!check.ok) failures++;
}

if (failures > 0) {
	console.error(`Production health failed with ${failures} failing check(s).`);
	process.exit(1);
}
