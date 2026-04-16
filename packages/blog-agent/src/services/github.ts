import { Effect, Layer, ServiceMap } from 'effect';
import { Octokit } from '@octokit/rest';

// ── Types ──────────────────────────────────────────────────

export interface PullRequestData {
	number: number;
	title: string;
	body: string | null;
	headSha: string;
	headRef: string;
	baseRef: string;
	labels: string[];
}

export interface ChangedFile {
	filename: string;
	status: 'added' | 'modified' | 'removed' | 'renamed';
	patch?: string | undefined;
}

export interface ReviewComment {
	path: string;
	line: number;
	side: 'RIGHT';
	body: string;
}

// ── Service definition ─────────────────────────────────────

export class GitHubService extends ServiceMap.Service<
	GitHubService,
	{
		readonly getPR: (owner: string, repo: string, number: number) => Effect.Effect<PullRequestData, Error>;
		readonly updatePRBody: (owner: string, repo: string, prNumber: number, body: string) => Effect.Effect<void, Error>;
		readonly listChangedFiles: (owner: string, repo: string, prNumber: number) => Effect.Effect<ChangedFile[], Error>;
		readonly getFileContent: (owner: string, repo: string, path: string, ref: string) => Effect.Effect<string, Error>;
		readonly postReview: (
			owner: string,
			repo: string,
			prNumber: number,
			commitId: string,
			comments: ReviewComment[],
		) => Effect.Effect<void, Error>;
		readonly postComment: (
			owner: string,
			repo: string,
			issueNumber: number,
			body: string,
			marker?: string,
		) => Effect.Effect<void, Error>;
		readonly addLabels: (
			owner: string,
			repo: string,
			issueNumber: number,
			labels: string[],
		) => Effect.Effect<void, Error>;
		readonly removeLabel: (
			owner: string,
			repo: string,
			issueNumber: number,
			label: string,
		) => Effect.Effect<void, Error>;
		readonly reactToComment: (
			owner: string,
			repo: string,
			commentId: number,
			reaction: '+1' | '-1' | 'eyes',
		) => Effect.Effect<void, Error>;
		readonly isCollaborator: (owner: string, repo: string, username: string) => Effect.Effect<boolean, Error>;
		readonly commitFileChange: (
			owner: string,
			repo: string,
			path: string,
			content: string,
			sha: string,
			branch: string,
			message: string,
		) => Effect.Effect<void, Error>;
	}
>()('GitHubService') {}

// ── Live implementation ─────────────────────────────────────

export const GitHubServiceLive = Layer.succeed(GitHubService)({
	getPR: (owner: string, repo: string, number: number) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: number });
				return {
					number: pr.number,
					title: pr.title,
					body: pr.body,
					headSha: pr.head.sha,
					headRef: pr.head.ref,
					baseRef: pr.base.ref,
					labels: pr.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
				};
			},
			catch: (e) => new Error(`Failed to get PR: ${e}`),
		}),

	updatePRBody: (owner: string, repo: string, prNumber: number, body: string) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				await octokit.pulls.update({
					owner,
					repo,
					pull_number: prNumber,
					body,
				});
			},
			catch: (e) => new Error(`Failed to update PR body: ${e}`),
		}),

	listChangedFiles: (owner: string, repo: string, prNumber: number) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				const files: ChangedFile[] = [];
				let page = 1;
				while (true) {
					const { data } = await octokit.pulls.listFiles({
						owner,
						repo,
						pull_number: prNumber,
						per_page: 100,
						page,
					});
					if (data.length === 0) break;
					files.push(
						...data.map(
							(f): ChangedFile => ({
								filename: f.filename,
								status: f.status as ChangedFile['status'],
								patch: f.patch,
							}),
						),
					);
					if (data.length < 100) break;
					page++;
				}
				return files;
			},
			catch: (e) => new Error(`Failed to list files: ${e}`),
		}),

	getFileContent: (owner: string, repo: string, path: string, ref: string) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
				if ('content' in data && typeof data.content === 'string') {
					return Buffer.from(data.content, 'base64').toString('utf-8');
				}
				throw new Error(`${path} is not a file`);
			},
			catch: (e) => new Error(`Failed to get file: ${e}`),
		}),

	postReview: (owner: string, repo: string, prNumber: number, commitId: string, comments: ReviewComment[]) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				await octokit.pulls.createReview({
					owner,
					repo,
					pull_number: prNumber,
					commit_id: commitId,
					event: 'COMMENT',
					comments,
				});
			},
			catch: (e) => new Error(`Failed to post review: ${e}`),
		}),

	postComment: (owner: string, repo: string, issueNumber: number, body: string, marker?: string) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				if (marker) {
					const { data: comments } = await octokit.issues.listComments({
						owner,
						repo,
						issue_number: issueNumber,
						per_page: 100,
					});
					const existing = comments.find((c) => c.body?.includes(marker));
					if (existing) {
						await octokit.issues.updateComment({
							owner,
							repo,
							comment_id: existing.id,
							body,
						});
						return;
					}
				}
				await octokit.issues.createComment({
					owner,
					repo,
					issue_number: issueNumber,
					body,
				});
			},
			catch: (e) => new Error(`Failed to post comment: ${e}`),
		}),

	addLabels: (owner: string, repo: string, issueNumber: number, labels: string[]) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				for (const label of labels) {
					try {
						await octokit.issues.getLabel({ owner, repo, name: label });
					} catch {
						const colors: Record<string, string> = {
							'blog-content': '0075ca',
							'draft-post': 'e4e669',
							scheduled: 'a2eeef',
						};
						await octokit.issues.createLabel({
							owner,
							repo,
							name: label,
							color: colors[label] ?? 'ededed',
						});
					}
				}
				await octokit.issues.addLabels({
					owner,
					repo,
					issue_number: issueNumber,
					labels,
				});
			},
			catch: (e) => new Error(`Failed to add labels: ${e}`),
		}),

	removeLabel: (owner: string, repo: string, issueNumber: number, label: string) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				await octokit.issues.removeLabel({
					owner,
					repo,
					issue_number: issueNumber,
					name: label,
				});
			},
			catch: () => new Error(`Failed to remove label ${label}`),
		}),

	reactToComment: (owner: string, repo: string, commentId: number, reaction: '+1' | '-1' | 'eyes') =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				await octokit.reactions.createForIssueComment({
					owner,
					repo,
					comment_id: commentId,
					content: reaction,
				});
			},
			catch: (e) => new Error(`Failed to react: ${e}`),
		}),

	isCollaborator: (owner: string, repo: string, username: string) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				try {
					await octokit.repos.checkCollaborator({ owner, repo, username });
					return true;
				} catch {
					return false;
				}
			},
			catch: () => new Error('Failed to check collaborator'),
		}),

	commitFileChange: (
		owner: string,
		repo: string,
		path: string,
		content: string,
		sha: string,
		branch: string,
		message: string,
	) =>
		Effect.tryPromise({
			try: async () => {
				const octokit = makeOctokit();
				await octokit.repos.createOrUpdateFileContents({
					owner,
					repo,
					path,
					content: Buffer.from(content).toString('base64'),
					sha,
					branch,
					message,
				});
			},
			catch: (e) => new Error(`Failed to commit: ${e}`),
		}),
});

function makeOctokit(): Octokit {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error('GITHUB_TOKEN not set');
	return new Octokit({ auth: token });
}
