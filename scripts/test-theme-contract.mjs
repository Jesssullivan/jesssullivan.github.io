import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// TIN-604: Skeleton v5 theme token contract for the pride and trans themes.
// Fails when a required token is removed, renamed, emptied, or given a value
// that no longer parses as CSS color syntax, and when the two theme files
// drift out of token-name parity with each other.

const THEMES = ['pride', 'trans'];
const COLOR_FAMILIES = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error', 'surface'];
const COLOR_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const TYPO_BASE_PROPERTIES = [
	'color-light',
	'color-dark',
	'font-family',
	'font-size',
	'line-height',
	'font-weight',
	'font-style',
	'letter-spacing',
	'font-stretch',
	'font-kerning',
	'text-shadow',
	'word-spacing',
	'hyphens',
	'text-transform',
];
const TYPO_HEADING_PROPERTIES = TYPO_BASE_PROPERTIES.filter(
	(property) => property !== 'font-size' && property !== 'line-height',
);
const TEXT_DECORATION_PROPERTIES = [
	'text-decoration-line',
	'text-decoration-style',
	'text-decoration-color',
	'text-decoration-thickness',
	'text-underline-offset',
	'text-underline-position',
];
const TYPO_ANCHOR_PROPERTIES = [
	...TYPO_BASE_PROPERTIES,
	...TEXT_DECORATION_PROPERTIES,
	...['hover', 'active', 'focus'].flatMap((state) =>
		TEXT_DECORATION_PROPERTIES.map((property) => `${state}--${property}`),
	),
];

const REQUIRED_TOKENS = buildRequiredTokens();
assert.equal(REQUIRED_TOKENS.length, 247, 'required Skeleton v5 token inventory is complete');

const sources = new Map();
for (const theme of THEMES) {
	sources.set(
		theme,
		await readFile(new URL(`../src/lib/styles/themes/${theme}.css`, import.meta.url), 'utf8'),
	);
}

for (const theme of THEMES) {
	validateThemeSource(theme, sources.get(theme));
}

const tokenNameSets = THEMES.map((theme) => [...parseThemeBlock(theme, sources.get(theme)).keys()].sort());
assert.deepEqual(
	tokenNameSets[0],
	tokenNameSets[1],
	'pride and trans declare byte-identical custom property name sets',
);

// Negative self-checks: the validator must reject deliberately broken copies,
// proving the assertions above have teeth without touching the real files.
const pristine = sources.get('pride');

assert.throws(
	() => validateThemeSource('pride', dropTokenLine(pristine, '--color-primary-500')),
	/missing required token --color-primary-500/,
	'self-check: removing a required token is detected',
);
assert.throws(
	() => validateThemeSource('pride', renameToken(pristine, '--color-surface-950', '--color-surface-1000')),
	/missing required token --color-surface-950/,
	'self-check: renaming a required token is detected',
);
assert.throws(
	() => validateThemeSource('pride', emptyTokenValue(pristine, '--typo-base--color-light')),
	/empty value for --typo-base--color-light/,
	'self-check: emptying a token value is detected',
);
assert.throws(
	() => validateThemeSource('pride', setTokenValue(pristine, '--color-error-500', 'notacolor')),
	/--color-error-500 does not parse as CSS color syntax/,
	'self-check: a non-color value on a color ramp token is detected',
);
assert.throws(
	() => validateThemeSource('pride', setTokenValue(pristine, '--color-brand-light', 'var(--color-does-not-exist)')),
	/--color-brand-light references undefined token --color-does-not-exist/,
	'self-check: a dangling var\\(\\) reference is detected',
);
assert.throws(
	() => validateThemeSource('pride', pristine.replace("[data-theme='pride']", "[data-theme='rainbow']")),
	/\[data-theme='pride'\] selector/,
	'self-check: a renamed theme selector is detected',
);
{
	const mutatedTrans = dropTokenLine(sources.get('trans'), '--color-secondary-contrast-50');
	assert.throws(
		() => validateThemeSource('trans', mutatedTrans),
		/missing required token --color-secondary-contrast-50/,
		'self-check: single-file token loss breaks the contract before parity is even compared',
	);
	const prideNames = [...parseThemeBlock('pride', pristine).keys()].sort();
	const transNames = [...parseThemeBlock('trans', mutatedTrans).keys()].sort();
	assert.notDeepEqual(prideNames, transNames, 'self-check: parity comparison detects cross-file drift');
}

console.log('theme token contract passed for pride and trans');

function buildRequiredTokens() {
	const names = [];
	for (const family of COLOR_FAMILIES) {
		for (const step of COLOR_STEPS) names.push(`--color-${family}-${step}`);
		names.push(`--color-${family}-contrast-dark`, `--color-${family}-contrast-light`);
		for (const step of COLOR_STEPS) names.push(`--color-${family}-contrast-${step}`);
	}
	names.push(
		'--color-root-bg-light',
		'--color-root-bg-dark',
		'--color-brand-light',
		'--color-brand-dark',
		'--color-brand-contrast-light',
		'--color-brand-contrast-dark',
	);
	for (const property of TYPO_BASE_PROPERTIES) names.push(`--typo-base--${property}`);
	for (const property of TYPO_HEADING_PROPERTIES) names.push(`--typo-heading--${property}`);
	for (const property of TYPO_ANCHOR_PROPERTIES) names.push(`--typo-anchor--${property}`);
	names.push(
		'--text-scaling',
		'--spacing',
		'--default-border-width',
		'--default-outline-width',
		'--default-ring-width',
		'--radius-base',
		'--radius-container',
		'--corner-shape-base',
		'--corner-shape-container',
	);
	return names;
}

function parseThemeBlock(theme, css) {
	const selector = `[data-theme='${theme}']`;
	const selectorIndex = css.indexOf(`${selector} {`);
	assert.notEqual(selectorIndex, -1, `${theme}.css declares its ${selector} selector`);
	const blockStart = css.indexOf('{', selectorIndex) + 1;
	const blockEnd = css.indexOf('}', blockStart);
	assert.notEqual(blockEnd, -1, `${theme}.css ${selector} block is closed`);
	const body = css.slice(blockStart, blockEnd).replace(/\/\*[^]*?\*\//g, '');
	assert.doesNotMatch(body, /{/, `${theme}.css ${selector} block has no nested rules`);

	const tokens = new Map();
	for (const declaration of body.split(';')) {
		const trimmed = declaration.trim();
		if (trimmed === '') continue;
		const colonIndex = trimmed.indexOf(':');
		assert.notEqual(colonIndex, -1, `${theme}.css declaration has a value: ${trimmed}`);
		const name = trimmed.slice(0, colonIndex).trim();
		const value = trimmed.slice(colonIndex + 1).trim();
		assert.match(name, /^--[a-z0-9-]+$/, `${theme}.css declares only custom properties, saw: ${name}`);
		assert.equal(tokens.has(name), false, `${theme}.css declares ${name} exactly once`);
		tokens.set(name, value);
	}
	return tokens;
}

function validateThemeSource(theme, css) {
	const tokens = parseThemeBlock(theme, css);
	for (const required of REQUIRED_TOKENS) {
		if (!tokens.has(required)) {
			throw new Error(`${theme}.css is missing required token ${required}`);
		}
	}
	for (const [name, value] of tokens) {
		if (value === '') {
			throw new Error(`${theme}.css has an empty value for ${name}`);
		}
		const reference = value.match(/^var\((--[a-z0-9-]+)\)$/);
		if (reference) {
			if (!tokens.has(reference[1])) {
				throw new Error(`${theme}.css ${name} references undefined token ${reference[1]}`);
			}
			continue;
		}
		if (name.startsWith('--color-')) {
			if (!/^oklch\(\d+(\.\d+)?% \d+(\.\d+)? (\d+(\.\d+)?deg|none)\)$/.test(value)) {
				throw new Error(`${theme}.css ${name} does not parse as CSS color syntax: ${value}`);
			}
		}
	}
	assert.match(tokens.get('--text-scaling'), /^\d+(\.\d+)?$/, `${theme}.css --text-scaling is numeric`);
	return tokens;
}

function tokenLinePattern(name) {
	return new RegExp(`^\\t${name.replaceAll('-', '\\-')}: [^;]+;\\n`, 'm');
}

function dropTokenLine(css, name) {
	const mutated = css.replace(tokenLinePattern(name), '');
	assert.notEqual(mutated, css, `mutation dropped ${name}`);
	return mutated;
}

function renameToken(css, name, replacement) {
	const mutated = css.replace(`\t${name}:`, `\t${replacement}:`);
	assert.notEqual(mutated, css, `mutation renamed ${name}`);
	return mutated;
}

function emptyTokenValue(css, name) {
	return setTokenValue(css, name, '');
}

function setTokenValue(css, name, value) {
	const mutated = css.replace(tokenLinePattern(name), `\t${name}: ${value};\n`);
	assert.notEqual(mutated, css, `mutation rewrote ${name}`);
	return mutated;
}
