import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { afterEach, describe, expect, it } from 'vitest';
import { reviewedLeadImageSnapshot } from '../src/lib/pulse/fixtures/reviewedLeadImageSnapshot';

const workspaceRoot = process.cwd();
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('Pulse v2 static projection', () => {
	it('prerenders a reviewed lead image and leaves it readable without JavaScript', async () => {
		const root = mkdtempSync(join(tmpdir(), 'jess-pulse-v2-'));
		roots.push(root);
		for (const path of ['src', 'static']) cpSync(join(workspaceRoot, path), join(root, path), { recursive: true });
		for (const file of ['package.json', 'svelte.config.js', 'tsconfig.json', 'vite.config.ts']) cpSync(join(workspaceRoot, file), join(root, file));
		symlinkSync(join(workspaceRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
		writeFileSync(join(root, 'static/data/pulse/public-snapshot.v2.json'), JSON.stringify(reviewedLeadImageSnapshot));
		execFileSync(process.execPath, [resolve(workspaceRoot, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'pipe', env: { ...process.env, MERMAID_PRERENDER: 'optional' } });
		const html = readFileSync(join(root, 'build/pulse.html'), 'utf8');
		expect(html).toContain('A tawny owl resting on a cedar branch');
		expect(html).toContain('width="1280"');
		expect(html).toContain('height="854"');
		expect(html).toContain('The full public note remains readable before JavaScript.');
		const server = createServer((request, response) => {
			const path = new URL(request.url ?? '/', 'http://localhost').pathname;
			const file = path === '/pulse' || path === '/pulse/' ? 'pulse.html' : 'index.html';
			response.writeHead(200).end(readFileSync(join(root, 'build', file)));
		});
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
		const browser = await chromium.launch(process.env.GF_RBE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.GF_RBE_CHROMIUM_EXECUTABLE } : undefined);
		try {
			const context = await browser.newContext({ javaScriptEnabled: false });
			const page = await context.newPage();
			await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/pulse`);
			const image = page.getByRole('img', { name: 'A tawny owl resting on a cedar branch' });
			expect(await image.getAttribute('width')).toBe('1280');
			expect(await page.getByText('The full public note remains readable before JavaScript.').isVisible()).toBe(true);
			await context.close();
		} finally { await browser.close(); await new Promise<void>((done) => server.close(() => done())); }
	}, 90_000);
});
