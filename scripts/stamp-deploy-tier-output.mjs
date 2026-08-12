import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip } from 'node:zlib';

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const tier = process.env.PUBLIC_DEPLOY_TIER || 'production';
const sourceSha = process.env.PUBLIC_SOURCE_SHA || '';

if (tier !== 'production' && tier !== 'shadow') {
	throw new Error(`Unsupported PUBLIC_DEPLOY_TIER: ${tier}`);
}
if (tier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)) {
	throw new Error('Shadow output stamping requires an exact 40-character PUBLIC_SOURCE_SHA.');
}

const buildRoot = resolve(process.cwd(), 'build');
const htmlPaths = await collectHtml(buildRoot);
if (htmlPaths.length === 0) throw new Error(`No generated HTML found under ${buildRoot}`);

let stamped = 0;
if (tier === 'shadow') {
	const robotsPrefix = '<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow"';
	const sourcePrefix = `<meta name="tinyland-source-sha" content="${sourceSha}" data-deploy-tier="shadow"`;
	const robots = `${robotsPrefix}>`;
	const source = `${sourcePrefix}>`;

	for (const path of htmlPaths) {
		const html = await readFile(path, 'utf8');
		if (html.includes(robotsPrefix) && html.includes(sourcePrefix)) continue;
		if (html.includes('data-deploy-tier="shadow"') || html.includes('name="tinyland-source-sha"')) {
			throw new Error(`Refusing to replace partial or stale shadow provenance in ${path}`);
		}
		if (!html.includes('</head>')) throw new Error(`Generated HTML has no closing head element: ${path}`);

		const stampedHtml = html.replace('</head>', `\t${robots}\n\t${source}\n</head>`);
		await writeFile(path, stampedHtml);
		await rewriteCompressedSibling(path, '.br', compressBrotli, stampedHtml);
		await rewriteCompressedSibling(path, '.gz', compressGzip, stampedHtml);
		stamped++;
	}
}

console.log(`${tier} deploy-tier stamping complete: ${stamped}/${htmlPaths.length} HTML files updated`);

async function rewriteCompressedSibling(path, suffix, compress, html) {
	const compressedPath = `${path}${suffix}`;
	if (!existsSync(compressedPath)) return;
	await writeFile(compressedPath, await compress(Buffer.from(html)));
}

async function collectHtml(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = resolve(directory, entry.name);
			if (entry.isDirectory()) return collectHtml(path);
			return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
		}),
	);
	return nested.flat().sort();
}
