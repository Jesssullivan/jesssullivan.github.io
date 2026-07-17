import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

import { onRequest } from '../functions/blog/ssh-macos-kvm-hid-accessory-approval.js';

const retainedAssetSlug = 'ssh-macos-kvm-hid-accessory-approval';
const heldPath = `/blog/${retainedAssetSlug}`;
const response = await onRequest();

assert.equal(response.status, 404);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
assert.equal(await response.text(), 'Not Found\n');

const routesUrl = new URL('../static/_routes.json', import.meta.url);
const routes = JSON.parse(await readFile(routesUrl, 'utf8'));
const publicationHoldsUrl = new URL('../static/blog-publication-holds.json', import.meta.url);
const publicationHolds = JSON.parse(await readFile(publicationHoldsUrl, 'utf8'));
const functionsUrl = new URL('../functions/', import.meta.url);

async function listFunctionFiles(directoryUrl, prefix = '') {
	const entries = await readdir(directoryUrl, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...(await listFunctionFiles(new URL(`${entry.name}/`, directoryUrl), relativePath)));
		} else if (entry.isFile() && entry.name.endsWith('.js')) {
			files.push(relativePath);
		}
	}

	return files.sort();
}

const functionFiles = await listFunctionFiles(functionsUrl);
assert.deepEqual(functionFiles, [`blog/${retainedAssetSlug}.js`]);
const guardedSlugs = functionFiles.map((filename) =>
	filename.slice('blog/'.length, -'.js'.length)
);

assert.deepEqual(guardedSlugs, [retainedAssetSlug]);
assert.ok(publicationHolds.includes(retainedAssetSlug));
assert.equal(routes.version, 1);
assert.deepEqual(routes.include, guardedSlugs.flatMap((slug) => [`/blog/${slug}`, `/blog/${slug}/`]));
assert.deepEqual(routes.exclude, []);

const workflowUrl = new URL('../.github/workflows/cloudflare-pages-shadow.yml', import.meta.url);
const workflow = await readFile(workflowUrl, 'utf8');
const functionPathFilters = workflow.match(/- "functions\/\*\*"/g) ?? [];

assert.equal(functionPathFilters.length, 2);
assert.match(workflow, /command: pages deploy build --project-name=/);

console.log('Held-post edge 404 contract passed');
