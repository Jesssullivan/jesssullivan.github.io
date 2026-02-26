#!/usr/bin/env node

/**
 * convert-code-blocks.mjs
 *
 * Converts 4-space indented code blocks to fenced (```) code blocks
 * with language hints. This fixes mdsvex rendering issues where <, >, {, }
 * in indented blocks are parsed as HTML/Svelte instead of literal text.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = join(import.meta.dirname, '..', 'src', 'posts');

function detectLanguage(lines) {
	const text = lines.join('\n');

	// Chapel — Shiki doesn't support it, use plain text
	if (/\b(module|proc|writeln|use\s+\w+;)\b/.test(text)) return '';
	// R
	if (/(<-\s|library\(|install\.packages|data\.frame|ggplot|tidyverse)/.test(text)) return 'r';
	// Python
	if (/\b(def\s+\w+|import\s+\w+|from\s+\w+\s+import|print\(|if\s+__name__)\b/.test(text)) return 'python';
	if (text.startsWith('#!') && text.includes('python')) return 'python';
	// TypeScript/JavaScript
	if (/\b(const\s+|let\s+|import\s+{|export\s+|interface\s+|=>\s*{|async\s+function|\.then\(|\.catch\(|Promise)\b/.test(text)) return 'typescript';
	// Bash/shell
	if (/^(\$\s+|sudo\s|apt\s|pip\s|npm\s|curl\s|wget\s|chmod\s|mkdir\s|cd\s|git\s|brew\s|yum\s|dnf\s)/m.test(text)) return 'bash';
	if (/^#!/.test(text)) return 'bash';
	// Config files
	if (/^(run_as|server\s*{|listen\s|location\s|access_log)$/m.test(text)) return 'conf';
	// HTML/XML
	if (/<\/?[a-z]+[\s>]/i.test(text) && !/<-/.test(text)) return 'html';
	// SQL
	if (/\b(SELECT|INSERT|CREATE TABLE|ALTER TABLE)\b/i.test(text)) return 'sql';

	// Shell-like single commands
	if (lines.length <= 3 && /^[a-z_.\/]/.test(lines[0])) return 'bash';

	return '';
}

function isListContinuation(prevNonBlankLine) {
	if (!prevNonBlankLine) return false;
	return /^(\s*[-*+]\s|\s*\d+\.\s)/.test(prevNonBlankLine);
}

function isIndented(line) {
	return /^( {4}|\t)/.test(line);
}

function dedent(line) {
	if (line.startsWith('\t')) return line.slice(1);
	if (line.startsWith('    ')) return line.slice(4);
	return line;
}

function convertPost(content) {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!frontmatterMatch) return { content, changed: false, blocks: 0 };

	const frontmatter = frontmatterMatch[0];
	const body = content.slice(frontmatter.length);
	const lines = body.split('\n');

	const output = [];
	let i = 0;
	let prevNonBlankLine = '';
	let blockCount = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Check if this starts an indented code block
		if (isIndented(line) && !isListContinuation(prevNonBlankLine)) {
			// Collect all lines in this indented block
			const blockLines = [];
			let j = i;

			while (j < lines.length) {
				if (isIndented(lines[j])) {
					blockLines.push(dedent(lines[j]));
					j++;
				} else if (lines[j].trim() === '') {
					// Blank line — check if the block continues after it
					let k = j + 1;
					while (k < lines.length && lines[k].trim() === '') k++;
					if (k < lines.length && isIndented(lines[k])) {
						// Block continues after blank line(s)
						for (let b = j; b < k; b++) blockLines.push('');
						j = k;
					} else {
						// Block ends here
						break;
					}
				} else {
					// Non-blank, non-indented — block ends
					break;
				}
			}

			// Remove trailing blank lines from block
			while (blockLines.length && blockLines[blockLines.length - 1].trim() === '') {
				blockLines.pop();
			}

			if (blockLines.length > 0) {
				const lang = detectLanguage(blockLines);
				output.push('```' + lang);
				output.push(...blockLines);
				output.push('```');
				blockCount++;
			}

			i = j;
		} else {
			output.push(line);
			if (line.trim() !== '') prevNonBlankLine = line;
			i++;
		}
	}

	const newBody = output.join('\n');
	const newContent = frontmatter + newBody;

	return {
		content: newContent,
		changed: newBody !== body,
		blocks: blockCount,
	};
}

const dryRun = process.argv.includes('--dry-run');
const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();

let totalBlocks = 0;
let modifiedFiles = 0;

for (const file of files) {
	const filePath = join(POSTS_DIR, file);
	const content = readFileSync(filePath, 'utf-8');

	// Skip unpublished
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (frontmatterMatch && frontmatterMatch[1].includes('published: false')) continue;

	const result = convertPost(content);

	if (result.changed) {
		if (dryRun) {
			console.log(`${file}: ${result.blocks} block(s) to convert`);
		} else {
			writeFileSync(filePath, result.content, 'utf-8');
			console.log(`CONVERTED: ${file} (${result.blocks} blocks)`);
		}
		totalBlocks += result.blocks;
		modifiedFiles++;
	}
}

console.log(`\n--- Summary ---`);
console.log(`Files: ${modifiedFiles}, Blocks: ${totalBlocks}`);
if (dryRun) console.log('(DRY RUN — no files modified)');
