#!/usr/bin/env node
/**
 * render-mermaid.mts
 *
 * Pre-renders mermaid code blocks from blog posts into SVG files.
 * The mdsvex highlighter in svelte.config.js reads these cached SVGs
 * and inlines them, eliminating the ~950KB client-side mermaid.js bundle.
 *
 * Output: .mermaid-cache/<hash>.svg for each unique mermaid block.
 * Also writes .mermaid-cache/manifest.json mapping hash → SVG path.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { platform } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const POSTS_DIR = resolve(ROOT, 'src/posts');
const CACHE_DIR = resolve(ROOT, '.mermaid-cache');
const PUPPETEER_CONFIG = resolve(CACHE_DIR, 'puppeteer-config.json');
const MMDC_BIN = resolve(
	ROOT,
	'node_modules',
	'.bin',
	platform === 'win32' ? 'mmdc.cmd' : 'mmdc'
);

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(
	PUPPETEER_CONFIG,
	JSON.stringify({
		args: process.env.CI || process.env.GITHUB_ACTIONS ? ['--no-sandbox'] : []
	})
);

interface MermaidBlock {
	code: string;
	file: string;
	offset: number;
}

interface MermaidManifest {
	[hash: string]: { file: string; hash: string };
}

function extractMermaidBlocks(postsDir: string): MermaidBlock[] {
	const blocks: MermaidBlock[] = [];
	const files = readdirSync(postsDir).filter(f => f.endsWith('.md'));

	for (const file of files) {
		const content = readFileSync(resolve(postsDir, file), 'utf-8');
		const regex = /```mermaid\n([\s\S]*?)```/g;
		let match;
		while ((match = regex.exec(content)) !== null) {
			blocks.push({
				code: match[1].trim(),
				file,
				offset: match.index
			});
		}
	}
	return blocks;
}

function hashCode(code: string): string {
	return createHash('sha256').update(code).digest('hex').slice(0, 16);
}

function loadManifest(): MermaidManifest {
	const manifestPath = resolve(CACHE_DIR, 'manifest.json');
	if (existsSync(manifestPath)) {
		try {
			return JSON.parse(readFileSync(manifestPath, 'utf-8'));
		} catch { /* corrupted, start fresh */ }
	}
	return {};
}

function saveManifest(manifest: MermaidManifest): void {
	writeFileSync(
		resolve(CACHE_DIR, 'manifest.json'),
		JSON.stringify(manifest, null, 2)
	);
}

function renderToSvg(code: string, hash: string): boolean {
	const inputFile = resolve(tmpdir(), `mermaid-${hash}.mmd`);
	const outputFile = resolve(CACHE_DIR, `${hash}.svg`);

	writeFileSync(inputFile, code);

	try {
		if (!existsSync(MMDC_BIN)) {
			throw new Error(`Missing Mermaid CLI binary at ${MMDC_BIN}`);
		}

		execFileSync(
			MMDC_BIN,
			[
				'-i',
				inputFile,
				'-o',
				outputFile,
				'-b',
				'transparent',
				'--outputFormat',
				'svg',
				'--width',
				'1200',
				'-p',
				PUPPETEER_CONFIG
			],
			{
				cwd: ROOT,
				timeout: 30000,
				stdio: 'pipe'
			}
		);

		if (existsSync(outputFile)) {
			let svg = readFileSync(outputFile, 'utf-8');
			// mmdc sometimes wraps in HTML; extract just the <svg>
			const svgMatch = svg.match(/<svg[\s\S]*<\/svg>/);
			if (svgMatch) {
				svg = svgMatch[0];
			}
			const uniqueId = `mermaid-${hash}`;
			svg = svg
				.replace(/id="my-svg"/g, `id="${uniqueId}"`)
				.replace(/#my-svg/g, `#${uniqueId}`)
				.replace(/ role="[^"]*"/g, '')
				.replace(/ aria-roledescription="[^"]*"/g, '')
				.replace(/style="[^"]*"/, 'style="max-width:100%;height:auto"');
			writeFileSync(outputFile, svg);
			return true;
		}
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes("Cannot find package 'puppeteer'")) {
			console.error(
				`  Failed to render ${hash}: ${message}. Install dev dependencies so Mermaid diagrams can be prerendered.`
			);
		} else {
			console.error(`  Failed to render ${hash}: ${message}`);
		}
	}
	return false;
}

// Main
const blocks = extractMermaidBlocks(POSTS_DIR);
console.log(`Found ${blocks.length} mermaid blocks across posts`);

if (blocks.length === 0) {
	console.log('No mermaid blocks to render');
	saveManifest({});
	process.exit(0);
}

const manifest = loadManifest();
let rendered = 0;
let cached = 0;
let failed = 0;

for (const block of blocks) {
	const hash = hashCode(block.code);
	const svgPath = resolve(CACHE_DIR, `${hash}.svg`);

	if (manifest[hash] && existsSync(svgPath)) {
		cached++;
		continue;
	}

	process.stdout.write(`  Rendering ${hash} (${block.file})... `);
	if (renderToSvg(block.code, hash)) {
		manifest[hash] = { file: block.file, hash };
		rendered++;
		console.log('ok');
	} else {
		failed++;
		console.log('FAILED');
	}
}

saveManifest(manifest);
console.log(`Done: ${rendered} rendered, ${cached} cached, ${blocks.length} total`);

if (failed > 0) {
	console.error(
		`Mermaid prerender failed for ${failed} block(s). Refusing to continue with missing or stale diagram output.`
	);
	process.exit(1);
}
