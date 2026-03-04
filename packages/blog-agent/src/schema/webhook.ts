import { Schema } from "effect"

// ── GitHub webhook payload schemas ──────────────────────────

export const GitHubUser = Schema.Struct({
	login: Schema.String,
	id: Schema.Number,
})

export const GitHubLabel = Schema.Struct({
	name: Schema.String,
	color: Schema.optional(Schema.String),
})

export const GitHubPullRequest = Schema.Struct({
	number: Schema.Number,
	title: Schema.String,
	body: Schema.NullOr(Schema.String),
	state: Schema.Literals(["open", "closed"]),
	draft: Schema.optional(Schema.Boolean),
	head: Schema.Struct({
		sha: Schema.String,
		ref: Schema.String,
	}),
	base: Schema.Struct({
		ref: Schema.String,
	}),
	user: GitHubUser,
	labels: Schema.Array(GitHubLabel),
})

export type GitHubPullRequest = typeof GitHubPullRequest.Type

export const PullRequestEvent = Schema.Struct({
	action: Schema.String,
	pull_request: GitHubPullRequest,
	repository: Schema.Struct({
		owner: Schema.Struct({ login: Schema.String }),
		name: Schema.String,
		full_name: Schema.String,
	}),
})

export type PullRequestEvent = typeof PullRequestEvent.Type

export const IssueCommentEvent = Schema.Struct({
	action: Schema.Literals(["created", "edited", "deleted"]),
	comment: Schema.Struct({
		id: Schema.Number,
		body: Schema.String,
		user: GitHubUser,
	}),
	issue: Schema.Struct({
		number: Schema.Number,
		pull_request: Schema.optional(Schema.Struct({
			url: Schema.String,
		})),
	}),
	repository: Schema.Struct({
		owner: Schema.Struct({ login: Schema.String }),
		name: Schema.String,
	}),
})

export type IssueCommentEvent = typeof IssueCommentEvent.Type

// ── Repository dispatch (from source repos) ─────────────────

export const RepositoryDispatchEvent = Schema.Struct({
	action: Schema.String,
	client_payload: Schema.Struct({
		source_repo: Schema.optional(Schema.String),
	}),
	repository: Schema.Struct({
		owner: Schema.Struct({ login: Schema.String }),
		name: Schema.String,
	}),
})

export type RepositoryDispatchEvent = typeof RepositoryDispatchEvent.Type
