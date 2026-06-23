import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// READ-ONLY Cloudflare DNS drift detector for transscendsurvival.org.
//
// This script ONLY reads. It GETs the live zone records from the Cloudflare API
// and compares them to the declared desired state in infra/cloudflare/zone.json.
// It NEVER creates, updates, or deletes anything: the only Cloudflare HTTP verb it
// issues is GET. There is intentionally no apply path here — mutation stays manual.
//
// It fails loudly (non-zero exit) on ANY of:
//   - apex/www proxy posture drift. The posture is set by invariants in zone.json:
//       * apex_must_be_proxied=true (CURRENT, post-2026-06-23 CF Pages cut): the apex MUST be a
//         proxied CNAME to apex_cname_target. A grey/un-proxied apex means the cut regressed.
//       * apex_must_be_proxied=false (legacy GitHub Pages posture): NO apex record may be proxied
//         — an apex re-proxy before Pages was active was the exact 2026-06-22 outage cause.
//       * www_must_be_proxied=true means www is also a Pages hostname and MUST be a proxied CNAME.
//   - the apex drifting away from its declared type(s), or www drifting away from CNAME/target.
//   - any declared record missing live, or any undeclared record present live.
//   - DNSSEC not active (pending while a registrar DS transition is underway is a WARN, not a failure).
//
// Auth: reads CLOUDFLARE_API_TOKEN from the environment (never printed). A read-only
// token is sufficient and preferred. Optionally honors CLOUDFLARE_ZONE_ID to override
// the zone id from zone.json (the API is still queried read-only).

type Check = {
	name: string;
	ok: boolean;
	detail: string;
	warn?: boolean;
};

type DesiredRecord = {
	type: string;
	name: string;
	content: string;
	proxied: boolean;
	ttl: number;
};

type DesiredZone = {
	zone: string;
	zone_id: string;
	dnssec: string;
	invariants?: {
		apex_must_be_dns_only?: boolean;
		apex_must_be_proxied?: boolean;
		apex_record_types?: string[];
		apex_cname_target?: string;
		www_must_be_proxied?: boolean;
		www_record_type?: string;
		www_cname_target?: string;
	};
	records: DesiredRecord[];
};

type LiveRecord = {
	id: string;
	type: string;
	name: string;
	content: string;
	proxied: boolean;
	ttl: number;
};

const API_BASE = 'https://api.cloudflare.com/client/v4';
const ZONE_FILE = fileURLToPath(new URL('../infra/cloudflare/zone.json', import.meta.url));

// Record types that can carry Cloudflare's proxied (orange-cloud) flag at all.
const PROXYABLE_TYPES = new Set(['A', 'AAAA', 'CNAME']);
// The record types we manage in zone.json and therefore reconcile. Other live types
// (e.g. operator-managed TXT/MX/CAA) are reported as informational, never as drift.
const MANAGED_TYPES = new Set(['A', 'AAAA', 'CNAME']);

function fail(message: string): never {
	console.error(`cf-dns-check: ${message}`);
	process.exit(1);
}

async function loadDesiredZone(): Promise<DesiredZone> {
	let raw: string;
	try {
		raw = await readFile(ZONE_FILE, 'utf8');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`could not read ${ZONE_FILE}: ${message}`);
	}
	try {
		return JSON.parse(raw) as DesiredZone;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`could not parse ${ZONE_FILE}: ${message}`);
	}
}

async function cfGet(path: string, token: string): Promise<unknown> {
	const response = await fetch(`${API_BASE}${path}`, {
		method: 'GET',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'user-agent': 'transscendsurvival-cf-dns-check/1.0',
		},
		signal: AbortSignal.timeout(20_000),
	});

	const body = (await response.json().catch(() => null)) as {
		success?: boolean;
		errors?: Array<{ message?: string }>;
		result?: unknown;
	} | null;

	if (!response.ok || !body || body.success !== true) {
		const apiErrors = body?.errors?.map((entry) => entry?.message).filter(Boolean) ?? [];
		const detail = apiErrors.length > 0 ? apiErrors.join('; ') : `HTTP ${response.status}`;
		fail(`Cloudflare API GET ${path} failed: ${detail}`);
	}

	return body.result;
}

async function listLiveRecords(zoneId: string, token: string): Promise<LiveRecord[]> {
	const records: LiveRecord[] = [];
	let page = 1;
	// Paginate defensively; the zone is small but we never assume one page.
	for (;;) {
		const result = await cfGet(`/zones/${zoneId}/dns_records?per_page=100&page=${page}`, token);
		if (!Array.isArray(result)) fail(`unexpected dns_records payload on page ${page}`);
		for (const entry of result as Array<Record<string, unknown>>) {
			records.push({
				id: String(entry.id ?? ''),
				type: String(entry.type ?? ''),
				name: String(entry.name ?? ''),
				content: String(entry.content ?? ''),
				proxied: entry.proxied === true,
				ttl: typeof entry.ttl === 'number' ? entry.ttl : Number(entry.ttl ?? 0),
			});
		}
		if (result.length < 100) break;
		page += 1;
	}
	return records;
}

async function getDnssecStatus(zoneId: string, token: string): Promise<string> {
	const result = (await cfGet(`/zones/${zoneId}/dnssec`, token)) as { status?: unknown } | null;
	return result && typeof result.status === 'string' ? result.status : 'unknown';
}

function recordKey(record: { type: string; name: string; content: string }): string {
	// Cloudflare lowercases names; content for CNAME/AAAA is also case-insensitive.
	return `${record.type.toUpperCase()}|${record.name.toLowerCase()}|${record.content.toLowerCase()}`;
}

function isApex(apex: string, name: string): boolean {
	return name.toLowerCase() === apex.toLowerCase();
}

function buildChecks(desired: DesiredZone, live: LiveRecord[], dnssecStatus: string): Check[] {
	const checks: Check[] = [];
	const apex = desired.zone;
	const apexTypes = new Set((desired.invariants?.apex_record_types ?? ['A', 'AAAA']).map((t) => t.toUpperCase()));
	const wwwType = (desired.invariants?.www_record_type ?? 'CNAME').toUpperCase();
	const wwwName = `www.${apex}`.toLowerCase();

	const managedLive = live.filter((record) => MANAGED_TYPES.has(record.type.toUpperCase()));

	// --- Invariant 1: apex proxy posture (the outage guard, posture-aware). ---
	const apexMustBeProxied = desired.invariants?.apex_must_be_proxied === true;
	const apexCnameTarget = desired.invariants?.apex_cname_target;
	const wwwMustBeProxied = desired.invariants?.www_must_be_proxied === true;
	const wwwCnameTarget = desired.invariants?.www_cname_target;
	const apexProxyRecs = managedLive.filter((record) => isApex(apex, record.name));
	const proxiedApex = apexProxyRecs.filter((record) => record.proxied);
	if (apexMustBeProxied) {
		// Post-cut posture (Cloudflare Pages): the apex MUST be proxied (orange-cloud) so the CF
		// Pages edge serves it. A grey/un-proxied apex here means the cut regressed. The
		// 2026-06-22 outage was proxying BEFORE Pages was active; this posture is declared only
		// once the Pages custom domain is ACTIVE, so proxied is the safe, required state.
		const unproxiedApex = apexProxyRecs.filter((record) => !record.proxied);
		checks.push({
			name: 'apex is proxied to CF Pages (orange-cloud)',
			ok: apexProxyRecs.length > 0 && unproxiedApex.length === 0,
			detail:
				apexProxyRecs.length === 0
					? 'no apex record found live'
					: unproxiedApex.length === 0
						? `apex proxied -> ${apexProxyRecs.map((r) => r.content).join(', ')}`
						: `apex NOT proxied: ${unproxiedApex.map((r) => `${r.type} ${r.content}`).join(', ')} — CF Pages cut regressed to grey-cloud`,
		});
		if (apexCnameTarget) {
			const apexCnames = apexProxyRecs.filter((record) => record.type.toUpperCase() === 'CNAME');
			const targetOk =
				apexCnames.length > 0 &&
				apexCnames.every((record) => record.content.toLowerCase() === apexCnameTarget.toLowerCase());
			checks.push({
				name: `apex CNAME -> ${apexCnameTarget}`,
				ok: targetOk,
				detail:
					apexCnames.length === 0
						? 'no apex CNAME found live'
						: targetOk
							? `apex -> ${apexCnameTarget}`
							: `apex CNAME target drift: live ${apexCnames.map((r) => r.content).join(', ')}`,
			});
		}
	} else {
		// Pre-cut posture (GitHub Pages): NO apex record may be proxied. An apex re-proxy to the
		// orange-cloud edge before an origin was ready was the 2026-06-22 outage cause.
		checks.push({
			name: 'apex is DNS-only (no proxied apex record)',
			ok: proxiedApex.length === 0,
			detail:
				proxiedApex.length === 0
					? 'all apex records grey-cloud (proxied=false)'
					: `PROXIED apex record(s): ${proxiedApex.map((r) => `${r.type} ${r.content}`).join(', ')} — re-proxy was the 2026-06-22 outage cause`,
		});
	}

	// --- Invariant 2: no UNEXPECTED proxied record. In the Pages posture apex and
	//     optionally www may be proxied; in the GitHub posture nothing managed may be. ---
	const proxiedAny = managedLive.filter((record) => record.proxied);
	const allowedProxiedNames = new Set<string>();
	if (apexMustBeProxied) allowedProxiedNames.add(apex.toLowerCase());
	if (wwwMustBeProxied) allowedProxiedNames.add(wwwName);
	const unexpectedProxied = proxiedAny.filter((record) => !allowedProxiedNames.has(record.name.toLowerCase()));
	checks.push({
		name:
			allowedProxiedNames.size > 0
				? `only declared Pages hostnames are proxied (${[...allowedProxiedNames].sort().join(', ')})`
				: 'no managed record is proxied (grey-cloud only)',
		ok: unexpectedProxied.length === 0,
		detail:
			unexpectedProxied.length === 0
				? allowedProxiedNames.size > 0
					? `proxied records are limited to ${[...allowedProxiedNames].sort().join(', ')}`
					: 'A/AAAA/CNAME all proxied=false'
				: `unexpected proxied=true on: ${unexpectedProxied.map((record) => `${record.type} ${record.name}`).join(', ')}`,
	});

	// --- Invariant 3: apex stays on its declared type set. ---
	const apexLive = managedLive.filter((record) => isApex(apex, record.name));
	const apexTypeViolations = apexLive.filter((record) => !apexTypes.has(record.type.toUpperCase()));
	checks.push({
		name: `apex is ${[...apexTypes].sort().join('/')} only`,
		ok: apexLive.length > 0 && apexTypeViolations.length === 0,
		detail:
			apexLive.length === 0
				? `no apex ${[...apexTypes].sort().join('/')} records found live`
				: apexTypeViolations.length === 0
					? `${apexLive.length} apex record(s), all ${[...apexTypes].sort().join('/')}`
					: `unexpected apex type(s): ${apexTypeViolations.map((r) => r.type).join(', ')}`,
	});

	// --- Invariant 4: www stays a CNAME (www as A/AAAA breaks the TLS cert handshake). ---
	const wwwLive = managedLive.filter((record) => record.name.toLowerCase() === wwwName);
	const wwwTypeOk = wwwLive.length > 0 && wwwLive.every((record) => record.type.toUpperCase() === wwwType);
	checks.push({
		name: `www is a ${wwwType}`,
		ok: wwwTypeOk,
		detail:
			wwwLive.length === 0
				? 'no www record found live'
				: wwwTypeOk
					? `www ${wwwType} -> ${wwwLive.map((r) => r.content).join(', ')}`
					: `www has non-${wwwType} type(s): ${wwwLive.map((r) => r.type).join(', ')} (www as A/AAAA breaks TLS)`,
	});
	if (wwwMustBeProxied) {
		const unproxiedWww = wwwLive.filter((record) => !record.proxied);
		checks.push({
			name: 'www is proxied to CF Pages (orange-cloud)',
			ok: wwwLive.length > 0 && unproxiedWww.length === 0,
			detail:
				wwwLive.length === 0
					? 'no www record found live'
					: unproxiedWww.length === 0
						? `www proxied -> ${wwwLive.map((r) => r.content).join(', ')}`
						: `www NOT proxied: ${unproxiedWww.map((r) => `${r.type} ${r.content}`).join(', ')}`,
		});
	}
	if (wwwCnameTarget) {
		const wwwCnames = wwwLive.filter((record) => record.type.toUpperCase() === 'CNAME');
		const targetOk =
			wwwCnames.length > 0 &&
			wwwCnames.every((record) => record.content.toLowerCase() === wwwCnameTarget.toLowerCase());
		checks.push({
			name: `www CNAME -> ${wwwCnameTarget}`,
			ok: targetOk,
			detail:
				wwwCnames.length === 0
					? 'no www CNAME found live'
					: targetOk
						? `www -> ${wwwCnameTarget}`
						: `www CNAME target drift: live ${wwwCnames.map((r) => r.content).join(', ')}`,
		});
	}

	// --- Record-by-record reconciliation (declared vs live, managed types only). ---
	const desiredByKey = new Map(desired.records.map((record) => [recordKey(record), record]));
	const liveByKey = new Map(managedLive.map((record) => [recordKey(record), record]));

	for (const [key, want] of desiredByKey) {
		const got = liveByKey.get(key);
		if (!got) {
			checks.push({
				name: `declared ${want.type} ${want.name} -> ${want.content}`,
				ok: false,
				detail: 'MISSING live (declared in zone.json but not present in Cloudflare)',
			});
			continue;
		}
		const proxiedOk = got.proxied === want.proxied;
		checks.push({
			name: `declared ${want.type} ${want.name} -> ${want.content}`,
			ok: proxiedOk,
			detail: proxiedOk
				? `present; proxied=${got.proxied}`
				: `proxied drift: want ${want.proxied}, live ${got.proxied}`,
		});
	}

	for (const [key, got] of liveByKey) {
		if (desiredByKey.has(key)) continue;
		checks.push({
			name: `undeclared ${got.type} ${got.name} -> ${got.content}`,
			ok: false,
			detail: 'PRESENT live but not declared in zone.json (unexpected record)',
		});
	}

	// --- Informational: unmanaged live record types (never counted as drift). ---
	const unmanaged = live.filter((record) => !MANAGED_TYPES.has(record.type.toUpperCase()));
	if (unmanaged.length > 0) {
		const summary = unmanaged.map((r) => `${r.type} ${r.name}`).join(', ');
		checks.push({
			name: 'unmanaged record types present (informational)',
			ok: true,
			warn: true,
			detail: `not reconciled by zone.json: ${summary}`,
		});
	}

	// --- DNSSEC: active = PASS, pending = WARN (zone signed, awaiting registrar DS),
	//     anything else (e.g. disabled) = FAIL (a real regression). ---
	const dnssecLive = dnssecStatus.toLowerCase();
	const dnssecWant = desired.dnssec.toLowerCase();
	const dnssecPending = dnssecWant === 'active' && dnssecLive === 'pending';
	checks.push({
		name: `dnssec is ${desired.dnssec}`,
		ok: dnssecLive === dnssecWant || dnssecPending,
		warn: dnssecPending,
		detail: dnssecPending
			? 'live status=pending — zone signed; awaiting parent DS publication'
			: `live status=${dnssecStatus}`,
	});

	return checks;
}

async function main(): Promise<void> {
	const token = process.env.CLOUDFLARE_API_TOKEN;
	if (!token) fail('CLOUDFLARE_API_TOKEN is not set (a read-only DNS token is sufficient)');

	const desired = await loadDesiredZone();
	const zoneId = process.env.CLOUDFLARE_ZONE_ID || desired.zone_id;
	if (!zoneId) fail('no zone id (set CLOUDFLARE_ZONE_ID or zone_id in zone.json)');

	const live = await listLiveRecords(zoneId, token);
	const dnssecStatus = await getDnssecStatus(zoneId, token);
	const checks = buildChecks(desired, live, dnssecStatus);

	console.log(`Cloudflare DNS drift check for ${desired.zone} (zone ${zoneId})`);
	let failures = 0;
	for (const check of checks) {
		const marker = check.ok ? (check.warn ? 'WARN' : 'PASS') : 'FAIL';
		console.log(`${marker} ${check.name}: ${check.detail}`);
		if (!check.ok) failures++;
	}

	if (failures > 0) {
		console.error(
			`Cloudflare DNS drift detected: ${failures} failing check(s). This script does not mutate; reconcile manually.`,
		);
		process.exit(1);
	}
	console.log('No Cloudflare DNS drift: live zone matches infra/cloudflare/zone.json.');
}

await main();
