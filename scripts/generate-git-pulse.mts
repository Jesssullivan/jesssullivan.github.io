#!/usr/bin/env node
/**
 * Generate real code activity data from git history.
 * Aggregates commits by day per repo, outputs AS2-compatible activities.
 * Merges into mock outbox replacing synthetic code entries.
 *
 * Usage: tsx scripts/generate-git-pulse.mts
 * Output: updates scripts/data/mock-outbox.json with real code activities
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const MOCK_OUTBOX = 'scripts/data/mock-outbox.json';
const ACTOR = 'https://tinyland.dev/@jesssullivan';
const BASE = 'https://tinyland.dev';
const DAYS_BACK = 90;

interface DaySummary {
	date: string;
	repo: string;
	added: number;
	removed: number;
	commits: number;
	languages: Set<string>;
	messages: string[];
}

const EXT_TO_LANG: Record<string, string> = {
	'.ts': 'TypeScript', '.mts': 'TypeScript', '.tsx': 'TypeScript',
	'.js': 'JavaScript', '.mjs': 'JavaScript', '.jsx': 'JavaScript',
	'.svelte': 'Svelte', '.css': 'CSS', '.html': 'HTML',
	'.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.zig': 'Zig',
	'.nix': 'Nix', '.chpl': 'Chapel', '.dhall': 'Dhall',
	'.sh': 'Shell', '.bash': 'Shell', '.fish': 'Shell',
	'.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
	'.md': 'Markdown', '.mdx': 'Markdown', '.svx': 'Markdown',
	'.c': 'C', '.h': 'C', '.cpp': 'C++', '.el': 'Emacs Lisp',
};

function detectLanguages(diffStat: string): string[] {
	const langs = new Set<string>();
	for (const line of diffStat.split('\n')) {
		const match = line.match(/(\.[a-zA-Z0-9]+)\s*\|/);
		if (match) {
			const lang = EXT_TO_LANG[match[1]];
			if (lang) langs.add(lang);
		}
	}
	return [...langs].sort();
}

function gitLog(repoPath: string): DaySummary[] {
	const since = `${DAYS_BACK} days ago`;
	let logOutput: string;
	try {
		logOutput = execSync(
			`git log --all --no-merges --since="${since}" --format="COMMIT|%H|%ai|%s" --numstat`,
			{ cwd: repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
		);
	} catch {
		return [];
	}

	const days = new Map<string, DaySummary>();
	const repo = basename(repoPath);
	let currentDate = '';
	let currentMessage = '';

	for (const line of logOutput.split('\n')) {
		if (line.startsWith('COMMIT|')) {
			const parts = line.split('|');
			currentDate = parts[2].slice(0, 10);
			currentMessage = parts[3];
			if (!days.has(currentDate)) {
				days.set(currentDate, {
					date: currentDate,
					repo,
					added: 0,
					removed: 0,
					commits: 0,
					languages: new Set(),
					messages: [],
				});
			}
			const day = days.get(currentDate)!;
			day.commits++;
			day.messages.push(currentMessage);
			continue;
		}

		const numMatch = line.match(/^(\d+)\t(\d+)\t(.+)$/);
		if (numMatch && currentDate) {
			const day = days.get(currentDate)!;
			day.added += parseInt(numMatch[1], 10);
			day.removed += parseInt(numMatch[2], 10);
			const ext = numMatch[3].match(/(\.[a-zA-Z0-9]+)$/);
			if (ext && EXT_TO_LANG[ext[1]]) {
				day.languages.add(EXT_TO_LANG[ext[1]]);
			}
		}
	}

	return [...days.values()];
}

function summaryToActivity(summary: DaySummary) {
	const id = createHash('sha256')
		.update(`${summary.date}-${summary.repo}-code`)
		.digest('hex')
		.slice(0, 32);

	const published = new Date(`${summary.date}T18:00:00-04:00`).toISOString();
	const langs = [...summary.languages].slice(0, 4);
	const topMessage = summary.messages[0] || 'code changes';
	const net = summary.added - summary.removed;
	const sign = net >= 0 ? '+' : '';

	return {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			{ tl: 'https://tinyland.dev/ns/v1#' },
		],
		type: 'Create',
		id: `${BASE}/activities/${id}`,
		actor: ACTOR,
		published,
		object: {
			type: 'Note',
			id: `${BASE}/notes/${id}`,
			published,
			attributedTo: ACTOR,
			content: `<p>${sign}${net} lines across ${summary.commits} commit${summary.commits === 1 ? '' : 's'} in ${summary.repo}. ${topMessage}.</p>`,
			tag: [{ type: 'Hashtag', name: '#code' }],
			'tl:codeActivity': {
				linesAdded: summary.added,
				linesRemoved: summary.removed,
				commits: summary.commits,
				repository: summary.repo,
				languages: langs,
			},
		},
	};
}

async function main(): Promise<void> {
	const gitDir = resolve(process.env.HOME || '~', 'git');
	const thisRepo = resolve(process.cwd());

	// Scan repos under ~/git/ that have recent activity
	const repos = [thisRepo];
	const siblingCandidates = [
		'XoxdWM', 'cmux', 'aperture-bootstrap',
		'scheduling-kit', 'acuity-middleware', 'eGreg',
		'GloriousFlywheel', 'rockies', 'linux-xr',
	];

	for (const name of siblingCandidates) {
		const path = resolve(gitDir, name);
		if (existsSync(resolve(path, '.git'))) {
			repos.push(path);
		}
	}

	console.log(`Scanning ${repos.length} repos for git activity...`);

	const allSummaries: DaySummary[] = [];
	for (const repo of repos) {
		const summaries = gitLog(repo);
		allSummaries.push(...summaries);
		if (summaries.length > 0) {
			const totalCommits = summaries.reduce((s, d) => s + d.commits, 0);
			console.log(`  ${basename(repo)}: ${summaries.length} active days, ${totalCommits} commits`);
		}
	}

	const codeActivities = allSummaries.map(summaryToActivity);

	// Read existing mock outbox, strip synthetic code activities, merge real ones
	const outbox = JSON.parse(await readFile(MOCK_OUTBOX, 'utf-8'));
	const nonCodeItems = outbox.orderedItems.filter(
		(a: Record<string, unknown>) => {
			const obj = a.object as Record<string, unknown> | undefined;
			return !obj?.['tl:codeActivity'];
		},
	);

	const merged = [...nonCodeItems, ...codeActivities].sort(
		(a: { published: string }, b: { published: string }) =>
			new Date(b.published).getTime() - new Date(a.published).getTime(),
	);

	outbox.orderedItems = merged;
	outbox.totalItems = merged.length;

	await writeFile(MOCK_OUTBOX, JSON.stringify(outbox, null, 2));
	console.log(
		`\nGit pulse: ${codeActivities.length} code activities merged into mock outbox (${merged.length} total)`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
