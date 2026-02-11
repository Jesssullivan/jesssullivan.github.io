import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				window: 'readonly',
				document: 'readonly',
				localStorage: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				requestAnimationFrame: 'readonly',
				cancelAnimationFrame: 'readonly',
				HTMLElement: 'readonly',
				HTMLDivElement: 'readonly',
				HTMLIFrameElement: 'readonly',
				MutationObserver: 'readonly',
				WheelEvent: 'readonly',
				MouseEvent: 'readonly',
				IntersectionObserver: 'readonly',
				URL: 'readonly',
				performance: 'readonly',
				console: 'readonly',
				Buffer: 'readonly',
				process: 'readonly',
			},
			parserOptions: {
				extraFileExtensions: ['.svelte'],
			},
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'error',
			// Svelte-specific adjustments
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-dom-manipulating': 'off',
			'svelte/require-each-key': 'warn',
			'svelte/no-navigation-without-resolve': 'off',
		},
	},
	{
		// Disable parsing for files with JSON-LD {@html} blocks that trip the svelte parser
		files: ['**/Breadcrumbs.svelte', '**/blog/\\[slug\\]/+page.svelte'],
		rules: {
			// These files have valid Svelte but the ESLint parser can't handle @html with JSON-LD
		},
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'scripts/',
			'src/posts/',
			'static/',
			'*.config.*',
			// Files with JSON-LD or runes that cause ESLint svelte parser errors
			'src/lib/components/Breadcrumbs.svelte',
			'src/routes/blog/\\[slug\\]/+page.svelte',
			'src/routes/+error.svelte',
			'src/routes/+layout.svelte',
			'src/routes/about/+page.svelte',
		],
	},
);
