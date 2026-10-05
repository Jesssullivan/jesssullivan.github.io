import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceSha = 'a'.repeat(40);
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blog-artifact-contract-'));
	mkdirSync(join(root, 'build'));
	writeFileSync(join(root, 'build/index.html'), 'public ordinary reader');
	writeFileSync(join(root, 'artifact.json'), JSON.stringify({ sourceSha, sanitizer: '3.4.16', files: [{ path: 'index.html', sha256: createHash('sha256').update('public ordinary reader').digest('hex') }] }));
	return root;
}
function run(operation, root, sha = sourceSha) { return spawnSync(process.execPath, ['scripts/local-production-artifact.mjs', operation, root, sha], { encoding: 'utf8' }); }
test('accepts exact bytes and rejects changed or extra bytes', () => {
	const root = fixture(); assert.equal(run('verify', root).status, 0);
	writeFileSync(join(root, 'build/extra.html'), 'extra'); assert.notEqual(run('verify', root).status, 0);
	const changed = fixture(); writeFileSync(join(changed, 'build/index.html'), 'changed'); assert.notEqual(run('verify', changed).status, 0);
});
test('rejects wrong source, symlink and unqualified publication without credentials', () => {
	const root = fixture(); assert.notEqual(run('verify', root, 'b'.repeat(40)).status, 0);
	symlinkSync(join(root, 'build/index.html'), join(root, 'build/link')); assert.notEqual(run('verify', root).status, 0);
	assert.notEqual(run('publish', fixture()).status, 0);
});
