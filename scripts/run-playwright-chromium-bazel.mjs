import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const runtimeDir = mkdtempSync(join(tmpdir(), 'ghio-playwright-chromium-'));
ensureWritableEnvDir('HOME', join(runtimeDir, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeDir, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeDir, 'xdg-cache'));

const chromiumExecutable = findChromiumExecutable();
if (!chromiumExecutable) {
	console.error(
		'No Chromium executable found. Set GF_RBE_CHROMIUM_EXECUTABLE, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, or CHROME_BIN.',
	);
	process.exit(1);
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

let browser;
let page;
try {
	browser = await chromium.launch({
		executablePath: chromiumExecutable,
		headless: true,
		args: ['--disable-dev-shm-usage', '--no-sandbox'],
	});
	page = await browser.newPage({
		deviceScaleFactor: 1,
		viewport: { width: 1024, height: 640 },
	});
	await page.setContent(renderSmokePage(packageJson.name), { waitUntil: 'load' });

	const title = await page.locator('main h1').textContent();
	const target = await page.locator('[data-rbe-target]').textContent();
	if (title !== 'GloriousFlywheel browser RBE smoke') {
		throw new Error(`unexpected smoke title: ${title}`);
	}
	if (target !== packageJson.name) {
		throw new Error(`unexpected package marker: ${target}`);
	}

	console.log(`Playwright Chromium smoke passed with ${chromiumExecutable}`);
} catch (error) {
	if (page) {
		await printPageDiagnostics(page);
	}
	throw error;
} finally {
	await browser?.close();
}

function renderSmokePage(packageName) {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Browser RBE smoke</title>
  </head>
  <body>
    <main>
      <h1>GloriousFlywheel browser RBE smoke</h1>
      <p data-rbe-target>${escapeHtml(packageName)}</p>
    </main>
  </body>
</html>`;
}

function findChromiumExecutable() {
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
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return '';
}

function ensureWritableEnvDir(name, fallback) {
	const current = process.env[name];
	if (current && isWritableDirectory(current)) {
		return current;
	}

	mkdirSync(fallback, { recursive: true });
	process.env[name] = fallback;
	return fallback;
}

function isWritableDirectory(path) {
	try {
		if (!existsSync(path) || !statSync(path).isDirectory()) {
			return false;
		}
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

async function printPageDiagnostics(page) {
	const diagnostics = {
		url: page.url(),
		title: await page.title().catch(() => ''),
		viewport: page.viewportSize(),
		mainText: await page
			.locator('main')
			.textContent({ timeout: 1000 })
			.then((text) => text?.slice(0, 240))
			.catch(() => null),
	};
	console.error(`Playwright Chromium smoke diagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
}
