#!/usr/bin/env node

/**
 * Clean up placeholder text fused with actual content.
 * These are lines like: "*Gone with the WordPress -- this image no longer exists online.*Actual content here..."
 * Strips the placeholder prefix and keeps the content.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = 'src/posts';
const DRY_RUN = process.argv.includes('--dry-run');

// Match placeholder text at the start of a line, followed by actual content
const FUSED_RE = /^\*(?:The bits that made up|Gone with the WordPress|This image was a casualty|Another image lost|An image was here|Lost to the void|Digital entropy claimed|The server that hosted|The original image|This image existed once|What was once an image|The original image, once hosted|This visual has drifted|This space once held|Image from the original|The photograph that was|Image no longer available|This image didn't survive|Image unavailable)[^*]*\*(.+)$/;

async function main() {
	console.log(DRY_RUN ? '=== DRY RUN ===' : '=== CLEANING FUSED PLACEHOLDERS ===');

	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	let totalFixed = 0;

	for (const file of files) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const lines = content.split('\n');
		let modified = false;

		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].trim().match(FUSED_RE);
			if (match) {
				const realContent = match[1].trim();
				console.log(`${file}:${i + 1}`);
				console.log(`  BEFORE: ${lines[i].slice(0, 100)}...`);
				console.log(`  AFTER:  ${realContent.slice(0, 100)}...`);
				if (!DRY_RUN) {
					lines[i] = realContent;
					modified = true;
				}
				totalFixed++;
			}
		}

		if (modified) {
			await writeFile(join(POSTS_DIR, file), lines.join('\n'), 'utf-8');
		}
	}

	console.log(`\n${totalFixed} fused placeholders cleaned`);
	if (DRY_RUN) console.log('(dry run — no files modified)');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
