#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_TOKEN_FILE = '/var/run/secrets/tokens/gf-reapi-cell-token';
const TOKEN_SAFETY_SECONDS = 60;

export async function runCredentialHelper({
	argv = process.argv.slice(2),
	stdin = process.stdin,
	stdout = process.stdout,
	stderr = process.stderr,
	env = process.env,
	now = new Date(),
	exists = existsSync,
	readFile = readFileSync,
} = {}) {
	if (argv.length !== 1 || argv[0] !== 'get') {
		stderr.write('usage: gf-reapi-bazel-credential-helper.mjs get < request.json\n');
		return 2;
	}

	let request;
	try {
		request = JSON.parse(await readAll(stdin));
		validateRequestUri(request.uri);
	} catch (error) {
		stderr.write(`ERROR: invalid Bazel credential helper request: ${error.message}\n`);
		return 1;
	}

	let token;
	try {
		token = loadToken({ env, exists, readFile });
	} catch (error) {
		stderr.write(`ERROR: ${error.message}\n`);
		return 1;
	}

	let expires;
	try {
		expires = tokenCacheExpiry(token, now);
	} catch (error) {
		stderr.write(`ERROR: ${error.message}\n`);
		return 1;
	}

	stdout.write(
		`${JSON.stringify({
			headers: {
				Authorization: [`Bearer ${token}`],
			},
			expires: expires.toISOString(),
		})}\n`,
	);
	return 0;
}

function readAll(stream) {
	return new Promise((resolve, reject) => {
		let data = '';
		stream.setEncoding('utf8');
		stream.on('data', (chunk) => {
			data += chunk;
		});
		stream.on('end', () => resolve(data));
		stream.on('error', reject);
	});
}

function validateRequestUri(rawUri) {
	if (typeof rawUri !== 'string' || rawUri.trim() === '') {
		throw new Error('uri is required');
	}

	const parsed = new URL(rawUri);
	if (!parsed.protocol || !parsed.hostname) {
		throw new Error(`uri ${JSON.stringify(rawUri)} must include scheme and host`);
	}
}

function loadToken({ env, exists, readFile }) {
	const tokenFile = (env.GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE ?? '').trim();
	const inlineToken = (env.GF_REAPI_CREDENTIAL_HELPER_TOKEN ?? '').trim();

	if (tokenFile && inlineToken) {
		throw new Error('set either GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE or GF_REAPI_CREDENTIAL_HELPER_TOKEN, not both');
	}

	if (tokenFile) {
		return readTokenFile(tokenFile, readFile);
	}

	if (inlineToken) {
		return inlineToken;
	}

	if (exists(DEFAULT_TOKEN_FILE)) {
		return readTokenFile(DEFAULT_TOKEN_FILE, readFile);
	}

	throw new Error(
		'missing gf-reapi-cell JWT: set GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE or GF_REAPI_CREDENTIAL_HELPER_TOKEN',
	);
}

function readTokenFile(tokenFile, readFile) {
	const token = String(readFile(tokenFile, 'utf8')).trim();
	if (!token) {
		throw new Error('GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE is empty');
	}
	return token;
}

function tokenCacheExpiry(token, now) {
	const parts = token.split('.');
	if (parts.length < 2) {
		throw new Error('gf-reapi-cell credential helper requires a JWT bearer token with an exp claim');
	}

	let payload;
	try {
		payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
	} catch (error) {
		throw new Error(`decode JWT payload: ${error.message}`);
	}

	if (!Number.isInteger(payload.exp)) {
		throw new Error('JWT exp claim must be an integer Unix timestamp');
	}

	const cacheUntil = new Date((payload.exp - TOKEN_SAFETY_SECONDS) * 1000);
	if (cacheUntil <= now) {
		throw new Error('JWT expires before the credential-helper safety window');
	}
	return cacheUntil;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await runCredentialHelper();
}
