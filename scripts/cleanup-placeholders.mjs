#!/usr/bin/env node

/**
 * Clean up unrecoverable image placeholders in blog posts.
 *
 * Replaces multiple poetic placeholder lines with a single notice.
 * Run AFTER relace-wp-images.mjs has matched all recoverable images.
 *
 * Usage:
 *   node scripts/cleanup-placeholders.mjs --dry-run   # Preview changes
 *   node scripts/cleanup-placeholders.mjs              # Apply changes
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = 'src/posts';
const DRY_RUN = process.argv.includes('--dry-run');

// Same regex as relace-wp-images.mjs
const PLACEHOLDER_RE = /^\*(?:The bits that made up|Gone with the WordPress|This image was a casualty|Another image lost|An image was here|Lost to the void|Digital entropy claimed|The server that hosted|The original image|This image existed once|What was once an image|The original image, once hosted|This visual has drifted|This space once held|Image from the original|The photograph that was|Image no longer available|This image didn't survive|Image unavailable).+\*$/;

const NOTICE = '*Some images from the original WordPress post are no longer available.*';

// Also match table-row placeholders like "*placeholder* | *placeholder*"
const TABLE_PLACEHOLDER_RE = /^\*(?:The bits|Gone with|This image|Another image|An image|Lost to|Digital entropy|The server|The original|This image existed|What was once|This visual|This space|Image from|The photograph|Image no longer|This image didn't|Image unavailable).+\*\s*\|\s*\*.+\*$/;

async function main() {
	console.log(DRY_RUN ? '=== DRY RUN ===' : '=== CLEANING UP PLACEHOLDERS ===');

	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	let totalCleaned = 0;
	let postsModified = 0;

	for (const file of files) {
		const content = await readFile(join(POSTS_DIR, file), 'utf-8');
		const lines = content.split('\n');

		// Find all placeholder lines and table-row placeholders
		const placeholderIndices = [];
		for (let i = 0; i < lines.length; i++) {
			const trimmed = lines[i].trim();
			if (PLACEHOLDER_RE.test(trimmed) || TABLE_PLACEHOLDER_RE.test(trimmed)) {
				placeholderIndices.push(i);
			}
		}

		if (placeholderIndices.length === 0) continue;

		// Group consecutive placeholder lines (including blank lines between them and table separators)
		const groups = [];
		let currentGroup = [placeholderIndices[0]];

		for (let i = 1; i < placeholderIndices.length; i++) {
			const prev = placeholderIndices[i - 1];
			const curr = placeholderIndices[i];
			// Allow gaps of up to 3 lines (blank lines, table separators like ---|---)
			if (curr - prev <= 3) {
				// Include any intermediate lines (blanks, table separators)
				for (let j = prev + 1; j < curr; j++) {
					currentGroup.push(j);
				}
				currentGroup.push(curr);
			} else {
				groups.push([...currentGroup]);
				currentGroup = [curr];
			}
		}
		groups.push(currentGroup);

		console.log(`${file}: ${placeholderIndices.length} placeholders in ${groups.length} group(s)`);

		if (DRY_RUN) {
			totalCleaned += placeholderIndices.length;
			postsModified++;
			continue;
		}

		// Replace each group with a single notice
		// Work backwards to preserve line indices
		const newLines = [...lines];
		for (let g = groups.length - 1; g >= 0; g--) {
			const group = groups[g].sort((a, b) => a - b);
			const start = group[0];
			const end = group[group.length - 1];

			// Remove blank lines immediately before the group (cleanup)
			let removeStart = start;
			while (removeStart > 0 && newLines[removeStart - 1].trim() === '') {
				removeStart--;
			}

			// Remove blank lines immediately after the group
			let removeEnd = end;
			while (removeEnd < newLines.length - 1 && newLines[removeEnd + 1].trim() === '') {
				removeEnd++;
			}

			// Replace the range with a single notice + blank line
			const count = removeEnd - removeStart + 1;
			newLines.splice(removeStart, count, '', NOTICE, '');
		}

		await writeFile(join(POSTS_DIR, file), newLines.join('\n'), 'utf-8');
		totalCleaned += placeholderIndices.length;
		postsModified++;
	}

	console.log(`\n=== SUMMARY ===`);
	console.log(`${totalCleaned} placeholders cleaned across ${postsModified} posts`);
	if (DRY_RUN) console.log('(dry run — no files modified)');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
