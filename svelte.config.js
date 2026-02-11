import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex, escapeSvelte } from 'mdsvex';
import { createHighlighter } from 'shiki';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(__dirname, 'static');

const theme = 'github-dark';
const highlighter = await createHighlighter({
	themes: [theme],
	langs: ['javascript', 'typescript', 'python', 'r', 'bash', 'html', 'css', 'json', 'yaml', 'haskell', 'go', 'rust', 'markdown', 'shellscript', 'sql', 'nix', 'c', 'cpp']
});

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: ['.md', '.svx'],
	highlight: {
		highlighter: async (code, lang) => {
			// Intercept mermaid code blocks — Base64 encode for client-side rendering
			if (lang === 'mermaid') {
				const encoded = Buffer.from(code.trim()).toString('base64');
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
				return `<div class="mermaid-diagram my-6 not-prose" data-mermaid-code="${encoded}" data-mermaid-id="${id}"></div>`;
			}
			const html = escapeSvelte(
				highlighter.codeToHtml(code, { lang: lang || 'text', theme })
			);
			return `{@html \`${html}\`}`;
		}
	},
	rehypePlugins: [
		// Wrap local post images in <picture> with WebP source for responsive loading
		() => (tree) => {
			const visitImg = (node, parent) => {
				if (
					node.type === 'element' &&
					node.tagName === 'img' &&
					node.properties?.src &&
					typeof node.properties.src === 'string' &&
					node.properties.src.startsWith('/images/posts/')
				) {
					const src = node.properties.src;
					const ext = src.substring(src.lastIndexOf('.'));
					const basePath = src.substring(0, src.lastIndexOf('.'));
					const webpSrc = basePath + '.webp';
					const webpFile = resolve(staticDir, webpSrc.slice(1)); // remove leading /

					// Add lazy loading and async decoding to the img
					node.properties.loading = 'lazy';
					node.properties.decoding = 'async';

					// Only wrap in <picture> if a .webp file exists on disk
					if (ext !== '.webp' && existsSync(webpFile)) {
						const picture = {
							type: 'element',
							tagName: 'picture',
							properties: {},
							children: [
								{
									type: 'element',
									tagName: 'source',
									properties: { srcSet: webpSrc, type: 'image/webp' },
									children: []
								},
								node
							]
						};

						// Replace the img node with the picture node in parent's children
						if (parent && parent.children) {
							const idx = parent.children.indexOf(node);
							if (idx !== -1) {
								parent.children[idx] = picture;
							}
						}
					}
				}
				if (node.children) {
					// Iterate over a copy since we may mutate the array
					[...node.children].forEach((child) => visitImg(child, node));
				}
			};
			visitImg(tree, null);
		},
		// Escape ALL curly braces in content to prevent Svelte parsing
		() => (tree) => {
			const escBraces = (s) => s.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
			const visit = (node) => {
				if (node.type === 'text' && node.value) {
					node.value = escBraces(node.value);
				}
				if (node.type === 'raw' && node.value) {
					node.value = escBraces(node.value);
				}
				// Escape curly braces inside element attributes (e.g. href, src)
				if (node.type === 'element' && node.properties) {
					for (const [key, val] of Object.entries(node.properties)) {
						if (typeof val === 'string' && (val.includes('{') || val.includes('}'))) {
							node.properties[key] = escBraces(val);
						}
					}
				}
				if (node.children) {
					node.children.forEach(visit);
				}
			};
			visit(tree);
		}
	]
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md', '.svx'],
	preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: true,
			strict: false
		}),
		paths: {
			base: ''
		},
		prerender: {
			handleHttpError: 'warn',
			handleMissingId: 'warn'
		}
	}
};

export default config;
