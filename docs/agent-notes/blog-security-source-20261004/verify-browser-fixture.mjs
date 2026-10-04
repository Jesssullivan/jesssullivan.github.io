// Pure mocks of the exact staged browser fixture; never launches Chromium.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from '/Users/jess/git/jesssullivan.github.io/node_modules/typescript/lib/typescript.js';

const path = '/Users/jess/git/jesssullivan.github.io.worktrees/security-source-reconcile-20261004/e2e/document-root.spec.ts';
const text = readFileSync(path, 'utf8');
const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const helper = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'confineToLocalOrigin');
assert.ok(helper, 'the exact staged confinement helper must exist');
const compiled = ts.transpileModule(helper.getText(source), {
	reportDiagnostics: true,
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
assert.equal(compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);
const confine = vm.runInNewContext(`${compiled.outputText}\nconfineToLocalOrigin`, { URL });

for (const base of [undefined, 'https://transscendsurvival.org', 'https://127.0.0.1:5190', 'http://user@localhost:5190']) {
	await assert.rejects(() => confine({ route() { throw Error('unexpected route registration'); } }, base));
}

let handler;
await confine({ async route(pattern, callback) { assert.equal(pattern, '**/*'); handler = callback; } }, 'http://127.0.0.1:5190');
assert.ok(handler);
async function request(url, method = 'GET', status = 200) {
	const result = { fetched: 0, fulfilled: 0, aborted: 0 };
	await handler({
		request() { return { url: () => url, method: () => method }; },
		async fetch(options) { assert.equal(options.maxRedirects, 0); result.fetched++; return { status: () => status }; },
		async fulfill() { result.fulfilled++; },
		async abort(reason) { assert.equal(reason, 'blockedbyclient'); result.aborted++; },
	});
	return result;
}
assert.deepEqual(await request('http://127.0.0.1:5190/blog/example'), { fetched: 1, fulfilled: 1, aborted: 0 });
assert.deepEqual(await request('http://127.0.0.1:5190/', 'HEAD'), { fetched: 1, fulfilled: 1, aborted: 0 });
assert.deepEqual(await request('http://127.0.0.1:5190/', 'GET', 302), { fetched: 1, fulfilled: 0, aborted: 1 });
for (const url of ['https://transscendsurvival.org/', 'https://hub.tinyland.dev/', 'http://127.0.0.1:3000/', 'http://user@127.0.0.1:5190/']) {
	assert.deepEqual(await request(url), { fetched: 0, fulfilled: 0, aborted: 1 });
}
assert.deepEqual(await request('http://127.0.0.1:5190/', 'POST'), { fetched: 0, fulfilled: 0, aborted: 1 });
console.log('exact staged confinement helper: loopback only, GET/HEAD only, no credential URLs or redirect escape; pure mocks passed');
