import { defineConfig, devices } from '@playwright/test';

type TraceMode = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';

const chromiumExecutable =
	process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.GF_RBE_CHROMIUM_EXECUTABLE || process.env.CHROME_BIN;
const traceMode = parseTraceMode(process.env.PLAYWRIGHT_TRACE_MODE);

if (!chromiumExecutable) {
	throw new Error(
		'Bazel Playwright requires GF_RBE_CHROMIUM_EXECUTABLE, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, or CHROME_BIN',
	);
}

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	fullyParallel: true,
	forbidOnly: true,
	retries: 0,
	workers: 1,
	reporter: process.env.GITHUB_ACTIONS ? 'github' : 'line',
	use: {
		baseURL: 'http://127.0.0.1:3000',
		trace: traceMode,
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					executablePath: chromiumExecutable,
					args: [
						'--disable-background-networking',
						'--disable-dev-shm-usage',
						'--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE 127.0.0.1, EXCLUDE localhost',
						'--no-sandbox',
					],
				},
			},
		},
	],
	webServer: {
		command: 'node scripts/serve-static-build.mjs build 3000',
		port: 3000,
		reuseExistingServer: false,
		timeout: 300_000,
	},
});

function parseTraceMode(value: string | undefined): TraceMode {
	if (value === 'on' || value === 'retain-on-failure' || value === 'on-first-retry') {
		return value;
	}
	return 'off';
}
