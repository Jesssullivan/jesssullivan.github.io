import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const buildDir = join(root, 'build');

if (!existsSync(buildDir) || !statSync(buildDir).isDirectory()) {
	throw new Error(`Build directory does not exist: ${buildDir}`);
}

const errors: string[] = [];
let checked = 0;

for (const htmlPath of walkHtml(buildDir)) {
	const rel = relative(buildDir, htmlPath);
	const fileName = rel.split('/').at(-1);
	if (fileName === 'index.html' || fileName === '404.html') continue;

	const aliasPath = join(buildDir, rel.slice(0, -'.html'.length), 'index.html');
	checked++;
	if (!existsSync(aliasPath)) {
		errors.push(`Missing trailing-slash alias for ${rel}: expected ${relative(buildDir, aliasPath)}`);
	}
}

if (errors.length > 0) {
	console.error(`Directory index alias validation failed with ${errors.length} error(s):\n`);
	for (const error of errors) console.error(`  - ${error}`);
	process.exit(1);
}

console.log(`Directory index alias validation passed. ${checked} aliases verified.`);

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
