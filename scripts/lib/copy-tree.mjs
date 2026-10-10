import { chmodSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Copy a Bazel runfiles tree into a writable scratch root, following every
 * symlink at every depth.
 *
 * On the Node 22.22 toolchain (Kit 3 needs Node >= 22.17),
 * `cpSync(src, dst, { recursive: true, dereference: true })` dereferences only
 * the top-level source and copies NESTED symlinks as symlinks. A later write
 * through such a link (for example `static/search-index.json`) lands in the
 * read-only sandbox input and fails with EROFS. `statSync` and `copyFileSync`
 * follow every symlink, so each entry here is a new, writable file. The same
 * fix is in xoxd-ai/site.scaffold (U1, `copyTreeDereferenced`).
 *
 * @param {string} source
 * @param {string} destination
 * @param {{ skipNodeModules?: boolean }} [options]
 */
export function copyTreeDereferenced(source, destination, options = {}) {
	if (options.skipNodeModules && source.split(sep).includes('node_modules')) {
		return;
	}
	const stats = statSync(source);
	if (stats.isDirectory()) {
		mkdirSync(destination, { recursive: true });
		chmodSync(destination, 0o755);
		for (const entry of readdirSync(source)) {
			copyTreeDereferenced(join(source, entry), join(destination, entry), options);
		}
		return;
	}
	copyFileSync(source, destination);
	chmodSync(destination, stats.mode & 0o111 ? 0o755 : 0o644);
}
