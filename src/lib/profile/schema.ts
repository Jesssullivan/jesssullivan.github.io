import { z } from 'zod';

/** Public projection only. Claims and visibility are authorized by the producer law gate. */
export const PROFILE_V1_SCHEMA = 'profile.v1';
export const PROFILE_METRIC = '0.6*cosine(tfidf)+0.4*jaccard(topics,languages)';
export const PROFILE_DISTANCE = `precomputed dissimilarity: 1 - (${PROFILE_METRIC})`;
const Text = z.string().min(1);
const Unit = z.number().finite().min(0).max(1);
const Int = z.number().int().nonnegative();
const Year = z.number().int().min(1900).max(9999);
const End = z.union([Year, z.enum(['present', 'ongoing'])]);
export const CoverageSchema = z.enum(['complete', 'partial', 'unavailable']);
function validDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const IsoDate = Text.refine(validDate, 'real calendar date (YYYY-MM-DD)');
const Timestamp = Text.refine(
	(v) =>
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v) &&
		validDate(v.slice(0, 10)) &&
		Number(v.slice(11, 13)) < 24 &&
		Number(v.slice(14, 16)) < 60 &&
		Number(v.slice(17, 19)) < 60,
	'UTC timestamp',
);
const YearMonth = Text.refine((v) => /^\d{4}-\d{2}$/.test(v) && validDate(`${v}-01`), 'real year-month');
function safeHttps(value: string): boolean {
	if (!value.startsWith('https://') || /[\s\\\x00-\x1f\x7f]/.test(value)) return false;
	try {
		const url = new URL(value);
		return !!url.hostname && !url.username && !url.password && (!url.port || url.port === '443');
	} catch {
		return false;
	}
}
const Https = Text.refine(safeHttps, 'credential-free HTTPS URL');
const RepoId = Text.regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
export const RepoSchema = z
	.object({
		id: Text.regex(/^r-[0-9a-f]{16}$/),
		label: Text,
		category: Text,
		category_inferred: z.boolean(),
		link: Https.regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).nullable(),
		archived: z.boolean(),
		x: Unit,
		y: Unit,
		langs: z.record(Text, Unit),
		updated: IsoDate,
	})
	.strict();
export const EdgeSchema = z.object({ a: Text, b: Text, w: Unit }).strict();
export const CategorySchema = z.object({ id: Text, label: Text }).strict();
export const MergedUpstreamSchema = z
	.object({
		project: Text,
		repo: RepoId,
		number: z.number().int().positive(),
		merged: IsoDate,
		relation: z.enum(['committer', 'contributor', 'engagement']),
	})
	.strict();
export const LanguageMonthsSchema = z
	.object({
		language: Text,
		months: z.array(
			z.object({ ym: YearMonth, active_days: Int.max(31).nullable(), coverage: CoverageSchema }).strict(),
		),
	})
	.strict();
const ACTIVITY_KINDS = ['commit', 'pr', 'review', 'issue'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ActivitySchema = z
	.object({
		from: IsoDate,
		to: IsoDate,
		days: z.array(
			z
				.object({
					date: IsoDate,
					commit: z.boolean().nullable(),
					pr: z.boolean().nullable(),
					review: z.boolean().nullable(),
					issue: z.boolean().nullable(),
				})
				.strict(),
		),
		unit: z.literal('public active days'),
	})
	.strict();
const Attribution = z.object({ unit: z.literal('public active days'), attribution: Text }).strict();
export const MethodsSchema = z
	.object({
		embedding: z
			.object({
				algorithm: z.enum(['tsne', 'degenerate']),
				metric: z.literal(PROFILE_DISTANCE),
				dimensions: z.literal(2),
				seed: z.literal(20260926),
				perplexity: z.number().finite().nonnegative(),
				iterations: Int,
			})
			.strict(),
		edges: z.object({ algorithm: z.literal('knn'), metric: z.literal(PROFILE_METRIC), k: z.literal(3) }).strict(),
		activity: Attribution,
		languages: Attribution,
	})
	.strict();
const Role = z
	.object({ org: Text, title: Text, summary: Text, bullets: z.array(Text), start: Year, end: End })
	.strict();
const Venture = z
	.object({
		name: Text,
		description: Text,
		start: Year.optional(),
		end: End,
		role: Text.optional(),
		url: Https.optional(),
		github: Https.optional(),
		product: Text.optional(),
		product_line: Text.optional(),
		product_verb: Text.optional(),
		infra: Text.optional(),
	})
	.strict();
const Publication = z
	.object({ authors: Text, title: Text, year: Year, venue: Text.optional(), url: Https.optional() })
	.strict();
const Link = z
	.object({ label: Text, url: Text.refine((v) => v === 'mailto:jess@sulliwood.org' || safeHttps(v), 'public link') })
	.strict();
const Image = z
	.object({
		alt: Text,
		file: Text.regex(/^[A-Za-z0-9_.-]+\.(png|jpg|jpeg|webp|svg)$/),
		slot: z.enum(['banner', 'links', 'closing']),
		src: Text.regex(/^img\/[A-Za-z0-9_.-]+\.(png|jpg|jpeg|webp|svg)$/),
		src_dark: Text.regex(/^img\/[A-Za-z0-9_.-]+\.(png|jpg|jpeg|webp|svg)$/).optional(),
		url: Https.optional(),
	})
	.strict();
const Identity = z
	.object({
		name: Text,
		headline: Text,
		email: z.literal('jess@sulliwood.org'),
		location: Text,
		summary: Text,
		always_building: Text,
		taglines: z.array(Text),
	})
	.strict();
export const ProfileV1Schema = z
	.object({
		schema: z.literal(PROFILE_V1_SCHEMA),
		generated_at: Timestamp,
		fetched_at: Timestamp,
		data_changed_at: Timestamp,
		source_commit: Text.regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/),
		corpus_sha256: Text.regex(/^[0-9a-f]{64}$/),
		repos: z.array(RepoSchema),
		edges: z.array(EdgeSchema),
		categories: z.array(CategorySchema),
		merged_upstream: z.array(MergedUpstreamSchema),
		language_months: z.array(LanguageMonthsSchema),
		activity: ActivitySchema,
		coverage: z
			.object({ activity: CoverageSchema, languages: CoverageSchema, repos: CoverageSchema, upstream: CoverageSchema })
			.strict(),
		coverage_details: z
			.array(
				z
					.object({
						scope: z.enum(['activity', 'languages', 'repos', 'upstream']),
						from: IsoDate.optional(),
						to: IsoDate.optional(),
						reason: Text,
					})
					.strict(),
			)
			.optional(),
		methods: MethodsSchema,
		roles: z.array(Role).optional(),
		ventures: z.array(Venture).optional(),
		community: z.array(Text).optional(),
		publications: z.array(Publication).optional(),
		links: z.array(Link).optional(),
		images: z.array(Image).optional(),
		identity: Identity.optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
		const unique = (values: string[], path: string) => {
			if (new Set(values).size !== values.length) issue([path], 'duplicate records');
		};
		const ids = data.repos.map((r) => r.id),
			categories = data.categories.map((c) => c.id);
		unique(ids, 'repos');
		unique(categories, 'categories');
		for (const repo of data.repos) {
			if (!categories.includes(repo.category)) issue(['repos'], 'unknown category');
			const shares = Object.values(repo.langs);
			if (shares.length && Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 1e-6)
				issue(['repos'], 'language shares must sum to one');
		}
		for (const edge of data.edges)
			if (!ids.includes(edge.a) || !ids.includes(edge.b) || edge.a === edge.b) issue(['edges'], 'invalid endpoint');
		unique(
			data.edges.map((e) => JSON.stringify([e.a, e.b].sort())),
			'edges',
		);
		unique(
			data.merged_upstream.map((r) => `${r.repo}#${r.number}`),
			'merged_upstream',
		);
		const activity = data.activity,
			start = Date.parse(`${activity.from}T00:00:00Z`),
			end = Date.parse(`${activity.to}T00:00:00Z`);
		if (end < start) issue(['activity'], 'reversed range');
		if (activity.days.length !== (end - start) / 86400000 + 1)
			issue(['activity', 'days'], 'must cover inclusive date range');
		for (const [index, day] of activity.days.entries()) {
			const expected = new Date(start + index * 86400000);
			if (!Number.isFinite(expected.getTime()) || day.date !== expected.toISOString().slice(0, 10))
				issue(['activity', 'days'], 'dates must be ordered and contiguous');
		}
		const observations = activity.days.flatMap((day) => ACTIVITY_KINDS.map((kind) => day[kind]));
		if (data.coverage.activity === 'complete' && observations.some((v) => v === null))
			issue(['coverage', 'activity'], 'complete coverage cannot contain unknown days');
		if (data.coverage.activity === 'unavailable' && observations.some((v) => v !== null))
			issue(['coverage', 'activity'], 'unavailable coverage cannot contain observations');
		unique(
			data.language_months.map((row) => row.language),
			'language_months',
		);
		let axis: string | undefined;
		for (const row of data.language_months) {
			const months = row.months.map((m) => m.ym),
				serialized = JSON.stringify(months);
			if (serialized !== JSON.stringify([...new Set(months)].sort()))
				issue(['language_months'], 'months must be unique and ordered');
			if (axis !== undefined && axis !== serialized)
				issue(['language_months'], 'language rows must share a month axis');
			axis = serialized;
			for (const month of row.months) {
				const [year, number] = month.ym.split('-').map(Number);
				const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
				const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][number - 1];
				if (month.active_days !== null && month.active_days > days)
					issue(['language_months'], 'active days exceed calendar month');
				if ((month.active_days === null) !== (month.coverage === 'unavailable'))
					issue(['language_months'], 'null must mean unavailable coverage');
				if (
					(data.coverage.languages === 'complete' && month.coverage !== 'complete') ||
					(data.coverage.languages === 'unavailable' && month.coverage !== 'unavailable')
				)
					issue(['coverage', 'languages'], 'inconsistent month coverage');
			}
		}
		for (const detail of data.coverage_details ?? [])
			if (detail.from && detail.to && detail.from > detail.to) issue(['coverage_details'], 'reversed range');
		for (const section of ['roles', 'ventures'] as const)
			for (const row of data[section] ?? [])
				if (row.start !== undefined && typeof row.end === 'number' && row.start > row.end)
					issue([section], 'reversed years');
		if (
			Date.parse(data.fetched_at) > Date.parse(data.generated_at) ||
			Date.parse(data.data_changed_at) > Date.parse(data.generated_at)
		)
			issue([], 'timestamps cannot be after generation');
		if (activity.to > data.fetched_at.slice(0, 10)) issue(['activity', 'to'], 'activity cannot be in the future');
		if (
			data.methods.embedding.algorithm === 'tsne' &&
			!(data.methods.embedding.perplexity > 0 && data.methods.embedding.perplexity < ids.length)
		)
			issue(['methods', 'embedding'], 't-SNE perplexity must be positive and below repository count');
	});
export type ProfileV1 = z.infer<typeof ProfileV1Schema>;
export type ProfileRepo = z.infer<typeof RepoSchema>;
export type ProfileEdge = z.infer<typeof EdgeSchema>;
export type ProfileCategory = z.infer<typeof CategorySchema>;
export type ProfileMergedUpstream = z.infer<typeof MergedUpstreamSchema>;
export type ProfileLanguageMonths = z.infer<typeof LanguageMonthsSchema>;
export type ProfileActivity = z.infer<typeof ActivitySchema>;
export function parseProfileV1(data: unknown): ProfileV1 {
	return ProfileV1Schema.parse(data);
}
export function upstreamUrl(row: ProfileMergedUpstream): string {
	return `https://github.com/${row.repo}/pull/${row.number}`;
}
export function topLanguages(repo: ProfileRepo, n = 3): { name: string; share: number }[] {
	return Object.entries(repo.langs)
		.map(([name, share]) => ({ name, share }))
		.sort((a, b) => b.share - a.share)
		.slice(0, n);
}
