import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { configureChromiumFontconfig } from './chromium-fontconfig.mjs';

const targets = (
	process.env.PUBLIC_BLOG_HEALTH_URLS ?? 'https://transscendsurvival.org/blog,https://www.transscendsurvival.org/blog'
)
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);

const runtimeDir = mkdtempSync(join(tmpdir(), 'ghio-public-blog-health-'));
ensureWritableEnvDir('HOME', join(runtimeDir, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeDir, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeDir, 'xdg-cache'));
configureChromiumFontconfig(runtimeDir);

const executablePath = findChromiumExecutable();
let browser: Browser | undefined;
const failures: string[] = [];

try {
	browser = await chromium.launch({
		...(executablePath ? { executablePath } : {}),
		headless: true,
		args: ['--disable-dev-shm-usage', '--no-sandbox'],
	});

	for (const target of targets) {
		const result = await checkTarget(browser, target);
		const prefix = result.ok ? 'PASS' : 'FAIL';
		console.log(`${prefix} public blog hydration ${target}: ${result.detail}`);
		if (!result.ok) failures.push(`${target}: ${result.detail}`);
	}
} finally {
	await browser?.close();
	if (process.env.GF_KEEP_BAZEL_BROWSER_TMP !== '1') {
		rmSync(runtimeDir, { recursive: true, force: true });
	}
}

if (failures.length > 0) {
	console.error(`Public blog hydration failed with ${failures.length} failing target(s).`);
	for (const failure of failures) console.error(`  - ${failure}`);
	process.exit(1);
}

async function checkTarget(browser: Browser, target: string): Promise<{ ok: boolean; detail: string }> {
	const page = await browser.newPage({
		deviceScaleFactor: 1,
		viewport: { width: 1280, height: 900 },
	});
	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});

	try {
		const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		if (!response || response.status() !== 200) {
			return { ok: false, detail: `status=${response?.status() ?? 'no-response'}` };
		}

		const brokerStateLocator = page.locator('[data-testid="tinyland-blog-broker-state"]');
		await brokerStateLocator.waitFor({ state: 'attached', timeout: 10_000 });
		const beforeLinks = await blogLinkCount(page);

		await page
			.waitForFunction(
				() =>
					document
						.querySelector('[data-testid="tinyland-blog-broker-state"]')
						?.textContent?.includes('Tinyland broker stream loaded.') === true,
				undefined,
				{ timeout: 15_000 },
			)
			.catch(() => undefined);

		const brokerState = normalizeText((await brokerStateLocator.textContent()) ?? '');
		const staleSnapshotVisible = await page.getByText('Static snapshot may be stale').count();
		const afterLinks = await blogLinkCount(page);

		if (!brokerState.includes('Tinyland broker stream loaded.')) {
			return {
				ok: false,
				detail: `broker state=${brokerState || '(empty)'}; console=${formatConsoleErrors(consoleErrors)}`,
			};
		}

		if (staleSnapshotVisible > 0) {
			return { ok: false, detail: 'stale snapshot banner is visible after hydration' };
		}

		if (afterLinks < beforeLinks) {
			return { ok: false, detail: `blog links dropped during hydration: before=${beforeLinks}; after=${afterLinks}` };
		}

		return {
			ok: true,
			detail: `status=200; broker=loaded; links before=${beforeLinks}; after=${afterLinks}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, detail: `${message}; console=${formatConsoleErrors(consoleErrors)}` };
	} finally {
		await page.close();
	}
}

async function blogLinkCount(page: Page): Promise<number> {
	return page.locator('a[href^="/blog/"], a[href^="https://transscendsurvival.org/blog/"]').count();
}

function normalizeText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function formatConsoleErrors(errors: string[]): string {
	return errors.slice(0, 5).join(' | ') || '(none)';
}

function findChromiumExecutable(): string {
	const candidates = [
		process.env.GF_RBE_CHROMIUM_EXECUTABLE,
		process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
		process.env.CHROME_BIN,
		'/bin/chromium',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
	].filter(Boolean);

	for (const candidate of candidates) {
		if (candidate && existsSync(candidate)) return candidate;
	}

	return '';
}

function ensureWritableEnvDir(name: string, fallback: string): string {
	const current = process.env[name];
	if (current && isWritableDirectory(current)) {
		return current;
	}

	mkdirSync(fallback, { recursive: true });
	process.env[name] = fallback;
	return fallback;
}

function isWritableDirectory(path: string): boolean {
	try {
		if (!existsSync(path) || !statSync(path).isDirectory()) return false;
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}
