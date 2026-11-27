/**
 * Test support for the projection step. It serves the xoxd-projection/v3
 * contract fixtures, as the xoxd_projection module ships them in its
 * testdata, from an HTTP server on a loopback address. The module's fetcher
 * reads that server only when a test passes allowLoopbackHttpForTests.
 * Nothing here runs in a production build.
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { FIXTURE_KEY } from './step.mjs';

/** The contract every fixture is signed under. */
export const FIXTURE_CONTRACT = 'xoxd-projection/v3';

/** The valid blog manifest of the fixtures and its seq. */
export const VALID_BLOG = Object.freeze({
	manifest: 'fcd2527570c858ebba8cec820b5349152507cce72c344e65a205c5c0fa97f80e',
	seq: 1,
});

/** The valid firm manifest of the fixtures and its seq. */
export const VALID_FIRM = Object.freeze({
	manifest: '8aba1c72410535298e994b432ecb537745b0fe43219dfb997eed1ceee01cd0ed',
	seq: 1,
});

/** The contract fixtures directory, from XOXD_PROJECTION_FIXTURES (the path of cases.json). */
export function fixturesRoot(env = process.env) {
	const cases = env.XOXD_PROJECTION_FIXTURES;
	if (!cases) throw new Error('XOXD_PROJECTION_FIXTURES is not set');
	return dirname(isAbsolute(cases) ? cases : resolve(process.cwd(), cases));
}

/**
 * The public half of the contract's test key pair, never the repo pin. The
 * released module leaves out the pair's file, which also holds the private
 * half, so this is FIXTURE_KEY from step.mjs. The valid fixtures verify only
 * against it, and step.test.mjs checks the module's own copy of it.
 */
export function fixturePublicKey() {
	return FIXTURE_KEY;
}

/** The fetch the step runs in production: no redirect is followed. */
export const noRedirectFetch = (url) => globalThis.fetch(url, { redirect: 'error' });

/**
 * Starts a server on 127.0.0.1 that plays the hub and the live site at once.
 * It serves /projection/v3/... from the fixtures, looking in the overlay of a
 * tampered case first, and /.well-known/projection.json from `live`: a
 * receipt object, a status number, or undefined for 404. calls records every
 * path asked for. close stops it.
 */
export async function startFixtureHub(root, { overlay = null, live } = {}) {
	const calls = [];
	const server = createServer((request, response) => {
		const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
		calls.push(path);
		answer(root, overlay, live, request.method ?? 'GET', path).then(
			({ status, body }) => {
				response.writeHead(status, { 'Content-Length': body.byteLength, 'Cache-Control': 'no-store' });
				response.end(body);
			},
			() => {
				response.writeHead(500);
				response.end();
			},
		);
	});
	await new Promise((ready, failed) => {
		server.once('error', failed);
		server.listen(0, '127.0.0.1', ready);
	});
	const base = `http://127.0.0.1:${server.address().port}`;
	return {
		/** The origin of the hub and of the live site, with no trailing slash. */
		base,
		calls,
		async close() {
			server.closeAllConnections();
			await new Promise((done) => server.close(done));
		},
	};
}

const EMPTY = new Uint8Array();

async function answer(root, overlay, live, method, path) {
	if (method !== 'GET') return { status: 405, body: EMPTY };
	if (path === '/.well-known/projection.json') {
		if (live === undefined) return { status: 404, body: EMPTY };
		if (typeof live === 'number') return { status: live, body: EMPTY };
		return { status: 200, body: new TextEncoder().encode(JSON.stringify(live)) };
	}
	if (!path.startsWith('/projection/v3/')) return { status: 404, body: EMPTY };
	const segments = path.slice(1).split('/');
	if (segments.some((segment) => segment === '' || segment.startsWith('.'))) return { status: 404, body: EMPTY };
	for (const dir of [...(overlay ? [join(root, overlay)] : []), join(root, 'valid')]) {
		try {
			return { status: 200, body: new Uint8Array(await readFile(join(dir, ...segments))) };
		} catch (error) {
			if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
		}
	}
	return { status: 404, body: EMPTY };
}

/**
 * The step's configuration for a test: the loopback server is the hub base,
 * the recovery base and the live site. It is built here, not parsed, since
 * parseConfig takes https origins only.
 */
export function fixtureConfig(base, overrides = {}) {
	return Object.freeze({
		target: 'blog',
		origin: base,
		publicKeyFile: 'hub-ed25519.pub',
		outDir: 'src/lib/projection-data',
		allowedBases: [base],
		recoveryBase: base,
		...overrides,
	});
}
