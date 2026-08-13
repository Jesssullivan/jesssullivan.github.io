import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/github-pages-rollback-v2.yml', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const executeResolver = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript('Resolve exact current-main rollback source'),
);
const executeRecheck = new AsyncFunction(
	'github',
	'context',
	'core',
	'process',
	extractGithubScript('Revalidate rollback kill switch and current main'),
);

const repository = 'Jesssullivan/jesssullivan.github.io';
const sourceSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

function canonicalRun(overrides = {}) {
	return {
		id: 41,
		head_sha: sourceSha,
		head_branch: 'main',
		event: 'push',
		conclusion: 'success',
		head_repository: { full_name: repository },
		html_url: 'https://github.example/ci/41',
		...overrides,
	};
}

function authorityJobs(overrides = {}) {
	return [
		{ name: 'build-and-test', conclusion: overrides.hosted ?? 'success' },
		{ name: 'bazel-remote-gates', conclusion: overrides.bazel ?? 'success' },
	];
}

async function runResolver({
	dispatchAction = 'github-pages-rollback-v2',
	manualSha = sourceSha,
	confirm = 'true',
	enabled = 'true',
	mainSha = sourceSha,
	runs = [canonicalRun()],
	cvRuns = [canonicalRun({ id: 42 })],
	jobs = authorityJobs(),
} = {}) {
	const outputs = {};
	const listWorkflowRuns = async (args) => ({
		data: { workflow_runs: args.workflow_id === 'private-cv-authority-v2.yml' ? cvRuns : runs },
	});
	const listJobsForWorkflowRun = async () => ({ data: { jobs } });
	const github = {
		rest: {
			actions: { listWorkflowRuns, listJobsForWorkflowRun },
			git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) },
		},
		paginate: async (method, args) => {
			const response = await method(args);
			return response.data.workflow_runs ?? response.data.jobs;
		},
	};
	const context = {
		eventName: 'repository_dispatch',
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
			REQUEST_SOURCE_SHA: manualSha,
			CONFIRM_ROLLBACK: confirm,
			ROLLBACK_ENABLED: enabled,
		},
	});
	return outputs;
}

assert.deepEqual(await runResolver(), {
	source_sha: sourceSha,
	ci_url: 'https://github.example/ci/41',
});
await assert.rejects(() => runResolver({ enabled: 'false' }), /requires confirmation/);
await assert.rejects(() => runResolver({ confirm: 'false' }), /requires confirmation/);
await assert.rejects(() => runResolver({ dispatchAction: 'arbitrary' }), /requires the exact repository dispatch type/);
await assert.rejects(() => runResolver({ mainSha: otherSha }), /is not current main/);
await assert.rejects(
	() => runResolver({ runs: [canonicalRun({ head_sha: otherSha })] }),
	/No successful canonical CI push run/,
);
await assert.rejects(
	() => runResolver({ jobs: authorityJobs({ bazel: 'skipped' }) }),
	/Required CI job bazel-remote-gates was missing or not successful/,
);
await assert.rejects(
	() => runResolver({ cvRuns: [canonicalRun({ head_sha: otherSha })] }),
	/No successful private CV authority run found/,
);

const recheckContext = { repo: { owner: 'Jesssullivan', repo: 'jesssullivan.github.io' } };
const recheckProcess = { env: { EXPECTED_SHA: sourceSha } };
function recheckGithub({ enabled = 'true', mainSha = sourceSha } = {}) {
	return {
		rest: {
			actions: {
				getRepoVariable: async () => ({ data: { value: enabled } }),
			},
			git: { getRef: async () => ({ data: { object: { sha: mainSha } } }) },
		},
	};
}
await executeRecheck(recheckGithub(), recheckContext, {}, recheckProcess);
await assert.rejects(
	() => executeRecheck(recheckGithub({ enabled: 'false' }), recheckContext, {}, recheckProcess),
	/not true at publish time/,
	'rollback kill switch changing during build fails immediately before publication',
);
await assert.rejects(
	() => executeRecheck(recheckGithub({ mainSha: otherSha }), recheckContext, {}, recheckProcess),
	/Rollback source became stale/,
	'rollback source changing during build fails immediately before publication',
);

console.log('GitHub Pages rollback resolver fixtures passed');

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
