import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'npm run build && npx serve build -l 3000',
		port: 3000,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
});
