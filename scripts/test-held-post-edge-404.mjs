import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { onRequest } from '../functions/blog/ssh-macos-kvm-hid-accessory-approval.js';

const heldPath = '/blog/ssh-macos-kvm-hid-accessory-approval';
const response = await onRequest();

assert.equal(response.status, 404);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
assert.equal(await response.text(), 'Not Found\n');

const routesUrl = new URL('../static/_routes.json', import.meta.url);
const routes = JSON.parse(await readFile(routesUrl, 'utf8'));

assert.deepEqual(routes, {
	version: 1,
	include: [heldPath, `${heldPath}/`],
	exclude: []
});

const workflowUrl = new URL('../.github/workflows/cloudflare-pages-shadow.yml', import.meta.url);
const workflow = await readFile(workflowUrl, 'utf8');
const functionPathFilters = workflow.match(/- "functions\/\*\*"/g) ?? [];

assert.equal(functionPathFilters.length, 2);
assert.match(workflow, /command: pages deploy build --project-name=/);

console.log('Held-post edge 404 contract passed');
