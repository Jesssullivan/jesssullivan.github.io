import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');

if (!existsSync(buildDir) || !statSync(buildDir).isDirectory()) {
	throw new Error(`Build directory does not exist: ${buildDir}`);
}

let aliases = 0;

for (const htmlPath of walkHtml(buildDir)) {
	const rel = relative(buildDir, htmlPath);
	const fileName = rel.split('/').at(-1);
	if (fileName === 'index.html' || fileName === '404.html') continue;

	const aliasDir = join(buildDir, rel.slice(0, -'.html'.length));
	const aliasPath = join(aliasDir, 'index.html');

	mkdirSync(aliasDir, { recursive: true });
	copyFileSync(htmlPath, aliasPath);
	copyCompressedSibling(htmlPath, aliasPath, '.br');
	copyCompressedSibling(htmlPath, aliasPath, '.gz');
	aliases++;
}

console.log(`Generated ${aliases} trailing-slash directory aliases.`);

function* walkHtml(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkHtml(fullPath);
			continue;
		}

		if (entry.isFile() && entry.name.endsWith('.html')) {
			yield fullPath;
		}
	}
}

function copyCompressedSibling(sourceHtmlPath: string, aliasHtmlPath: string, extension: '.br' | '.gz') {
	const sourcePath = `${sourceHtmlPath}${extension}`;
	if (!existsSync(sourcePath)) return;
	copyFileSync(sourcePath, `${aliasHtmlPath}${extension}`);
}
