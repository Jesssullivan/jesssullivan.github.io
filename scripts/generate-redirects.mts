import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');
const mapPath = join(root, 'static', 'redirect-map.json');

const deployTier = process.env.PUBLIC_DEPLOY_TIER || 'production';
const sourceSha = process.env.PUBLIC_SOURCE_SHA || '';

if (deployTier !== 'production' && deployTier !== 'shadow') {
	throw new Error(`Unsupported PUBLIC_DEPLOY_TIER: ${deployTier}`);
}

if (deployTier === 'shadow' && !/^[0-9a-f]{40}$/.test(sourceSha)) {
	throw new Error('Shadow redirect generation requires an exact 40-character PUBLIC_SOURCE_SHA');
}

const shadowProvenance =
	deployTier === 'shadow'
		? `\n  <meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow">\n  <meta name="tinyland-source-sha" content="${sourceSha}" data-deploy-tier="shadow">`
		: '';

const redirectMap: Record<string, string> = JSON.parse(readFileSync(mapPath, 'utf-8'));
let count = 0;

for (const [oldPath, newPath] of Object.entries(redirectMap)) {
	// oldPath like "/2017/03/02/wolf-pine-fox-park-2-22717/"
	// newPath like "/blog/slug" or "/blog"
	const dir = join(buildDir, oldPath);
	mkdirSync(dir, { recursive: true });

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <link rel="canonical" href="https://transscendsurvival.org${newPath}">
  <meta http-equiv="refresh" content="0;url=${newPath}">
  <meta name="robots" content="noindex">${shadowProvenance}
</head>
<body>
  <p>Redirecting to <a href="${newPath}">${newPath}</a>...</p>
</body>
</html>`;

	writeFileSync(join(dir, 'index.html'), html);
	count++;
}

console.log(`Generated ${count} redirect files.`);
