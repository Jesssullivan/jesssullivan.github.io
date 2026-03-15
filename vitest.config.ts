import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'scripts/**/*.test.mts'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts'],
			exclude: ['src/lib/**/*.test.ts', 'src/lib/data/**'],
			reporter: ['text', 'json-summary'],
			thresholds: {
				lines: 7,
				functions: 20,
				branches: 2,
			},
		},
	},
});
