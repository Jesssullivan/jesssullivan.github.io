import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { skeletonColorUtilities } from '@tummycrypt/vite-plugin-skeleton-colors';
import { accessibilityPlugin } from '@tummycrypt/vite-plugin-a11y';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
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
	},
});
