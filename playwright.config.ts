import { defineConfig, devices } from '@playwright/test';

const webServerCommand = process.env.CI
	? 'npm run build && npx serve build -l 3000'
	: 'npm run dev -- --host 127.0.0.1 --port 3000';
const webServerTimeout = process.env.CI ? 180_000 : 300_000;
const testTimeout = process.env.CI ? 30_000 : 60_000;

export default defineConfig({
	testDir: 'e2e',
	timeout: testTimeout,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},
	],
	webServer: {
		command: webServerCommand,
		port: 3000,
		reuseExistingServer: !process.env.CI,
		timeout: webServerTimeout,
	},
});
