import {
	accessSync,
	constants,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	statSync,
	symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const runtimeRoot = mkdtempSync(join(tmpdir(), 'ghio-sveltekit-vite-build-'));
const buildRoot = join(runtimeRoot, 'workspace');

mkdirSync(buildRoot, { recursive: true });
ensureWritableEnvDir('HOME', join(runtimeRoot, 'home'));
ensureWritableEnvDir('XDG_CONFIG_HOME', join(runtimeRoot, 'xdg-config'));
ensureWritableEnvDir('XDG_CACHE_HOME', join(runtimeRoot, 'xdg-cache'));
process.env.CI = 'true';
process.env.NODE_ENV = 'production';
process.env.MERMAID_PRERENDER = process.env.MERMAID_PRERENDER ?? 'optional';

copyInputsToBuildRoot();
linkNodeModules();

const packageJson = JSON.parse(readFileSync(join(buildRoot, 'package.json'), 'utf8'));

for (const command of [
	['tsx', 'scripts/ingest-tinyland-posts.mts', '--check'],
	['tsx', 'scripts/generate-search-index.mts'],
	['tsx', 'scripts/generate-blog-stats.mts'],
	['tsx', 'scripts/generate-tag-graph.mts'],
	['tsx', 'scripts/generate-photo-gallery.mts'],
	['tsx', 'scripts/validate-pulse-snapshot.mts'],
	['svelte-kit', 'sync'],
	['vite', 'build'],
	['tsx', 'scripts/generate-redirects.mts'],
	['tsx', 'scripts/generate-directory-index-aliases.mts'],
	['tsx', 'scripts/validate-redirects.mts'],
	['tsx', 'scripts/validate-directory-index-aliases.mts'],
	['tsx', 'scripts/validate-frontmatter.mts'],
	['tsx', 'scripts/audit-links.mts'],
]) {
	run(command[0], command.slice(1));
}

const indexPath = join(buildRoot, 'build', 'index.html');
const searchIndexPath = join(buildRoot, 'static', 'search-index.json');
if (!existsSync(indexPath)) {
	throw new Error(`SvelteKit build did not write ${indexPath}`);
}
if (!existsSync(searchIndexPath)) {
	throw new Error(`Build preflight did not write ${searchIndexPath}`);
}

const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('<!doctype html>')) {
	throw new Error('SvelteKit build output index.html is missing doctype');
}

assertUnpublishedPostContentExcluded();

console.log(
	`SvelteKit/Vite build smoke passed for ${packageJson.name}; output=${indexPath}; mermaid=${process.env.MERMAID_PRERENDER}`,
);

function copyInputsToBuildRoot() {
	for (const dir of ['packages', 'scripts', 'src', 'static']) {
		copyPath(resolve(workspaceRoot, dir), resolve(buildRoot, dir));
	}

	for (const file of [
		'.npmrc',
		'package-lock.json',
		'package.json',
		'pnpm-lock.yaml',
		'svelte.config.js',
		'tsconfig.json',
		'vite.config.ts',
	]) {
		copyPath(resolve(workspaceRoot, file), resolve(buildRoot, file));
	}
}

function assertUnpublishedPostContentExcluded() {
	const postsDir = join(buildRoot, 'src', 'posts');
	const appDir = join(buildRoot, 'build', '_app');
	const posts = readdirSync(postsDir)
		.filter((file) => file.endsWith('.md'))
		.map((file) => ({ file, source: readFileSync(join(postsDir, file), 'utf8') }));
	const publishedCorpus = posts
		.filter(({ source }) => /^published:\s*true\s*$/m.test(frontmatter(source)))
		.map(({ source }) => source)
		.join('\n');
	const unpublishedPosts = posts
		.filter(({ source }) => !/^published:\s*true\s*$/m.test(frontmatter(source)))
		.map(({ file, source }) => ({
			file,
			sentinel: publicationSentinel(file, source, publishedCorpus),
		}));
	const appAssets = collectFiles(appDir).map((file) => ({
		file,
		source: readFileSync(file, 'utf8'),
	}));

	for (const unpublishedPost of unpublishedPosts) {
		const leak = appAssets.find(({ source }) => assetContains(source, unpublishedPost.sentinel));
		if (leak) {
			throw new Error(`Unpublished post ${unpublishedPost.file} leaked into client asset ${leak.file}`);
		}
	}

	console.log(`Unpublished-post asset scan passed for ${unpublishedPosts.length} posts`);
}

function frontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	return match?.[1] ?? '';
}

function publicationSentinel(file, source, publishedCorpus) {
	const block = frontmatter(source);
	const bodyLines = source
		.slice(source.indexOf(block) + block.length)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length >= 32 && !/^(?:[#>*_`-]|\d+\.)/.test(line));
	const candidates = [frontmatterScalar(block, 'description'), frontmatterScalar(block, 'title'), ...bodyLines].filter(
		(candidate) => candidate.length >= 24,
	);
	const sentinel = candidates.find((candidate) => !publishedCorpus.includes(candidate));
	if (!sentinel) {
		throw new Error(`Unpublished post ${file} has no unique public-asset sentinel`);
	}
	return sentinel;
}

function frontmatterScalar(block, key) {
	const match = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
	if (!match) return '';
	const raw = match[1].trim();
	if (raw.startsWith('"') && raw.endsWith('"')) {
		return JSON.parse(raw);
	}
	if (raw.startsWith("'") && raw.endsWith("'")) {
		return raw.slice(1, -1).replaceAll("''", "'");
	}
	return raw;
}

function assetContains(source, sentinel) {
	const jsonEscaped = JSON.stringify(sentinel).slice(1, -1);
	const singleQuoteEscaped = sentinel.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	return source.includes(sentinel) || source.includes(jsonEscaped) || source.includes(singleQuoteEscaped);
}

function collectFiles(root) {
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const path = join(root, entry.name);
		return entry.isDirectory() ? collectFiles(path) : [path];
	});
}

function copyPath(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Missing declared build input: ${source}`);
	}

	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, {
		dereference: true,
		errorOnExist: false,
		force: true,
		preserveTimestamps: false,
		recursive: true,
	});
}

function linkNodeModules() {
	const sourceNodeModules = resolve(workspaceRoot, 'node_modules');
	const buildNodeModules = resolve(buildRoot, 'node_modules');
	if (!existsSync(sourceNodeModules)) {
		throw new Error(`Missing Bazel node_modules tree: ${sourceNodeModules}`);
	}

	mkdirSync(buildNodeModules, { recursive: true });
	for (const entry of readdirSync(sourceNodeModules, { withFileTypes: true })) {
		if (entry.name === '@blog') {
			continue;
		}

		const sourcePath = resolve(sourceNodeModules, entry.name);
		const destinationPath = resolve(buildNodeModules, entry.name);
		if (entry.name.startsWith('@') && entry.isDirectory()) {
			mkdirSync(destinationPath, { recursive: true });
			for (const scopedEntry of readdirSync(sourcePath, { withFileTypes: true })) {
				symlinkSync(resolve(sourcePath, scopedEntry.name), resolve(destinationPath, scopedEntry.name), 'dir');
			}
		} else {
			symlinkSync(sourcePath, destinationPath, entry.isDirectory() ? 'dir' : 'file');
		}
	}

	const blogScope = resolve(buildNodeModules, '@blog');
	mkdirSync(blogScope, { recursive: true });
	for (const [name, packageDir] of [
		['pulse-client', 'pulse-client'],
		['pulse-core', 'pulse-core'],
	]) {
		symlinkSync(resolve(buildRoot, 'packages', packageDir), resolve(blogScope, name), 'dir');
	}

	linkPackageDependencies(buildNodeModules, join(buildRoot, 'package.json'), [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
	]);
	linkWorkspacePackageDependencies(buildNodeModules);
}

function linkPackageDependencies(buildNodeModules, packageJsonPath, sections) {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	for (const dependencyName of sections.flatMap((section) => Object.keys(packageJson[section] ?? {}))) {
		if (dependencyName.startsWith('@blog/')) {
			continue;
		}
		linkRootPackageIfMissing(buildNodeModules, dependencyName);
	}
}

function linkWorkspacePackageDependencies(buildNodeModules) {
	for (const packageDir of ['pulse-client', 'pulse-core']) {
		const packageJsonPath = resolve(buildRoot, 'packages', packageDir, 'package.json');
		linkPackageDependencies(buildNodeModules, packageJsonPath, ['dependencies']);
	}
}

function linkRootPackageIfMissing(buildNodeModules, packageName) {
	const destination = resolvePackagePath(buildNodeModules, packageName);
	if (existsSync(destination)) {
		return;
	}

	const source = findAspectPackage(buildNodeModules, packageName);
	if (!source) {
		throw new Error(`Missing workspace dependency ${packageName} in Bazel npm store`);
	}

	mkdirSync(dirname(destination), { recursive: true });
	symlinkSync(source, destination, 'dir');
}

function resolvePackagePath(nodeModules, packageName) {
	return resolve(nodeModules, ...packageName.split('/'));
}

function findAspectPackage(buildNodeModules, packageName) {
	const aspectStore = resolve(buildNodeModules, '.aspect_rules_js');
	const packagePath = packageName.split('/');
	if (!existsSync(aspectStore)) {
		return '';
	}

	for (const entry of readdirSync(aspectStore, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const candidate = resolve(aspectStore, entry.name, 'node_modules', ...packagePath);
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return '';
}

function run(binaryName, args) {
	const binary = resolveBinEntrypoint(binaryName);
	const result = spawnSync(process.execPath, [binary, ...args], {
		cwd: buildRoot,
		env: process.env,
		stdio: 'inherit',
	});

	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		throw new Error(`${binaryName} ${args.join(' ')} failed with exit code ${result.status}`);
	}
}

function resolveBinEntrypoint(name) {
	const entrypoints = {
		'svelte-kit': ['@sveltejs/kit', 'svelte-kit.js'],
		tsx: ['tsx', 'dist/cli.mjs'],
		vite: ['vite', 'bin/vite.js'],
	};
	const [packageName, relativePath] = entrypoints[name] ?? [];
	if (!packageName) {
		throw new Error(`Unknown npm binary ${name}`);
	}

	const entrypoint = resolve(buildRoot, 'node_modules', packageName, relativePath);
	if (!existsSync(entrypoint)) {
		throw new Error(`Missing npm binary ${name}: ${entrypoint}`);
	}
	return entrypoint;
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
