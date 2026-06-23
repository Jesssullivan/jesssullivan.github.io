import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runCredentialHelper } from './gf-reapi-bazel-credential-helper.mjs';

function jwt(exp: number): string {
	const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
	return ['eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9', payload, 'signature'].join('.');
}

async function runHelper({
	input = '{"uri":"grpc://gf-reapi-cell.gf-rbe.svc.cluster.local:8980"}',
	env = {},
	now = new Date('2026-06-23T08:00:00Z'),
	exists = () => false,
	readFile = () => {
		throw new Error('unexpected readFile');
	},
}: {
	input?: string;
	env?: Record<string, string>;
	now?: Date;
	exists?: (path: string) => boolean;
	readFile?: (path: string, encoding: BufferEncoding) => string;
} = {}) {
	let stdout = '';
	let stderr = '';
	const stdoutStream = new Writable({
		write(chunk, _encoding, callback) {
			stdout += chunk.toString();
			callback();
		},
	});
	const stderrStream = new Writable({
		write(chunk, _encoding, callback) {
			stderr += chunk.toString();
			callback();
		},
	});

	const code = await runCredentialHelper({
		argv: ['get'],
		stdin: Readable.from([input]),
		stdout: stdoutStream,
		stderr: stderrStream,
		env,
		now,
		exists,
		readFile,
	});

	return { code, stdout, stderr };
}

describe('gf-reapi Bazel credential helper', () => {
	it('returns an Authorization header from an inline JWT', async () => {
		const token = jwt(Date.parse('2026-06-23T08:10:00Z') / 1000);
		const result = await runHelper({
			env: { GF_REAPI_CREDENTIAL_HELPER_TOKEN: token },
		});

		expect(result.code).toBe(0);
		expect(result.stderr).toBe('');
		expect(JSON.parse(result.stdout)).toEqual({
			headers: {
				Authorization: [`Bearer ${token}`],
			},
			expires: '2026-06-23T08:09:00.000Z',
		});
	});

	it('uses the default projected token file when present', async () => {
		const token = jwt(Date.parse('2026-06-23T08:10:00Z') / 1000);
		const result = await runHelper({
			exists: (path) => path === '/var/run/secrets/tokens/gf-reapi-cell-token',
			readFile: () => `${token}\n`,
		});

		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout).headers.Authorization).toEqual([`Bearer ${token}`]);
	});

	it('fails before Bazel runs when no token source is attached', async () => {
		const result = await runHelper();

		expect(result.code).toBe(1);
		expect(result.stdout).toBe('');
		expect(result.stderr).toContain('missing gf-reapi-cell JWT');
	});

	it('rejects ambiguous token sources', async () => {
		const token = jwt(Date.parse('2026-06-23T08:10:00Z') / 1000);
		const result = await runHelper({
			env: {
				GF_REAPI_CREDENTIAL_HELPER_TOKEN: token,
				GF_REAPI_CREDENTIAL_HELPER_TOKEN_FILE: '/tmp/token.jwt',
			},
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('not both');
		expect(result.stderr).not.toContain(token);
	});

	it('rejects JWTs inside the helper safety window', async () => {
		const token = jwt(Date.parse('2026-06-23T08:00:30Z') / 1000);
		const result = await runHelper({
			env: { GF_REAPI_CREDENTIAL_HELPER_TOKEN: token },
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('safety window');
		expect(result.stderr).not.toContain(token);
	});

	it('rejects malformed Bazel helper requests', async () => {
		const token = jwt(Date.parse('2026-06-23T08:10:00Z') / 1000);
		const result = await runHelper({
			input: '{"uri":"gf-reapi-cell"}',
			env: { GF_REAPI_CREDENTIAL_HELPER_TOKEN: token },
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain('invalid Bazel credential helper request');
	});
});
