import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
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
