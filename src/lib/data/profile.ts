// Profile facts for the /about page (R53). static/profile/ is synced from
// @spear_resumes//profile (bazel run //static/profile:sync_profile); never
// hand-edit it. Every claim string rendered from here is facts.json data.
import facts from '../../../static/profile/facts.json';

export type ProfileFacts = typeof facts;
export type ProfileRole = ProfileFacts['roles'][number];
export type ProfileVenture = ProfileFacts['ventures'][number];
export type ProfileProject = ProfileFacts['projects'][number];
export type ProfileUpstream = ProfileFacts['merged_upstream'][number];
export type ProfileRelation = ProfileFacts['relations'][number];
export type ProfilePublication = ProfileFacts['publications'][number];
export type ProfileLink = ProfileFacts['links'][number];
export type ProfileImage = ProfileFacts['images'][number];

export const profile: ProfileFacts = facts;

const PROFILE_BASE = '/profile';

/** Public URL for a facts-relative asset path such as "svg/timeline-light.svg". */
export function profileAsset(rel: string): string {
	return `${PROFILE_BASE}/${rel}`;
}

/** Light/dark pair for a synced chart, e.g. svgPair('project-map'). */
export function svgPair(name: string): { light: string; dark: string } {
	const light = `svg/${name}-light.svg`;
	const dark = `svg/${name}-dark.svg`;
	if (!profile.svgs.includes(light) || !profile.svgs.includes(dark)) {
		throw new Error(`profile facts carry no ${name} light/dark SVG pair`);
	}
	return { light: profileAsset(light), dark: profileAsset(dark) };
}

export function imageForSlot(slot: string): ProfileImage | undefined {
	return profile.images.find((img) => img.slot === slot);
}

/** "2024–present", "2017–2021", or a bare "ongoing" for an undated row (R37). */
export function period(item: { start?: number | string; end?: number | string }): string {
	const { start, end } = item;
	if (start === undefined || start === null) return end === undefined ? '' : String(end);
	if (end === undefined || end === null) return String(start);
	return `${start}–${end}`;
}

export type ProjectRow = { label: string; urls: string[] };
export type ProjectGroup = { id: string; label: string; rows: ProjectRow[] };

/** Projects grouped by taxonomy order; rows sharing a label collapse into one. */
export function projectGroups(): ProjectGroup[] {
	return profile.taxonomy.map((cat) => {
		const rows: ProjectRow[] = [];
		for (const p of profile.projects.filter((p) => p.category === cat.id)) {
			let row = rows.find((r) => r.label === p.label);
			if (!row) {
				row = { label: p.label, urls: [] };
				rows.push(row);
			}
			if (p.url) row.urls.push(p.url);
		}
		return { id: cat.id, label: cat.label, rows };
	});
}

/** The current role for JSON-LD: the first role still running. */
export function currentRole(): ProfileRole {
	return profile.roles.find((r) => r.end === 'present') ?? profile.roles[0];
}

/**
 * Person sameAs: the facts links that identify the person, excluding this
 * site, mail, and the ventures' own sites and orgs.
 */
export function personSameAs(): string[] {
	const ventureUrls = new Set(
		profile.ventures.flatMap((v) => [('url' in v ? v.url : undefined), ('github' in v ? v.github : undefined)]).filter(Boolean),
	);
	return profile.links
		.map((l) => l.url)
		.filter((u) => /^https:\/\//.test(u) && !u.startsWith('https://transscendsurvival.org') && !ventureUrls.has(u));
}
