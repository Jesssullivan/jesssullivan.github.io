import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
	new URL('../.github/workflows/cloudflare-pages-parity-v2.yml', import.meta.url),
	'utf8',
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const resolverSource = extractGithubScript('Resolve exact open same-repo PR');
const executeResolver = new AsyncFunction('github', 'context', 'core', 'process', resolverSource);

const repository = 'Jesssullivan/jesssullivan.github.io';
const sourceSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

function pullRequest(overrides = {}) {
	return {
		number: 251,
		state: 'open',
		base: { ref: 'main' },
		head: {
			sha: sourceSha,
			repo: { full_name: repository },
		},
		...overrides,
	};
}

async function runFixture({
	pr = pullRequest(),
	eventName = 'repository_dispatch',
	dispatchAction = 'cloudflare-pages-parity-v2',
	manualPr = '251',
	manualSha = sourceSha,
} = {}) {
	const outputs = {};
	const github = { rest: { pulls: { get: async () => ({ data: pr }) } } };
	const context = {
		eventName,
		repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' },
		payload: { action: dispatchAction },
	};
	const core = {
		setOutput(name, value) {
			outputs[name] = value;
		},
	};
	await executeResolver(github, context, core, {
		env: {
			REQUEST_PR_NUMBER: manualPr,
			REQUEST_SOURCE_SHA: manualSha,
		},
	});
	return outputs;
}

assert.deepEqual(await runFixture(), { source_sha: sourceSha, pr_number: '251' });
await assert.rejects(
	() => runFixture({ eventName: 'pull_request' }),
	/requires the exact repository dispatch type/,
	'PR event cannot enter parity resolver',
);
await assert.rejects(
	() => runFixture({ dispatchAction: 'arbitrary' }),
	/requires the exact repository dispatch type/,
	'arbitrary repository dispatch type cannot enter parity resolver',
);
await assert.rejects(
	() => runFixture({ manualSha: 'a'.repeat(39) }),
	/exact 40-character lowercase commit SHA/,
	'non-exact SHA fails closed',
);
await assert.rejects(
	() => runFixture({ pr: pullRequest({ state: 'closed' }) }),
	/not an open same-repo main PR/,
	'closed PR fails closed',
);
await assert.rejects(
	() =>
		runFixture({
			pr: pullRequest({ head: { ...pullRequest().head, repo: { full_name: 'fork/blog' } } }),
		}),
	/not an open same-repo main PR/,
	'fork PR fails closed',
);
await assert.rejects(
	() => runFixture({ pr: pullRequest({ head: { ...pullRequest().head, sha: otherSha } }) }),
	/not an open same-repo main PR/,
	'head drift fails closed',
);

console.log('Cloudflare parity resolver fixtures passed');

function extractGithubScript(stepName) {
	const marker = `      - name: ${stepName}`;
	const markerIndex = workflow.indexOf(marker);
	assert.notEqual(markerIndex, -1, `${stepName} step exists`);
	const lines = workflow.slice(markerIndex).split('\n');
	const scriptStart = lines.findIndex((line) => line === '          script: |');
	assert.notEqual(scriptStart, -1, `${stepName} has an inline script`);
	const scriptLines = [];
	for (const line of lines.slice(scriptStart + 1)) {
		if (line === '') {
			scriptLines.push('');
			continue;
		}
		if (!line.startsWith('            ')) break;
		scriptLines.push(line.slice(12));
	}
	return scriptLines.join('\n');
}
