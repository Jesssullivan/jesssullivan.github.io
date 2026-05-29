import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: [
			'src/**/*.test.ts',
			'scripts/wayback-utils.test.mts',
			'packages/pulse-core/test/**/*.test.ts',
			'packages/pulse-client/test/**/*.test.ts',
		],
		environment: 'node',
		globals: true,
		reporters: ['verbose'],
		watch: false,
	},
});
