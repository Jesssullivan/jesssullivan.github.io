import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { accessibilityPlugin } from '@tummycrypt/vite-plugin-a11y';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployTier = process.env.PUBLIC_DEPLOY_TIER || 'production';
const sourceSha = process.env.PUBLIC_SOURCE_SHA || '';

if (deployTier !== 'production' && deployTier !== 'shadow') {
	throw new Error(`Unsupported PUBLIC_DEPLOY_TIER: ${deployTier}`);
}
if (deployTier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)) {
	throw new Error('Shadow builds require PUBLIC_SOURCE_SHA as an exact 40-character lowercase SHA.');
}

export default defineConfig({
	define: {
		__BLOG_DEPLOY_TIER__: JSON.stringify(deployTier),
		__BLOG_SOURCE_SHA__: JSON.stringify(sourceSha),
	},
	plugins: [
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
		rolldownOptions: {
			checks: {
				pluginTimings: false,
			},
		},
	},
	server: {
		fs: {
			allow: [__dirname, resolve(__dirname, 'packages')],
		},
	},
});
