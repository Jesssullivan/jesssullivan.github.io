#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workflow = await readFile('.github/workflows/private-cv-authority-v2.yml', 'utf8');
const marker = 'name: Resolve default-owned exact source';
const start = workflow.indexOf(marker);
const scriptMarker = '          script: |\n';
const scriptStart = workflow.indexOf(scriptMarker, start) + scriptMarker.length;
const rest = workflow.slice(scriptStart);
const lines = rest.split('\n');
const body = [];
for (const line of lines) {
	if (line.length > 0 && !line.startsWith('            ')) break;
	body.push(line.slice(12));
}
const resolver = new vm.Script(`(async () => {\n${body.join('\n')}\n})()`);
const mainSha = 'a'.repeat(40);

async function run({
	eventName = 'repository_dispatch',
	action = 'private-cv-verify-v2',
	requestedSha = mainSha,
	contextSha = mainSha,
	contextRef = 'refs/heads/main',
	liveSha = mainSha,
} = {}) {
	const outputs = {};
	await resolver.runInNewContext({
		context: {
			repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
			eventName,
			ref: contextRef,
			sha: contextSha,
			payload: { action },
		},
		process: { env: { REQUESTED_SHA: requestedSha } },
		github: { rest: { git: { getRef: async () => ({ data: { object: { sha: liveSha } } }) } } },
		core: {
			setOutput: (key, value) => {
				outputs[key] = value;
			},
		},
	});
	return outputs;
}

assert.equal((await run()).source_sha, mainSha);
await assert.rejects(() => run({ action: 'arbitrary' }), /Unsupported repository_dispatch/);
await assert.rejects(() => run({ requestedSha: 'a'.repeat(39) }), /exact 40-character/);
await assert.rejects(() => run({ liveSha: 'b'.repeat(40) }), /is not current main/);
assert.equal((await run({ eventName: 'push' })).source_sha, mainSha);
await assert.rejects(() => run({ eventName: 'push', contextRef: 'refs/heads/dev' }), /exact main push/);
console.log('private CV authority resolver fixtures passed');
