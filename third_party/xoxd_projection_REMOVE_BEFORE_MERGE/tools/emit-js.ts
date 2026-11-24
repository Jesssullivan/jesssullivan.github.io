/**
 * Emits dist/*.js from src/*.ts. Node refuses to strip types from a file under
 * node_modules, so the package ships JavaScript for every runtime import. The
 * sources use erasable syntax only, so Node's own type stripping gives the
 * JavaScript and no compiler is needed. Relative .ts specifiers become .js.
 *
 * Run it as node tools/emit-js.ts, or as just projection-emit at the repo
 * root. It replaces dist/. The conformance suite compares dist/ with what
 * src/ emits, so a stale dist/ fails it.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const HEADER = '// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.\n';

/** One module's JavaScript: types erased, blank leftovers dropped, relative .ts specifiers as .js. */
export function emitJs(source: string): string {
	const stripped = stripTypeScriptTypes(source, { mode: 'strip' });
	const sourceLines = source.split('\n');
	const lines = stripped.split('\n').map((line) => line.trimEnd());
	// Strip mode keeps every line. A line that held only types is now blank,
	// and it is dropped. A blank line of the source stays, and a run of them
	// becomes one.
	const kept = lines.filter((line, index) => line !== '' || sourceLines[index]?.trim() === '');
	const js = kept
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\.ts\2/g, '$1$2$3.js$2');
	// A hashbang must stay the first line, so the header goes after it.
	const hashbang = /^#!.*\n/.exec(js)?.[0] ?? '';
	return hashbang + HEADER + js.slice(hashbang.length);
}

/** Every emitted file by name, from the sources as they are now. */
export function emitAll(): Map<string, string> {
	const out = new Map<string, string>();
	for (const name of readdirSync(SRC).sort()) {
		if (name.endsWith('.ts')) out.set(name.replace(/\.ts$/, '.js'), emitJs(readFileSync(join(SRC, name), 'utf8')));
	}
	return out;
}

/** The names of dist/ files that differ from what src/ emits, are missing or are extra. */
export function staleFiles(): string[] {
	const want = emitAll();
	let have: string[] = [];
	try {
		have = readdirSync(DIST);
	} catch {
		// No dist/ yet: every file is missing.
	}
	const stale = have.filter((name) => !want.has(name));
	for (const [name, text] of want) {
		let current: string | null = null;
		try {
			current = readFileSync(join(DIST, name), 'utf8');
		} catch {
			// Missing.
		}
		if (current !== text) stale.push(name);
	}
	return stale.sort();
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
	rmSync(DIST, { recursive: true, force: true });
	mkdirSync(DIST);
	// The command entry starts with a hashbang and is executable, as a bin.
	for (const [name, text] of emitAll()) writeFileSync(join(DIST, name), text, { mode: text.startsWith('#!') ? 0o755 : 0o644 });
}
