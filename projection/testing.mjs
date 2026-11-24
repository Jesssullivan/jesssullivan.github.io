/**
 * Test support for the projection step. It serves the xoxd-projection/v2
 * contract fixtures, as vendored in the xoxd_projection module's testdata,
 * through an injected fetch. Nothing here runs in a production build.
 */
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** The hub base the fixture fetch answers for. It is never a real host. */
export const FIXTURE_BASE = 'https://hub.fixtures.invalid';

/** The valid blog manifest of the fixtures and its seq. */
export const VALID_BLOG = Object.freeze({
	manifest: 'fbce3ad37f64d9aee7cecc90a2dda1d6bba77f726bb73541b031cf08997e2ee3',
	seq: 1,
});

/** The contract fixtures directory, from XOXD_PROJECTION_FIXTURES (the rootpath of cases.json). */
export function fixturesRoot(env = process.env) {
	const cases = env.XOXD_PROJECTION_FIXTURES;
	if (!cases) throw new Error('XOXD_PROJECTION_FIXTURES is not set');
	return dirname(isAbsolute(cases) ? cases : resolve(process.cwd(), cases));
}

/** The fixture key pair's public half, read from the fixtures, never from the repo pin. */
export async function fixturePublicKey(root) {
	const pair = JSON.parse(await readFile(join(root, 'TEST-ONLY-ed25519-key.json'), 'utf8'));
	return pair.publicKey;
}

function answer(status, bytes = new Uint8Array()) {
	return {
		status,
		async arrayBuffer() {
			return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		},
	};
}

/**
 * A fetch that serves <base>/projection/v2/... from the fixtures, looking in
 * the overlay of a tampered case first, and the live receipt of the origin
 * from `live` (a receipt object, a status number, or undefined for 404).
 * calls records every URL asked for.
 */
export function fixtureFetch(root, { overlay = null, live, origin = 'https://transscendsurvival.org', calls = [] } = {}) {
	return async (url) => {
		calls.push(url);
		if (url === `${origin}/.well-known/projection.json`) {
			if (live === undefined) return answer(404);
			if (typeof live === 'number') return answer(live);
			return answer(200, new TextEncoder().encode(JSON.stringify(live)));
		}
		const prefix = `${FIXTURE_BASE}/projection/v2/`;
		if (!url.startsWith(prefix)) return answer(404);
		const rel = url.slice(FIXTURE_BASE.length + 1);
		if (rel.split('/').some((segment) => segment === '' || segment.startsWith('.'))) return answer(404);
		for (const dir of [...(overlay ? [join(root, overlay)] : []), join(root, 'valid')]) {
			try {
				return answer(200, new Uint8Array(await readFile(join(dir, rel))));
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
			}
		}
		return answer(404);
	};
}
