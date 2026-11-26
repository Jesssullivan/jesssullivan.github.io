import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// TIN-8867: the browser suite's static server keeps an idle keep-alive connection open.
// Playwright's route.fetch reuses its sockets with no idle limit. A server that closes an idle
// socket races with that reuse, and on a busy runner the request fails with "socket hang up".

const script = join(process.cwd(), 'scripts', 'serve-static-build.mjs');
let root = '';
let server: ChildProcessWithoutNullStreams;
let port = 0;

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), 'tin-8867-serve-static-'));
	writeFileSync(join(root, 'index.html'), '<!doctype html><title>root</title>');
	writeFileSync(join(root, '404.html'), '<!doctype html><title>missing</title>');
	server = spawn(process.execPath, [script, root, '0']);
	port = await new Promise<number>((resolve, reject) => {
		server.once('error', reject);
		server.stdout.on('data', (chunk: Buffer) => {
			const match = /127\.0\.0\.1:(\d+)/.exec(chunk.toString());
			if (match) resolve(Number(match[1]));
		});
	});
});

afterAll(() => {
	server?.kill();
	if (root) rmSync(root, { recursive: true, force: true });
});

function get(agent: http.Agent, path: string) {
	return new Promise<{ status: number; reused: boolean }>((resolve, reject) => {
		const request = http.get({ host: '127.0.0.1', port, path, agent }, (response) => {
			response.resume();
			response.on('end', () => resolve({ status: response.statusCode ?? 0, reused: request.reusedSocket }));
		});
		request.on('error', reject);
	});
}

describe('serve-static-build', () => {
	it('serves a file and the 404 page', async () => {
		const agent = new http.Agent({ keepAlive: true });
		try {
			expect((await get(agent, '/')).status).toBe(200);
			expect((await get(agent, '/nothing-here')).status).toBe(404);
		} finally {
			agent.destroy();
		}
	});

	it('keeps an idle keep-alive connection open past Node default idle close', async () => {
		const agent = new http.Agent({ keepAlive: true });
		try {
			const first = await get(agent, '/');
			expect(first).toEqual({ status: 200, reused: false });
			// Node closes an idle connection after 5 seconds by default, and some versions wait one more second.
			await new Promise((resolve) => setTimeout(resolve, 7_000));
			// The same connection still answers: the server never closed it under the client.
			expect(await get(agent, '/')).toEqual({ status: 200, reused: true });
		} finally {
			agent.destroy();
		}
	}, 15_000);
});
