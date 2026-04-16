import { Effect } from 'effect';
import { GitHubService } from '../services/github.js';
import { SchemaService } from '../services/schema.js';
import { HyperlinkService } from '../services/hyperlink.js';
import { reviewPR } from './review.js';

// ── Types ───────────────────────────────────────────────────

interface CommandContext {
	owner: string;
	repo: string;
	prNumber: number;
	commentId: number;
	commentBody: string;
	commenter: string;
}

interface CommandResult {
	handled: boolean;
	response?: string;
}

function scheduleDirective(dateStr: string): string {
	return `DO NOT MERGE until ${dateStr} UTC`;
}

export function upsertScheduleDirective(currentBody: string, dateStr: string): string {
	const directive = scheduleDirective(dateStr);
	const marker = /DO NOT MERGE until \d{4}-\d{2}-\d{2}\s*UTC/i;

	if (marker.test(currentBody)) {
		return currentBody.replace(marker, directive);
	}

	const trimmed = currentBody.trimEnd();
	const addition = `⚠️ **${directive}** — Scheduled for auto-merge.`;
	return trimmed.length > 0 ? `${trimmed}\n\n---\n${addition}` : addition;
}

// ── Parse slash commands ────────────────────────────────────

function parseCommand(body: string): { name: string; args: string } | null {
	const match = body.trim().match(/^\/(\w[\w-]*)\s*(.*)$/m);
	if (!match) return null;
	return { name: match[1]!, args: match[2]!.trim() };
}

// ── Command handler ─────────────────────────────────────────

export const handleCommand = (ctx: CommandContext) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);

		// Check if commenter is a collaborator
		const isCollab = yield* github.isCollaborator(ctx.owner, ctx.repo, ctx.commenter);
		if (!isCollab) return { handled: false } satisfies CommandResult;

		const cmd = parseCommand(ctx.commentBody);
		if (!cmd) return { handled: false } satisfies CommandResult;

		// React to acknowledge
		yield* github.reactToComment(ctx.owner, ctx.repo, ctx.commentId, '+1').pipe(Effect.catch(() => Effect.void));

		switch (cmd.name) {
			case 'schedule':
				return yield* handleSchedule(ctx, cmd.args);
			case 'publish':
				return yield* handlePublish(ctx, cmd.args, true);
			case 'draft':
				return yield* handlePublish(ctx, cmd.args, false);
			case 'retitle':
				return yield* handleRetitle(ctx, cmd.args);
			case 'review':
				return yield* handleReview(ctx);
			case 'suggest-links':
				return yield* handleSuggestLinks(ctx);
			default:
				return { handled: false } satisfies CommandResult;
		}
	});

// ── /schedule YYYY-MM-DD ────────────────────────────────────

const handleSchedule = (ctx: CommandContext, dateStr: string) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);

		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
			yield* github.postComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber,
				`⚠️ Invalid date format. Usage: \`/schedule YYYY-MM-DD\``,
			);
			return { handled: true, response: 'Invalid date format' } satisfies CommandResult;
		}

		const pr = yield* github.getPR(ctx.owner, ctx.repo, ctx.prNumber);
		const currentBody = pr.body ?? '';
		const newBody = upsertScheduleDirective(currentBody, dateStr);
		const bodyChanged = newBody !== currentBody;

		if (bodyChanged) {
			yield* github.updatePRBody(ctx.owner, ctx.repo, ctx.prNumber, newBody);
		}

		yield* github.postComment(
			ctx.owner,
			ctx.repo,
			ctx.prNumber,
			`📅 Scheduled for **${dateStr} UTC**. The auto-merge workflow runs daily at 05:00 UTC.\n\n${bodyChanged ? 'PR body updated' : 'PR body already matched'} with: \`${scheduleDirective(dateStr)}\``,
		);

		yield* github.addLabels(ctx.owner, ctx.repo, ctx.prNumber, ['scheduled']);

		return { handled: true, response: `Scheduled for ${dateStr}` } satisfies CommandResult;
	});

// ── /publish [file] and /draft [file] ───────────────────────

const handlePublish = (ctx: CommandContext, fileArg: string, publish: boolean) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);
		const schema = yield* Effect.service(SchemaService);

		const pr = yield* github.getPR(ctx.owner, ctx.repo, ctx.prNumber);
		const files = yield* github.listChangedFiles(ctx.owner, ctx.repo, ctx.prNumber);
		const postFiles = files.filter(
			(f) => f.filename.startsWith('src/posts/') && f.filename.endsWith('.md') && f.status !== 'removed',
		);

		// If a specific file was given, filter to just that
		const targets = fileArg ? postFiles.filter((f) => f.filename.includes(fileArg)) : postFiles;

		if (targets.length === 0) {
			yield* github.postComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber,
				`⚠️ No matching blog post files found${fileArg ? ` for "${fileArg}"` : ''}.`,
			);
			return { handled: true, response: 'No files found' } satisfies CommandResult;
		}

		const verb = publish ? 'published' : 'drafted';
		const updated: string[] = [];

		for (const file of targets) {
			const content = yield* github.getFileContent(ctx.owner, ctx.repo, file.filename, pr.headRef);
			const fm = schema.parseFrontmatter(content);
			if (!fm) continue;

			// Update published field in frontmatter
			const newContent = content.replace(/^(published:\s*)(true|false)/m, `$1${publish}`);

			if (newContent !== content) {
				yield* github.commitFileChange(
					ctx.owner,
					ctx.repo,
					file.filename,
					newContent,
					'',
					pr.headRef,
					`chore: set ${file.filename.split('/').pop()} to ${verb}`,
				);
				updated.push(file.filename.split('/').pop()!);
			}
		}

		if (updated.length > 0) {
			yield* github.postComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber,
				`✅ Set **${updated.length}** post(s) to \`published: ${publish}\`:\n${updated.map((f) => `- ${f}`).join('\n')}`,
			);

			if (publish) {
				yield* github
					.removeLabel(ctx.owner, ctx.repo, ctx.prNumber, 'draft-post')
					.pipe(Effect.catch(() => Effect.void));
			} else {
				yield* github.addLabels(ctx.owner, ctx.repo, ctx.prNumber, ['draft-post']);
			}
		}

		return { handled: true, response: `${updated.length} files ${verb}` } satisfies CommandResult;
	});

// ── /retitle "New Title" [file] ─────────────────────────────

const handleRetitle = (ctx: CommandContext, args: string) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);

		const titleMatch = args.match(/^"([^"]+)"/);
		if (!titleMatch) {
			yield* github.postComment(ctx.owner, ctx.repo, ctx.prNumber, `⚠️ Usage: \`/retitle "New Title" [filename]\``);
			return { handled: true, response: 'Invalid title format' } satisfies CommandResult;
		}

		const newTitle = titleMatch[1]!;
		const fileArg = args.slice(titleMatch[0].length).trim();

		const pr = yield* github.getPR(ctx.owner, ctx.repo, ctx.prNumber);
		const files = yield* github.listChangedFiles(ctx.owner, ctx.repo, ctx.prNumber);
		const postFiles = files.filter(
			(f) => f.filename.startsWith('src/posts/') && f.filename.endsWith('.md') && f.status !== 'removed',
		);

		const targets = fileArg ? postFiles.filter((f) => f.filename.includes(fileArg)) : postFiles.slice(0, 1); // Default to first post

		if (targets.length === 0) {
			yield* github.postComment(ctx.owner, ctx.repo, ctx.prNumber, `⚠️ No matching blog post files found.`);
			return { handled: true, response: 'No files found' } satisfies CommandResult;
		}

		const file = targets[0]!;
		const content = yield* github.getFileContent(ctx.owner, ctx.repo, file.filename, pr.headRef);
		const newContent = content.replace(/^(title:\s*).+$/m, `$1"${newTitle}"`);

		if (newContent !== content) {
			yield* github.commitFileChange(
				ctx.owner,
				ctx.repo,
				file.filename,
				newContent,
				'',
				pr.headRef,
				`chore: retitle ${file.filename.split('/').pop()} to "${newTitle}"`,
			);
			yield* github.postComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber,
				`✅ Retitled **${file.filename.split('/').pop()}** to "${newTitle}"`,
			);
		}

		return { handled: true, response: `Retitled to "${newTitle}"` } satisfies CommandResult;
	});

// ── /review ─────────────────────────────────────────────────

const handleReview = (ctx: CommandContext) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);

		yield* github.postComment(ctx.owner, ctx.repo, ctx.prNumber, '🔄 Re-running AI prose review...');

		yield* reviewPR(ctx.owner, ctx.repo, ctx.prNumber);

		return { handled: true, response: 'Review complete' } satisfies CommandResult;
	});

// ── /suggest-links ──────────────────────────────────────────

const handleSuggestLinks = (ctx: CommandContext) =>
	Effect.gen(function* () {
		const github = yield* Effect.service(GitHubService);
		const hyperlinks = yield* Effect.service(HyperlinkService);

		const pr = yield* github.getPR(ctx.owner, ctx.repo, ctx.prNumber);
		const files = yield* github.listChangedFiles(ctx.owner, ctx.repo, ctx.prNumber);
		const postFiles = files.filter(
			(f) => f.filename.startsWith('src/posts/') && f.filename.endsWith('.md') && f.status !== 'removed',
		);

		const allSuggestions: Array<{ file: string; keyword: string; url: string; line: number }> = [];

		for (const file of postFiles) {
			const content = yield* github.getFileContent(ctx.owner, ctx.repo, file.filename, pr.headSha);
			const bodyStart = content.indexOf('---', 3);
			const body = bodyStart >= 0 ? content.slice(content.indexOf('\n', bodyStart) + 1) : content;

			const suggestions = yield* hyperlinks.findUnlinkedKeywords(body);
			for (const s of suggestions) {
				allSuggestions.push({
					file: file.filename.split('/').pop()!,
					keyword: s.keyword,
					url: s.url,
					line: s.line,
				});
			}
		}

		if (allSuggestions.length === 0) {
			yield* github.postComment(
				ctx.owner,
				ctx.repo,
				ctx.prNumber,
				'✅ No unlinked keywords found — all key terms are already linked!',
			);
		} else {
			const body =
				`### 🔗 Hyperlink Suggestions\n\nFound **${allSuggestions.length}** unlinked keyword(s):\n\n` +
				allSuggestions
					.map((s) => `- **${s.file}** line ${s.line}: \`${s.keyword}\` → \`[${s.keyword}](${s.url})\``)
					.join('\n');
			yield* github.postComment(ctx.owner, ctx.repo, ctx.prNumber, body);
		}

		return { handled: true, response: `${allSuggestions.length} suggestions` } satisfies CommandResult;
	});
