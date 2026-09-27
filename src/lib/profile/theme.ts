import tokens from './xoxd-palette.json';

export const PROFILE_THEME_SOURCE = tokens.source_commit;
export const CATEGORY_STYLE: Record<
	string,
	{ family: keyof typeof tokens.palette; light: string; dark: string; shape: string }
> = {
	'applied-ml': { family: 'primary', light: '500', dark: '400', shape: 'circle' },
	'kernel-security': { family: 'tertiary', light: '600', dark: '300', shape: 'diamond' },
	'compilers-hpc': { family: 'secondary', light: '600', dark: '300', shape: 'triangle' },
	systems: { family: 'success', light: '600', dark: '300', shape: 'square' },
	'build-infra': { family: 'warning', light: '700', dark: '300', shape: 'hexagon' },
	'sdlc-automation': { family: 'error', light: '600', dark: '300', shape: 'triangle-down' },
	'web-product': { family: 'secondary', light: '800', dark: '500', shape: 'plus' },
	'gis-fabrication': { family: 'tertiary', light: '800', dark: '500', shape: 'star' },
};
export function categoryStyle(id: string): string {
	const style = CATEGORY_STYLE[id];
	if (!style) return '--category-light:var(--profile-ink);--category-dark:var(--profile-ink)';
	const palette = tokens.palette[style.family] as Record<string, string>;
	return `--category-light:${palette[style.light]};--category-dark:${palette[style.dark]}`;
}
