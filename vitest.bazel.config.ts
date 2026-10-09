import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import kitOptions from './kit.config.js';

export default defineConfig({
	plugins: [sveltekit(kitOptions)],
	test: {
		include: [
			'src/**/*.test.ts',
			'scripts/apply-dependency-patches.test.mts',
			'scripts/gf-reapi-bazel-credential-helper.test.mts',
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
