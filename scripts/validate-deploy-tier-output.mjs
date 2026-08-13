import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [tier, sourceSha = ''] = process.argv.slice(2);
if (tier !== 'production' && tier !== 'shadow') {
	throw new Error('Usage: validate-deploy-tier-output.mjs <production|shadow> [exact-source-sha]');
}
if (tier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)) {
	throw new Error('Shadow output validation requires an exact 40-character lowercase source SHA.');
}

const buildRoot = resolve(process.cwd(), 'build');
const htmlPaths = await collectHtml(buildRoot);
if (htmlPaths.length === 0) throw new Error(`No generated HTML found under ${buildRoot}`);
const cssPaths = await collectFiles(buildRoot, '.css');
const css = (await Promise.all(cssPaths.map((path) => readFile(path, 'utf8')))).join('\n');
for (const utility of [
	'.bg-surface-200-800',
	'.border-surface-300-700',
	'.text-surface-600-400',
	'.hover\\:bg-surface-200-800',
]) {
	if (!css.includes(utility)) throw new Error(`Skeleton paired utility missing from emitted CSS: ${utility}`);
}

const shadowRobots = '<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow"';
const shadowSource = `<meta name="tinyland-source-sha" content="${sourceSha}" data-deploy-tier="shadow"`;

for (const path of htmlPaths) {
	const html = await readFile(path, 'utf8');
	if (tier === 'shadow') {
		if (!html.includes(shadowRobots) || !html.includes(shadowSource)) {
			throw new Error(`Shadow markers missing or stale in ${path}`);
		}
	} else if (html.includes('data-deploy-tier="shadow"') || html.includes('name="tinyland-source-sha"')) {
		throw new Error(`Shadow-only marker leaked into production output ${path}`);
	}
}

console.log(`${tier} deploy-tier output contract passed for ${htmlPaths.length} generated HTML files`);

async function collectHtml(directory) {
	return collectFiles(directory, '.html');
}

async function collectFiles(directory, suffix) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = resolve(directory, entry.name);
			if (entry.isDirectory()) return collectFiles(path, suffix);
			return entry.isFile() && entry.name.endsWith(suffix) ? [path] : [];
		}),
	);
	return nested.flat().sort();
}
