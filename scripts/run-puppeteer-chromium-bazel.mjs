import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

const runtimeDir = mkdtempSync(join(tmpdir(), 'ghio-puppeteer-chromium-'));
ensureWritableEnvDir('HOME', join(runtimeDir, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeDir, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeDir, 'xdg-cache'));

const chromiumExecutable = findChromiumExecutable();
if (!chromiumExecutable) {
	console.error(
		'No Chromium executable found. Set GF_RBE_CHROMIUM_EXECUTABLE, PUPPETEER_EXECUTABLE_PATH, or CHROME_BIN.',
	);
	process.exit(1);
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

let browser;
let page;
try {
	browser = await puppeteer.launch({
		executablePath: chromiumExecutable,
		headless: 'new',
		args: ['--disable-dev-shm-usage', '--no-sandbox'],
	});
	page = await browser.newPage();
	await page.setViewport({ width: 1024, height: 640, deviceScaleFactor: 1 });
	await page.setContent(renderSmokePage(packageJson.name), { waitUntil: 'load' });

	const title = await page.$eval('main h1', (element) => element.textContent);
	const target = await page.$eval('[data-rbe-target]', (element) => element.textContent);
	if (title !== 'GloriousFlywheel Puppeteer browser RBE smoke') {
		throw new Error(`unexpected smoke title: ${title}`);
	}
	if (target !== packageJson.name) {
		throw new Error(`unexpected package marker: ${target}`);
	}

	console.log(`Puppeteer Chromium smoke passed with ${chromiumExecutable}`);
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
    <title>Puppeteer Browser RBE smoke</title>
  </head>
  <body>
    <main>
      <h1>GloriousFlywheel Puppeteer browser RBE smoke</h1>
      <p data-rbe-target>${escapeHtml(packageName)}</p>
    </main>
  </body>
</html>`;
}

function findChromiumExecutable() {
	const candidates = [
		process.env.GF_RBE_CHROMIUM_EXECUTABLE,
		process.env.PUPPETEER_EXECUTABLE_PATH,
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
		viewport: page.viewport(),
		mainText: await page.$eval('main', (element) => element.textContent?.slice(0, 240)).catch(() => null),
	};
	console.error(`Puppeteer Chromium smoke diagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
}
