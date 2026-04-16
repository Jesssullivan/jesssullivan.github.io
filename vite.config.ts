import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { skeletonColorUtilities } from '@tummycrypt/vite-plugin-skeleton-colors';
import { accessibilityPlugin } from '@tummycrypt/vite-plugin-a11y';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Skeleton-Tailwind v4 compatibility plugin (from tinyland.dev)
function skeletonTailwindV4Compat(): Plugin {
	return {
		name: 'skeleton-tailwind-v4-compat',
		enforce: 'pre',
		transform(code, id) {
			if (id.includes('@skeletonlabs/skeleton') && id.endsWith('.css')) {
				code = code
					.replace(/@variant\s+sm\s*{/g, '@media (min-width: 640px) {')
					.replace(/@variant\s+md\s*{/g, '@media (min-width: 768px) {')
					.replace(/@variant\s+lg\s*{/g, '@media (min-width: 1024px) {')
					.replace(/@variant\s+xl\s*{/g, '@media (min-width: 1280px) {')
					.replace(/@variant\s+2xl\s*{/g, '@media (min-width: 1536px) {')
					.replace(/@variant\s+dark\s*{/g, '.dark & {')
					.replace(/@apply\s+variant-/g, '@apply ');
				return { code, map: null };
			}
		},
	};
}

export default defineConfig({
	plugins: [
		skeletonTailwindV4Compat(),
		skeletonColorUtilities(),
		tailwindcss(),
		accessibilityPlugin({
			wcagLevel: 'AA',
			failOnError: false,
		}),
		sveltekit(),
		...(process.env.BUILD_ANALYZE ? [
			visualizer({
				emitFile: true,
				filename: 'stats.html',
				template: 'treemap',
				gzipSize: true,
				brotliSize: true,
			}),
		] : []),
	],
	build: {
		reportCompressedSize: true,
		chunkSizeWarningLimit: 250,
		cssCodeSplit: true,
	},
});
