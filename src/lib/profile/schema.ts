import { z } from 'zod';

/**
 * profile.v1: the hourly dataset behind /projects and the /about charts
 * (Profile v2 plan, 2026-09-26, R74-R80). The server (spear_resumes
 * profile/refresh) is the producer; this file is the consumer's contract.
 *
 * Numbers: every position and series value is a share in [0, 1]. The only
 * integers allowed above 1 are `repos` (a language's repo tally, shown as a
 * heatmap row annotation and never as a headline), `months_active` on a
 * repo, and PR `number`. No key anywhere may match the vanity-counter
 * pattern (R72/R79).
 */
export const PROFILE_V1_SCHEMA = 'profile.v1';

export const FORBIDDEN_KEY = /count|total|star|fork_count|watch|bytes|size/i;
const INTEGER_KEYS = new Set(['repos', 'months_active', 'number']);

const Unit = z.number().min(0).max(1);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/, 'ISO date');
const YearMonth = z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM');
const Id = z.string().min(1);

export const RepoSchema = z
	.object({
		id: Id,
		label: z.string().min(1),
		category: Id,
		category_inferred: z.boolean().optional(),
		link: z.string().url().nullable(),
		archived: z.boolean().optional(),
		x: Unit,
		y: Unit,
		x_prev: Unit.optional(),
		y_prev: Unit.optional(),
		langs: z.record(z.string().min(1), Unit),
		months_active: z.number().int().min(0),
		updated: IsoDate,
	})
	.strict();

export const EdgeSchema = z.object({ a: Id, b: Id, w: Unit }).strict();

export const CategorySchema = z.object({ id: Id, label: z.string().min(1) }).strict();

export const MergedUpstreamSchema = z
	.object({
		project: z.string().min(1),
		repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
		number: z.number().int().positive(),
		merged: IsoDate,
		relation: z.string(),
	})
	.strict();

export const LanguageMonthsSchema = z
	.object({
		language: z.string().min(1),
		repos: z.number().int().min(0),
		months: z.array(z.object({ ym: YearMonth, share: Unit }).strict()),
	})
	.strict();

const ACTIVITY_KINDS = ['commit', 'pr', 'review', 'issue'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ActivitySchema = z
	.object({
		from: IsoDate,
		to: IsoDate,
		weeks: z.array(z.array(Unit).length(7)),
		by_kind: z.object({
			commit: z.array(Unit),
			pr: z.array(Unit),
			review: z.array(Unit),
			issue: z.array(Unit),
		}),
	})
	.strict()
	.superRefine((activity, ctx) => {
		for (const kind of ACTIVITY_KINDS) {
			if (activity.by_kind[kind].length !== activity.weeks.length) {
				ctx.addIssue({ code: 'custom', path: ['by_kind', kind], message: `by_kind.${kind} must have one value per week` });
			}
		}
	});

// The prose sections (/about still renders these from facts.json today); kept
// loose so the dataset can carry them without the blog depending on their shape.
const Loose = z.array(z.record(z.string(), z.unknown()));

export const ProfileV1Schema = z
	.object({
		schema: z.literal(PROFILE_V1_SCHEMA),
		generated_at: IsoDate,
		data_changed_at: IsoDate,
		corpus_sha256: z.string().regex(/^[0-9a-f]{64}$/),
		source_commit: z.string().min(1),
		fetched_at: IsoDate,
		repos: z.array(RepoSchema).min(1),
		edges: z.array(EdgeSchema),
		categories: z.array(CategorySchema).min(1),
		merged_upstream: z.array(MergedUpstreamSchema),
		language_months: z.array(LanguageMonthsSchema),
		activity: ActivitySchema,
		roles: Loose.optional(),
		ventures: Loose.optional(),
		community: z.array(z.string()).optional(),
		publications: Loose.optional(),
		links: Loose.optional(),
		images: Loose.optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		const ids = new Set<string>();
		for (const [i, repo] of data.repos.entries()) {
			if (ids.has(repo.id)) ctx.addIssue({ code: 'custom', path: ['repos', i, 'id'], message: `duplicate repo id ${repo.id}` });
			ids.add(repo.id);
		}
		const categories = new Set(data.categories.map((c) => c.id));
		for (const [i, repo] of data.repos.entries()) {
			if (!categories.has(repo.category)) {
				ctx.addIssue({ code: 'custom', path: ['repos', i, 'category'], message: `category ${repo.category} is not in the taxonomy` });
			}
		}
		for (const [i, edge] of data.edges.entries()) {
			if (!ids.has(edge.a)) ctx.addIssue({ code: 'custom', path: ['edges', i, 'a'], message: `edge references unknown repo ${edge.a}` });
			if (!ids.has(edge.b)) ctx.addIssue({ code: 'custom', path: ['edges', i, 'b'], message: `edge references unknown repo ${edge.b}` });
			if (edge.a === edge.b) ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'self edge' });
		}
	});

export type ProfileV1 = z.infer<typeof ProfileV1Schema>;
export type ProfileRepo = z.infer<typeof RepoSchema>;
export type ProfileEdge = z.infer<typeof EdgeSchema>;
export type ProfileCategory = z.infer<typeof CategorySchema>;
export type ProfileMergedUpstream = z.infer<typeof MergedUpstreamSchema>;
export type ProfileLanguageMonths = z.infer<typeof LanguageMonthsSchema>;
export type ProfileActivity = z.infer<typeof ActivitySchema>;

/**
 * Walks the raw object before schema parsing: any key matching the vanity
 * pattern, or any integer above 1 outside the three permitted keys, is a
 * violation. Returns the offending paths.
 */
export function findForbiddenKeys(value: unknown, path: string[] = [], out: string[] = []): string[] {
	if (Array.isArray(value)) {
		value.forEach((v, i) => findForbiddenKeys(v, [...path, String(i)], out));
		return out;
	}
	if (value !== null && typeof value === 'object') {
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			const here = [...path, key];
			if (FORBIDDEN_KEY.test(key)) out.push(`${here.join('.')} (forbidden key)`);
			if (typeof v === 'number' && Number.isInteger(v) && v > 1 && !INTEGER_KEYS.has(key)) {
				out.push(`${here.join('.')} (integer ${v} outside repos/months_active/number)`);
			}
			findForbiddenKeys(v, here, out);
		}
	}
	return out;
}

/** Parses an unknown payload into a validated profile.v1 dataset or throws. */
export function parseProfileV1(data: unknown): ProfileV1 {
	// The language series may arrive under either name; normalize before the
	// strict parse so the blog exposes one key.
	if (data && typeof data === 'object' && 'languages' in data && !('language_months' in data)) {
		const { languages, ...rest } = data as Record<string, unknown>;
		data = { ...rest, language_months: languages };
	}
	const forbidden = findForbiddenKeys(data);
	if (forbidden.length > 0) {
		throw new Error(`profile.v1 carries forbidden fields: ${forbidden.join(', ')}`);
	}
	return ProfileV1Schema.parse(data);
}

/** GitHub PR URL for a merged_upstream row. */
export function upstreamUrl(row: ProfileMergedUpstream): string {
	return `https://github.com/${row.repo}/pull/${row.number}`;
}

/** Top-n languages of a repo by share, descending. */
export function topLanguages(repo: ProfileRepo, n = 3): { name: string; share: number }[] {
	return Object.entries(repo.langs)
		.map(([name, share]) => ({ name, share }))
		.sort((a, b) => b.share - a.share)
		.slice(0, n);
}
