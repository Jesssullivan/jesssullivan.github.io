/**
 * validate-frontmatter.mts — CI-ready frontmatter validation for blog posts.
 * Uses the Effect Schema from @blog/agent as the single source of truth.
 *
 * Usage: tsx scripts/validate-frontmatter.mts
 * Exit 0 = all pass, Exit 1 = errors found
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseFrontmatter, POST_CATEGORIES } from './lib/frontmatter.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const postsDir = join(__dirname, '..', 'src', 'posts');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(s: string): boolean {
	if (!ISO_DATE_RE.test(s)) return false;
	const d = new Date(s + 'T00:00:00Z');
	return !isNaN(d.getTime());
}

const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
const errors: string[] = [];
const warnings: string[] = [];
const slugs = new Map<string, string>(); // slug -> filename
let passCount = 0;

for (const file of files) {
	const filepath = join(postsDir, file);
	const content = readFileSync(filepath, 'utf-8');
	const fm = parseFrontmatter(content);

	if (!fm) {
		errors.push(`${file}: no frontmatter found`);
		continue;
	}

	const fileErrors: string[] = [];
	const fileWarns: string[] = [];

	// --- Required fields ---

	// title
	if (fm.title == null || typeof fm.title !== 'string' || (fm.title as string).length === 0) {
		fileErrors.push('missing or invalid "title" (must be non-empty string)');
	}

	// date
	if (fm.date == null) {
		fileErrors.push('missing "date"');
	} else if (typeof fm.date !== 'string') {
		fileErrors.push(`"date" must be a string, got ${typeof fm.date}`);
	} else if (!isValidISODate(fm.date as string)) {
		fileErrors.push(`"date" is not a valid ISO date: "${fm.date}"`);
	}

	// description
	if (fm.description == null || typeof fm.description !== 'string' || (fm.description as string).length === 0) {
		fileErrors.push('missing or invalid "description" (must be non-empty string)');
	}

	// tags
	if (fm.tags == null) {
		fileErrors.push('missing "tags"');
	} else if (!Array.isArray(fm.tags)) {
		fileErrors.push(`"tags" must be an array, got ${typeof fm.tags}`);
	}

	// published
	if (fm.published == null) {
		fileErrors.push('missing "published"');
	} else if (typeof fm.published !== 'boolean') {
		fileErrors.push(`"published" must be a boolean, got ${typeof fm.published}`);
	}

	// --- Optional field type checks (warnings) ---

	if (fm.slug != null && typeof fm.slug !== 'string') {
		fileWarns.push(`"slug" should be a string, got ${typeof fm.slug}`);
	}
	if (fm.original_url != null && typeof fm.original_url !== 'string') {
		fileWarns.push(`"original_url" should be a string, got ${typeof fm.original_url}`);
	}
	if (fm.excerpt != null && typeof fm.excerpt !== 'string') {
		fileWarns.push(`"excerpt" should be a string, got ${typeof fm.excerpt}`);
	}
	if (fm.category != null) {
		if (typeof fm.category !== 'string') {
			fileWarns.push(`"category" should be a string, got ${typeof fm.category}`);
		} else if (!POST_CATEGORIES.includes(fm.category as typeof POST_CATEGORIES[number])) {
			fileWarns.push(
				`"category" must be one of [${POST_CATEGORIES.join(', ')}], got "${fm.category}"`
			);
		}
	}
	if (fm.categories != null && !Array.isArray(fm.categories)) {
		fileWarns.push(`"categories" should be an array, got ${typeof fm.categories}`);
	}
	if (fm.reading_time != null && typeof fm.reading_time !== 'number') {
		fileWarns.push(`"reading_time" should be a number, got ${typeof fm.reading_time}`);
	}
	if (fm.feature_image != null && typeof fm.feature_image !== 'string') {
		fileWarns.push(`"feature_image" should be a string, got ${typeof fm.feature_image}`);
	}
	if (fm.thumbnail_image != null && typeof fm.thumbnail_image !== 'string') {
		fileWarns.push(`"thumbnail_image" should be a string, got ${typeof fm.thumbnail_image}`);
	}
	if (fm.featured != null && typeof fm.featured !== 'boolean') {
		fileWarns.push(`"featured" should be a boolean, got ${typeof fm.featured}`);
	}
	if (fm.author_slug != null && typeof fm.author_slug !== 'string') {
		fileWarns.push(`"author_slug" should be a string, got ${typeof fm.author_slug}`);
	}

	// --- Slug uniqueness ---

	const slug =
		typeof fm.slug === 'string' && (fm.slug as string).length > 0
			? (fm.slug as string)
			: file.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

	if (slugs.has(slug)) {
		fileErrors.push(`duplicate slug "${slug}" (also in ${slugs.get(slug)})`);
	} else {
		slugs.set(slug, file);
	}

	// --- Collect ---

	if (fileErrors.length > 0) {
		errors.push(...fileErrors.map((e) => `${file}: ${e}`));
	}
	if (fileWarns.length > 0) {
		warnings.push(...fileWarns.map((w) => `${file}: ${w}`));
	}
	if (fileErrors.length === 0) {
		passCount++;
	}
}

console.log(`\nFrontmatter validation: ${files.length} posts scanned\n`);

if (warnings.length > 0) {
	console.log(`Warnings (${warnings.length}):`);
	for (const w of warnings) console.log(`  WARN  ${w}`);
	console.log();
}

if (errors.length > 0) {
	console.error(`Errors (${errors.length}):`);
	for (const e of errors) console.error(`  FAIL  ${e}`);
	console.log();
	console.log(`Result: ${passCount}/${files.length} passed, ${files.length - passCount} failed`);
	process.exit(1);
} else {
	console.log(`Result: ${passCount}/${files.length} passed. All frontmatter valid.`);
	process.exit(0);
}
