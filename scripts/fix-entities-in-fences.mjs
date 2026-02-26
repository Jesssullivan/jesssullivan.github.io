#!/usr/bin/env node

/**
 * fix-entities-in-fences.mjs
 *
 * Converts HTML entities back to bare characters inside fenced code blocks.
 * Now that code is in fenced blocks (```), mdsvex won't parse < > { } as HTML/Svelte.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = join(import.meta.dirname, '..', 'src', 'posts');
const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();

let totalFixed = 0;

for (const file of files) {
	const filePath = join(POSTS_DIR, file);
	const content = readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	let inFence = false;
	let changed = 0;

	const output = lines.map((line) => {
		if (line.startsWith('```')) {
			inFence = !inFence;
			return line;
		}
		if (inFence && /&lt;|&gt;|&#123;|&#125;/.test(line)) {
			changed++;
			return line
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&#123;/g, '{')
				.replace(/&#125;/g, '}');
		}
		return line;
	});

	if (changed > 0) {
		writeFileSync(filePath, output.join('\n'), 'utf-8');
		console.log(`${file}: fixed ${changed} lines`);
		totalFixed += changed;
	}
}

console.log(`\nTotal: ${totalFixed} lines fixed`);
