import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, staleFiles } from '../tools/emit-js.ts';
import { FIXTURES, scratch, VALID_BLOG } from './helpers.ts';

// Runs as a plain .mjs file from a node_modules copy, as a site would load it.
const CONSUMER = `
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyProjection } from '@xoxd/projection';
import { FIRST_BUILD } from '@xoxd/projection/fetch';
const [fixtures, sha256] = process.argv.slice(2);
const valid = join(fixtures, 'valid');
const read = (path) => readFileSync(join(valid, path));
const key = JSON.parse(readFileSync(join(fixtures, 'TEST-ONLY-ed25519-key.json'), 'utf8')).publicKey;
const result = await verifyProjection({
	head: read('projection/v2/blog/head.json'),
	manifest: read('projection/v2/blog/manifests/' + sha256 + '.json'),
	signature: read('projection/v2/blog/manifests/' + sha256 + '.sig'),
	publicKey: key,
	manifestSha256: sha256,
	target: 'blog',
	...FIRST_BUILD,
	readBlob: async (blob) => read('projection/v2/blobs/sha256/' + blob),
});
process.stdout.write(JSON.stringify(result.ok ? [] : result.findings));
`;

describe('shipped JavaScript', () => {
	it('dist/ is what src/ emits', () => {
		assert.deepEqual(staleFiles(), []);
	});

	it('loads from node_modules by package name and verifies the valid blog', async () => {
		const root = await scratch('consumer');
		const pkg = join(root, 'node_modules', '@xoxd', 'projection');
		mkdirSync(pkg, { recursive: true });
		for (const item of ['package.json', 'src', 'dist']) cpSync(join(ROOT, item), join(pkg, item), { recursive: true, dereference: true });
		const script = join(root, 'consumer.mjs');
		writeFileSync(script, CONSUMER);
		const result = spawnSync(process.execPath, [script, FIXTURES, VALID_BLOG], { cwd: root, encoding: 'utf8' });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout, '[]');
	});
});
