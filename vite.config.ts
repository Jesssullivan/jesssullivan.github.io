import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { accessibilityPlugin } from '@tummycrypt/vite-plugin-a11y';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placementOf } from './src/lib/notes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployTier = process.env.PUBLIC_DEPLOY_TIER || 'production';
const sourceSha = process.env.PUBLIC_SOURCE_SHA || '';

if (deployTier !== 'production' && deployTier !== 'shadow') {
	throw new Error(`Unsupported PUBLIC_DEPLOY_TIER: ${deployTier}`);
}
if (deployTier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)) {
	throw new Error('Shadow builds require PUBLIC_SOURCE_SHA as an exact 40-character lowercase SHA.');
}

/**
 * Counts the entries of the verified projection that projection/step.mjs
 * left in src/lib/projection-data, by where this site places them, and says
 * so in the build log. The Notes link in the navigation exists only when
 * the count of notes is above zero.
 */
function projectionNoteCount(): number {
	const dir = resolve(__dirname, 'src/lib/projection-data');
	if (!existsSync(join(dir, 'projection.json'))) {
		console.log('notes: no verified projection in src/lib/projection-data, so this build has no notes');
		return 0;
	}
	const counts = { note: 0, blog: 0, other: 0 };
	for (const name of readdirSync(join(dir, 'posts')).filter((file) => file.endsWith('.json')).sort()) {
		counts[placementOf(JSON.parse(readFileSync(join(dir, 'posts', name), 'utf8')))] += 1;
	}
	console.log(
		`notes: ${counts.note} notes built, ${counts.blog} entries with a /blog path ignored, ${counts.other} other entries ignored`,
	);
	return counts.note;
}

export default defineConfig({
	define: {
		__BLOG_DEPLOY_TIER__: JSON.stringify(deployTier),
		__BLOG_SOURCE_SHA__: JSON.stringify(sourceSha),
		__BLOG_HAS_NOTES__: JSON.stringify(projectionNoteCount() > 0),
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
