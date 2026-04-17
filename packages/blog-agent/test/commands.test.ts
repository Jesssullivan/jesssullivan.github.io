import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Effect, Layer } from 'effect';
import { handleCommand, upsertScheduleDirective } from '../src/agents/commands.js';
import { GitHubService, type PullRequestData, type ChangedFile, type ReviewComment } from '../src/services/github.js';
import { SchemaServiceLive } from '../src/services/schema.js';

function makeGitHubService(prBody: string) {
	const comments: string[] = [];
	const labels: string[][] = [];
	let updatedBody: string | undefined;

	const pullRequest: PullRequestData = {
		number: 42,
		title: 'Draft post',
		body: prBody,
		headSha: 'deadbeef',
		headRef: 'feature/test',
		baseRef: 'main',
		labels: [],
	};

	const stubFiles: ChangedFile[] = [];
	const stubComments: ReviewComment[] = [];

	const layer = Layer.succeed(GitHubService)({
		getPR: () => Effect.succeed(pullRequest),
		updatePRBody: (_owner, _repo, _prNumber, body) =>
			Effect.sync(() => {
				updatedBody = body;
			}),
		listChangedFiles: () => Effect.succeed(stubFiles),
		getFileContent: () => Effect.fail(new Error('unused in schedule test')),
		postReview: (_owner, _repo, _prNumber, _commitId, _comments) => {
			stubComments.push(..._comments);
			return Effect.void;
		},
		postComment: (_owner, _repo, _issueNumber, body) =>
			Effect.sync(() => {
				comments.push(body);
			}),
		addLabels: (_owner, _repo, _issueNumber, newLabels) =>
			Effect.sync(() => {
				labels.push(newLabels);
			}),
		removeLabel: () => Effect.void,
		reactToComment: () => Effect.void,
		isCollaborator: () => Effect.succeed(true),
		commitFileChange: () => Effect.fail(new Error('unused in schedule test')),
	});

	return {
		layer,
		get updatedBody() {
			return updatedBody;
		},
		get comments() {
			return comments;
		},
		get labels() {
			return labels;
		},
		get stubComments() {
			return stubComments;
		},
	};
}

describe('upsertScheduleDirective', () => {
	it('appends a schedule directive to an empty PR body', () => {
		const body = upsertScheduleDirective('', '2026-05-01');
		assert.equal(body, '⚠️ **DO NOT MERGE until 2026-05-01 UTC** — Scheduled for auto-merge.');
	});

	it('replaces an existing schedule directive', () => {
		const body = upsertScheduleDirective(
			'## Draft Plan\n\n⚠️ **DO NOT MERGE until 2026-04-20 UTC** — Scheduled for auto-merge.',
			'2026-05-01',
		);
		assert.match(body, /DO NOT MERGE until 2026-05-01 UTC/);
		assert.doesNotMatch(body, /DO NOT MERGE until 2026-04-20 UTC/);
	});
});

describe('handleCommand /schedule', () => {
	it('updates the PR body and adds the scheduled label', async () => {
		const github = makeGitHubService('## Draft Plan');

		const result = await Effect.runPromise(
			handleCommand({
				owner: 'Jesssullivan',
				repo: 'jesssullivan.github.io',
				prNumber: 42,
				commentId: 7,
				commentBody: '/schedule 2026-05-01',
				commenter: 'Jesssullivan',
			}).pipe(Effect.provide(github.layer)),
		);

		assert.deepEqual(result, { handled: true, response: 'Scheduled for 2026-05-01' });
		assert.match(github.updatedBody ?? '', /DO NOT MERGE until 2026-05-01 UTC/);
		assert.deepEqual(github.labels, [['scheduled']]);
		assert.equal(github.comments.length, 1);
		assert.match(github.comments[0] ?? '', /PR body updated/);
	});

	it('does not update the PR body when the same schedule already exists', async () => {
		const github = makeGitHubService('⚠️ **DO NOT MERGE until 2026-05-01 UTC** — Scheduled for auto-merge.');

		await Effect.runPromise(
			handleCommand({
				owner: 'Jesssullivan',
				repo: 'jesssullivan.github.io',
				prNumber: 42,
				commentId: 7,
				commentBody: '/schedule 2026-05-01',
				commenter: 'Jesssullivan',
			}).pipe(Effect.provide(github.layer)),
		);

		assert.equal(github.updatedBody, undefined);
		assert.equal(github.comments.length, 1);
		assert.match(github.comments[0] ?? '', /already matched/);
	});
});

describe('handleCommand slash-command file updates', () => {
	it('uses the fetched blob sha when publishing a post', async () => {
		let committedSha: string | undefined;

		const layer = Layer.merge(
			Layer.succeed(GitHubService)({
			getPR: () =>
				Effect.succeed({
					number: 42,
					title: 'Draft post',
					body: null,
					headSha: 'deadbeef',
					headRef: 'feature/test',
					baseRef: 'main',
					labels: [],
				}),
			updatePRBody: () => Effect.void,
			listChangedFiles: () =>
				Effect.succeed([
					{ filename: 'src/posts/2026-04-16-test.md', status: 'modified' as const },
				]),
			getFileContent: () =>
				Effect.succeed({
					content: '---\ntitle: "Test"\npublished: false\n---\nhello',
					sha: 'blobsha123',
				}),
			postReview: () => Effect.void,
			postComment: () => Effect.void,
			addLabels: () => Effect.void,
			removeLabel: () => Effect.void,
			reactToComment: () => Effect.void,
			isCollaborator: () => Effect.succeed(true),
			commitFileChange: (_owner, _repo, _path, _content, sha) =>
				Effect.sync(() => {
					committedSha = sha;
				}),
			}),
			SchemaServiceLive,
		);

		await Effect.runPromise(
			handleCommand({
				owner: 'Jesssullivan',
				repo: 'jesssullivan.github.io',
				prNumber: 42,
				commentId: 7,
				commentBody: '/publish',
				commenter: 'Jesssullivan',
			}).pipe(Effect.provide(layer)),
		);

		assert.equal(committedSha, 'blobsha123');
	});

	it('uses the fetched blob sha when retitling a post', async () => {
		let committedSha: string | undefined;

		const layer = Layer.succeed(GitHubService)({
			getPR: () =>
				Effect.succeed({
					number: 42,
					title: 'Draft post',
					body: null,
					headSha: 'deadbeef',
					headRef: 'feature/test',
					baseRef: 'main',
					labels: [],
				}),
			updatePRBody: () => Effect.void,
			listChangedFiles: () =>
				Effect.succeed([
					{ filename: 'src/posts/2026-04-16-test.md', status: 'modified' as const },
				]),
			getFileContent: () =>
				Effect.succeed({
					content: '---\ntitle: "Old Title"\npublished: true\n---\nhello',
					sha: 'blobsha456',
				}),
			postReview: () => Effect.void,
			postComment: () => Effect.void,
			addLabels: () => Effect.void,
			removeLabel: () => Effect.void,
			reactToComment: () => Effect.void,
			isCollaborator: () => Effect.succeed(true),
			commitFileChange: (_owner, _repo, _path, _content, sha) =>
				Effect.sync(() => {
					committedSha = sha;
				}),
		});

		await Effect.runPromise(
			handleCommand({
				owner: 'Jesssullivan',
				repo: 'jesssullivan.github.io',
				prNumber: 42,
				commentId: 7,
				commentBody: '/retitle "New Title"',
				commenter: 'Jesssullivan',
			}).pipe(Effect.provide(layer)),
		);

		assert.equal(committedSha, 'blobsha456');
	});
});
