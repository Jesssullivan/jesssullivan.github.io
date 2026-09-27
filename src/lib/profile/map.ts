import type { ProfileV1 } from './schema';
import { CATEGORY_STYLE } from './theme';
export type Project = ProfileV1['repos'][number];
export const MAP_SIZE = 720;
export const MAP_PADDING = 38;
export function point(repo: Pick<Project, 'x' | 'y'>): { x: number; y: number } {
	const scale = MAP_SIZE - 2 * MAP_PADDING;
	return { x: MAP_PADDING + repo.x * scale, y: MAP_PADDING + repo.y * scale };
}
export function neighbors(profile: ProfileV1, id: string): { repo: Project; similarity: number }[] {
	const byId = new Map(profile.repos.map((repo) => [repo.id, repo]));
	return profile.edges
		.filter((edge) => edge.a === id || edge.b === id)
		.map((edge) => ({ repo: byId.get(edge.a === id ? edge.b : edge.a)!, similarity: edge.w }))
		.sort((a, b) => b.similarity - a.similarity || a.repo.label.localeCompare(b.repo.label));
}
/** Arrow movement follows screen direction; taxonomy never moves or regroups points. */
export function directionalNeighbor(rows: Project[], current: Project, key: string): Project {
	const direction: Record<string, [number, number]> = {
		ArrowLeft: [-1, 0],
		ArrowRight: [1, 0],
		ArrowUp: [0, -1],
		ArrowDown: [0, 1],
	};
	const axis = direction[key];
	if (!axis) return current;
	const candidates = rows
		.filter((r) => r.id !== current.id)
		.map((repo) => {
			const dx = repo.x - current.x,
				dy = repo.y - current.y,
				forward = dx * axis[0] + dy * axis[1];
			return {
				repo,
				forward,
				score: Math.hypot(dx, dy) * (1 + (2 * Math.abs(dx * axis[1] - dy * axis[0])) / Math.max(forward, 1e-9)),
			};
		})
		.filter((r) => r.forward > 1e-9)
		.sort((a, b) => a.score - b.score || a.repo.id.localeCompare(b.repo.id));
	return candidates[0]?.repo ?? current;
}
/** Equal fill area for each category shape: point size does not encode a score. */
export function markerPath(category: string, radius = 6): string {
	const kind = CATEGORY_STYLE[category]?.shape ?? 'circle';
	if (kind === 'circle')
		return `M-${radius} 0A${radius} ${radius} 0 1 0 ${radius} 0A${radius} ${radius} 0 1 0 -${radius} 0Z`;
	let points: [number, number][] = [];
	if (kind === 'square')
		points = [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1],
		];
	else if (kind === 'diamond')
		points = [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0],
		];
	else if (kind.startsWith('triangle')) {
		const sign = kind === 'triangle' ? 1 : -1;
		points = [
			[0, -sign],
			[Math.sqrt(3) / 2, sign / 2],
			[-Math.sqrt(3) / 2, sign / 2],
		];
	} else if (kind === 'hexagon')
		points = Array.from({ length: 6 }, (_, i) => [
			Math.cos(Math.PI / 6 + (i * Math.PI) / 3),
			Math.sin(Math.PI / 6 + (i * Math.PI) / 3),
		]);
	else if (kind === 'star')
		points = Array.from({ length: 10 }, (_, i) => [
			(i % 2 ? 0.44 : 1) * Math.cos(-Math.PI / 2 + (i * Math.PI) / 5),
			(i % 2 ? 0.44 : 1) * Math.sin(-Math.PI / 2 + (i * Math.PI) / 5),
		]);
	else {
		const a = 0.35;
		points = [
			[-a, -1],
			[a, -1],
			[a, -a],
			[1, -a],
			[1, a],
			[a, a],
			[a, 1],
			[-a, 1],
			[-a, a],
			[-1, a],
			[-1, -a],
			[-a, -a],
		];
	}
	const area =
		Math.abs(
			points.reduce(
				(sum, [x, y], i) => sum + x * points[(i + 1) % points.length][1] - y * points[(i + 1) % points.length][0],
				0,
			),
		) / 2;
	const scale = radius * Math.sqrt(Math.PI / area);
	return 'M' + points.map(([x, y]) => `${(x * scale).toFixed(6)} ${(y * scale).toFixed(6)}`).join('L') + 'Z';
}
export function visibleProjects(profile: ProfileV1, query: string, category: string): Project[] {
	const needle = query.trim().toLocaleLowerCase();
	return profile.repos.filter(
		(repo) =>
			(!category || repo.category === category) &&
			(!needle || [repo.label, ...Object.keys(repo.langs)].join(' ').toLocaleLowerCase().includes(needle)),
	);
}
