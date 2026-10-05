import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceSha = 'a'.repeat(40);
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'blog-artifact-contract-'));
	mkdirSync(join(root, 'build'));
	mkdirSync(join(root, 'build/cv'));
	writeFileSync(join(root, 'build/index.html'), 'public ordinary reader');
	const files = [{ path: 'index.html', sha256: createHash('sha256').update('public ordinary reader').digest('hex') }];
	for (const pdf of ['jess_sullivan_resume.pdf', 'jess_sullivan_precis.pdf', 'jess_sullivan_cv.pdf']) {
		writeFileSync(join(root, 'build/cv', pdf), '%PDF-test');
		files.push({ path: `cv/${pdf}`, sha256: createHash('sha256').update('%PDF-test').digest('hex') });
	}
	files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	writeFileSync(join(root, 'artifact.json'), JSON.stringify({ sourceSha, sanitizer: '3.4.16', files }));
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
test('standalone seal is unavailable and fixed-success receipts are rejected', () => {
	const root = fixture();
	assert.notEqual(run('seal', root).status, 0);
	const manifestHash = createHash('sha256').update(readFileSync(join(root, 'artifact.json'))).digest('hex');
	writeFileSync(join(root, 'qualification.json'), JSON.stringify({ schemaVersion: 'tss.local-production-qualification.v1', custody: 'same-uid-operator', sourceSha, manifestHash, gates: ['pretend-success'] }));
	const result = run('publish', root); assert.notEqual(result.status, 0);
	assert.match(result.stderr, /exact successful source\/artifact-bound required gates/);
});
