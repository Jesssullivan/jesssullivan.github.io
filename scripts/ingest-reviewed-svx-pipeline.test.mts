import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { afterEach, describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const ingestScript = resolve(workspaceRoot, 'scripts/ingest-tinyland-posts.mts');
const searchIndexScript = resolve(workspaceRoot, 'scripts/generate-search-index.mts');
const viteBinary = resolve(workspaceRoot, 'node_modules/vite/bin/vite.js');
const temporaryRoots: string[] = [];

function contentHash(snapshot: Record<string, unknown>): string {
	return `sha256:${createHash('sha256').update(JSON.stringify({ ...snapshot, contentHash: '' })).digest('hex')}`;
}

function runScript(root: string, script: string, args: string[] = []): void {
	execFileSync(process.execPath, ['--import', resolve(workspaceRoot, 'node_modules/tsx/dist/loader.mjs'), script, ...args], {
		cwd: root,
		encoding: 'utf8',
		stdio: 'pipe',
	});
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('reviewed SVX static projection pipeline', () => {
	it('materializes a reviewed snapshot into a prerendered, accessible .svx article', async () => {
		const root = mkdtempSync(join(tmpdir(), 'jess-reviewed-svx-'));
		temporaryRoots.push(root);
		// Copy a private, disposable SvelteKit app so the fixture traverses the
		// exact static route/build path without becoming repository content.
		cpSync(join(workspaceRoot, 'src'), join(root, 'src'), { recursive: true });
		cpSync(join(workspaceRoot, 'static'), join(root, 'static'), { recursive: true });
		for (const file of ['package.json', 'svelte.config.js', 'tsconfig.json', 'vite.config.ts']) {
			cpSync(join(workspaceRoot, file), join(root, file));
		}
		symlinkSync(join(workspaceRoot, 'node_modules'), join(root, 'node_modules'), 'dir');

		const snapshot: Record<string, unknown> = {
			schemaVersion: 'tinyland.static-spoke.snapshot.v1',
			snapshotId: 'reviewed-svx-pipeline-fixture',
			generatedAt: '2026-09-22T00:00:00.000Z',
			sourceAuthority: 'tinyland.dev',
			contentHash: '',
			itemCount: 1,
			policyVersion: 'reviewed-svx-test',
			projectionKind: 'posts',
			spokeTarget: 'transscendsurvival.org',
			brandRef: 'jesssullivan-github-io',
			publicSnapshotUrl: 'https://hub.tinyland.dev/projections/jesssullivan-github-io/posts/public-snapshot.v1.json',
			activityPubStatus: 'not a public federation launch',
			consumerContract: {
				publicBaseUrl: 'https://transscendsurvival.org',
				staticSnapshotCopy: true,
				runtimeBrokerFetch: false,
				mutationApi: false,
				activityPubWorker: false,
			},
			posts: [
				{
					slug: 'reviewed-svx-pipeline-fixture',
					targetFile: 'src/posts/2026-09-22-reviewed-svx-pipeline-fixture.svx',
					title: 'Reviewed SVX pipeline fixture',
					date: '2026-09-22',
					description: 'Private projection pipeline fixture.',
					tags: ['fixture'],
					published: true,
					visibility: 'public',
					authorSlug: 'jesssullivan',
					tinylandSourceRecord: 'content/users/jesssullivan/blog/reviewed-svx-pipeline-fixture.svx',
					tinylandSourceHash: `sha256:${'a'.repeat(64)}`,
					reviewStatus: 'operator-reviewed-source-public',
					contentMarkdown: '<InlineDisclosure label="Show the reviewed body" defaultOpen={false}>\n\nThe full reviewed body reaches the static article.\n\n</InlineDisclosure>',
				},
			],
		};
		snapshot.contentHash = contentHash(snapshot);
		writeFileSync(
			join(root, 'static/data/tinyland/posts/public-snapshot.v1.json'),
			JSON.stringify(snapshot),
			'utf8',
		);

		runScript(root, ingestScript, ['--adopt-reviewed']);
		runScript(root, searchIndexScript);

		const post = readFileSync(join(root, 'src/posts/2026-09-22-reviewed-svx-pipeline-fixture.svx'), 'utf8');
		const index = readFileSync(join(root, 'static/search-index.json'), 'utf8');
		const loaders = readFileSync(join(root, 'src/lib/data/blog-post-loaders.generated.ts'), 'utf8');
		expect(post).toContain("import InlineDisclosure from '$lib/components/InlineDisclosure.svelte';");
		expect(post).toContain('The full reviewed body reaches the static article.');
		expect(index).toContain('reviewed-svx-pipeline-fixture');
		expect(index).toContain('/src/posts/2026-09-22-reviewed-svx-pipeline-fixture.svx');
		expect(loaders).toContain("'/src/posts/2026-09-22-reviewed-svx-pipeline-fixture.svx'");

		execFileSync(process.execPath, [viteBinary, 'build'], {
			cwd: root,
			encoding: 'utf8',
			stdio: 'pipe',
			env: { ...process.env, MERMAID_PRERENDER: 'optional' },
		});
		const article = readFileSync(join(root, 'build/blog/reviewed-svx-pipeline-fixture.html'), 'utf8');
		expect(article).toContain('Show the reviewed body');
		expect(article).toContain('The full reviewed body reaches the static article.');
		expect(article).toContain('aria-expanded="true"');

		const server = createServer((request, response) => {
			const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
			const cleanPath = pathname.replace(/^\//, '');
			const relativePath = pathname === '/' ? 'index.html' : /\.[A-Za-z0-9]+$/.test(cleanPath) ? cleanPath : `${cleanPath}.html`;
			if (relativePath.includes('..')) {
				response.writeHead(400).end();
				return;
			}
			try {
				response.writeHead(200).end(readFileSync(join(root, 'build', relativePath)));
			} catch {
				response.writeHead(404).end();
			}
		});
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
		const port = (server.address() as AddressInfo).port;
		const url = `http://127.0.0.1:${port}/blog/reviewed-svx-pipeline-fixture`;
		const browser = await chromium.launch(
			process.env.GF_RBE_CHROMIUM_EXECUTABLE
				? { executablePath: process.env.GF_RBE_CHROMIUM_EXECUTABLE }
				: undefined,
		);
		try {
			const noJs = await browser.newContext({ javaScriptEnabled: false });
			const noJsPage = await noJs.newPage();
			await noJsPage.goto(url);
			await expect(noJsPage.getByRole('button', { name: 'Show the reviewed body' })).toHaveAttribute('aria-expanded', 'true');
			await expect(noJsPage.getByText('The full reviewed body reaches the static article.')).toBeVisible();
			await noJs.close();

			const page = await browser.newPage();
			await page.goto(url);
			const trigger = page.getByRole('button', { name: 'Show the reviewed body' });
			const body = page.getByText('The full reviewed body reaches the static article.');
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			await expect(body).toBeHidden();
			await trigger.focus();
			await page.keyboard.press('Enter');
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			await expect(body).toBeVisible();
		} finally {
			await browser.close();
			await new Promise<void>((done) => server.close(() => done()));
		}
	});
});
