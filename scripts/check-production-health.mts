import { Resolver } from 'node:dns/promises';

type Check = {
	name: string;
	ok: boolean;
	detail: string;
};

type ResolveAttempt = { ok: true; values: string[] } | { ok: false; detail: string };

const apex = 'transscendsurvival.org';
const www = `www.${apex}`;
const brokerStreamUrl = 'https://hub.tinyland.dev/projections/jesssullivan-github-io/blog/broker-stream.v1.json';

const expectedA = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];

const expectedAAAA = ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'];

const publicResolvers = [
	['Cloudflare', '1.1.1.1'],
	['Google', '8.8.8.8'],
	['Quad9', '9.9.9.9'],
	['OpenDNS', '208.67.222.222'],
] as const;

function normalizeAddress(value: string) {
	return value.toLowerCase();
}

function sameSet(actual: string[], expected: string[]) {
	const actualSet = new Set(actual.map(normalizeAddress));
	return expected.every((value) => actualSet.has(normalizeAddress(value)));
}

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

function recordCheck(name: string, actual: string[], expected: string[]): Check {
	const ok = sameSet(actual, expected);
	return {
		name,
		ok,
		detail: ok ? format(actual) : `expected ${format(expected)}; got ${format(actual)}`,
	};
}

async function authoritativeRecordCheck(
	name: string,
	server: string,
	host: string,
	family: 4 | 6,
	expected: string[],
): Promise<Check> {
	const attempts = 5;
	const failures: string[] = [];
	let lastGood: string[] = [];

	for (let attempt = 1; attempt <= attempts; attempt++) {
		const result = await tryResolveRecords(server, host, family);
		if (!result.ok) {
			failures.push(`attempt ${attempt}: ${result.detail}`);
			continue;
		}

		if (!sameSet(result.values, expected)) {
			failures.push(`attempt ${attempt}: expected ${format(expected)}; got ${format(result.values)}`);
			continue;
		}

		lastGood = result.values;
	}

	return {
		name,
		ok: failures.length === 0,
		detail: failures.length === 0 ? `${attempts}/${attempts} ${format(lastGood)}` : failures.join(' | '),
	};
}

async function publicDnsChecks(): Promise<Check[]> {
	const checks: Check[] = [];

	for (const [label, server] of publicResolvers) {
		checks.push(await publicRecordCheck(`${label} apex A`, server, apex, 4, expectedA));
		checks.push(await publicRecordCheck(`${label} apex AAAA`, server, apex, 6, expectedAAAA));
		checks.push(await publicRecordCheck(`${label} www A`, server, www, 4, expectedA));
		checks.push(await publicRecordCheck(`${label} www AAAA`, server, www, 6, expectedAAAA));
	}

	return checks;
}

async function publicRecordCheck(
	name: string,
	server: string,
	host: string,
	family: 4 | 6,
	expected: string[],
): Promise<Check> {
	const result = await tryResolveRecords(server, host, family);
	if (!result.ok) {
		return { name, ok: false, detail: result.detail };
	}
	return recordCheck(name, result.values, expected);
}

async function authoritativeDnsChecks(): Promise<Check[]> {
	const bootstrap = new Resolver();
	bootstrap.setServers(['1.1.1.1']);
	const nsNames = await bootstrap.resolveNs(apex);
	const checks: Check[] = [];

	for (const nsName of nsNames.sort()) {
		const addresses = await bootstrap.resolve4(nsName);
		const server = addresses[0];
		if (!server) {
			checks.push({ name: `authoritative ${nsName}`, ok: false, detail: 'no A record for nameserver' });
			continue;
		}

		checks.push(await authoritativeRecordCheck(`authoritative ${nsName} apex A`, server, apex, 4, expectedA));
		checks.push(await authoritativeRecordCheck(`authoritative ${nsName} apex AAAA`, server, apex, 6, expectedAAAA));
	}

	return checks;
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
	const marker = check.ok ? 'PASS' : 'FAIL';
	console.log(`${marker} ${check.name}: ${check.detail}`);
	if (!check.ok) failures++;
}

if (failures > 0) {
	console.error(`Production health failed with ${failures} failing check(s).`);
	process.exit(1);
}
