import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// R141 + review of #288: the eight category colours are fixed, but the map
// stage background follows the site theme (--pm-bg = surface-50 light,
// surface-950 dark). Every slot must clear WCAG 3:1 (non-text contrast)
// against every theme's stage background in both modes.

const component = readFileSync(new URL('./ProjectMap.svelte', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const skeletonThemes = join(dirname(require.resolve('@skeletonlabs/skeleton/package.json')), 'src', 'themes');
const themeFiles: Record<string, string> = {
	pine: join(skeletonThemes, 'pine.css'),
	rose: join(skeletonThemes, 'rose.css'),
	catppuccin: join(skeletonThemes, 'catppuccin.css'),
	pride: new URL('../../styles/themes/pride.css', import.meta.url).pathname,
	trans: new URL('../../styles/themes/trans.css', import.meta.url).pathname,
};

function block(selector: string): string {
	const start = component.indexOf(selector);
	expect(start, selector).toBeGreaterThanOrEqual(0);
	return component.slice(start, component.indexOf('}', start));
}

function palette(css: string): string[] {
	return Array.from({ length: 8 }, (_, i) => {
		const match = css.match(new RegExp(`--pm-cat-${i}:\\s*(#[0-9a-fA-F]{6})`));
		expect(match, `--pm-cat-${i}`).not.toBeNull();
		return match![1];
	});
}

const light = palette(block('\t.pm {'));
const dark = palette(block(":global([data-mode='dark']) .pm {"));

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
	return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
}

/** oklch(L% C Hdeg) to clamped sRGB in [0, 1]. */
function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
	const h = (hDeg * Math.PI) / 180;
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const lin = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	];
	return lin.map((v) => {
		const x = Math.min(1, Math.max(0, v));
		return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
	}) as Rgb;
}

function surface(theme: string, shade: 50 | 950): Rgb {
	const css = readFileSync(themeFiles[theme], 'utf8');
	const match = css.match(
		new RegExp(`--color-surface-${shade}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)(?:deg)?\\)`),
	);
	expect(match, `${theme} surface-${shade}`).not.toBeNull();
	return oklchToRgb(Number(match![1]) / 100, Number(match![2]), Number(match![3]));
}

function luminance([r, g, b]: Rgb): number {
	const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

function linear(v: number): number {
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function oklab(rgb: Rgb): Rgb {
	const [r, g, b] = rgb.map(linear);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

// Machado, Oliveira and Fernandes (2009) full-severity simulation matrices,
// applied in linear sRGB.
const CVD: Record<string, number[][]> = {
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

function simulate(rgb: Rgb, matrix: number[][]): Rgb {
	const lin = rgb.map(linear);
	return matrix.map((row) => {
		const v = Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
		return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
	}) as Rgb;
}

function minSeparation(colours: string[], transform: (rgb: Rgb) => Rgb): number {
	const labs = colours.map((hex) => oklab(transform(hexToRgb(hex))));
	let min = Infinity;
	for (let i = 0; i < labs.length; i++)
		for (let j = i + 1; j < labs.length; j++) min = Math.min(min, Math.hypot(...labs[i].map((v, k) => v - labs[j][k])));
	return min;
}

describe('project map category palette (R141)', () => {
	for (const [mode, colours] of [
		['light', light],
		['dark', dark],
	] as const) {
		it(`keeps every ${mode} pair apart under simulated colour-vision deficiency`, () => {
			expect(minSeparation(colours, (rgb) => rgb)).toBeGreaterThanOrEqual(0.08);
			for (const matrix of Object.values(CVD)) {
				expect(minSeparation(colours, (rgb) => simulate(rgb, matrix))).toBeGreaterThanOrEqual(0.055);
			}
		});
	}

	it('has eight distinct fixed colours per mode', () => {
		expect(new Set(light.map((c) => c.toLowerCase())).size).toBe(8);
		expect(new Set(dark.map((c) => c.toLowerCase())).size).toBe(8);
	});

	for (const theme of Object.keys(themeFiles)) {
		it(`clears 3:1 on the ${theme} stage in light and dark`, () => {
			const failures: string[] = [];
			for (const [mode, colours, bg] of [
				['light', light, surface(theme, 50)],
				['dark', dark, surface(theme, 950)],
			] as const) {
				colours.forEach((hex, i) => {
					const ratio = contrast(hexToRgb(hex), bg);
					if (ratio < 3) failures.push(`${mode} --pm-cat-${i} ${hex}: ${ratio.toFixed(2)}:1`);
				});
			}
			expect(failures).toEqual([]);
		});
	}
});
