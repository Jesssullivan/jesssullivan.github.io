import { Resolver } from 'node:dns/promises';

type Check = {
	name: string;
	ok: boolean;
	detail: string;
};

const apex = 'transscendsurvival.org';
const www = `www.${apex}`;

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

function recordCheck(name: string, actual: string[], expected: string[]): Check {
	const ok = sameSet(actual, expected);
	return {
		name,
		ok,
		detail: ok ? format(actual) : `expected ${format(expected)}; got ${format(actual)}`,
	};
}

async function publicDnsChecks(): Promise<Check[]> {
	const checks: Check[] = [];

	for (const [label, server] of publicResolvers) {
		checks.push(recordCheck(`${label} apex A`, await resolveRecords(server, apex, 4), expectedA));
		checks.push(recordCheck(`${label} apex AAAA`, await resolveRecords(server, apex, 6), expectedAAAA));
		checks.push(recordCheck(`${label} www A`, await resolveRecords(server, www, 4), expectedA));
		checks.push(recordCheck(`${label} www AAAA`, await resolveRecords(server, www, 6), expectedAAAA));
	}

	return checks;
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

		checks.push(recordCheck(`authoritative ${nsName} apex A`, await resolveRecords(server, apex, 4), expectedA));
		checks.push(recordCheck(`authoritative ${nsName} apex AAAA`, await resolveRecords(server, apex, 6), expectedAAAA));
	}

	return checks;
}

async function head(url: string) {
	return fetch(url, {
		method: 'HEAD',
		redirect: 'manual',
		headers: {
			'user-agent': 'transscendsurvival-production-health/1.0',
		},
	});
}

async function httpChecks(): Promise<Check[]> {
	const checks: Check[] = [];

	const apexHttps = await head(`https://${apex}/`);
	checks.push({
		name: 'HTTPS apex returns 200',
		ok: apexHttps.status === 200,
		detail: `status=${apexHttps.status}`,
	});

	const redirectCases = [
		[`http://${apex}/`, `https://${apex}/`],
		[`http://${www}/`, `https://${apex}/`],
		[`https://${www}/`, `https://${apex}/`],
	] as const;

	for (const [from, to] of redirectCases) {
		const response = await head(from);
		const location = response.headers.get('location') ?? '';
		checks.push({
			name: `${from} redirects to apex HTTPS`,
			ok: response.status >= 300 && response.status < 400 && location === to,
			detail: `status=${response.status}; location=${location || '(none)'}`,
		});
	}

	return checks;
}

const checks = [...(await authoritativeDnsChecks()), ...(await publicDnsChecks()), ...(await httpChecks())];

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
