#!/usr/bin/env node

/**
 * assign-categories.mjs
 *
 * Assigns categories to published posts that lack one, based on
 * title, tags, and content analysis.
 *
 * Categories: hardware, software, ecology, music, photography, personal, tutorial, devops
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = join(import.meta.dirname, '..', 'src', 'posts');

// Title-based rules (HIGHEST priority — title is the strongest signal)
const TITLE_RULES = [
	{ pattern: /\b(how to|install|setup|deploy|intro(?:duction)? to|getting started|quick fix)\b/i, category: 'tutorial' },
	{ pattern: /\b(morning metal|evening metal|music sketch|guitar session)\b/i, category: 'music' },
	{ pattern: /\b(gallery of|photo work)\b/i, category: 'photography' },
	{ pattern: /\b(this and that|what have i been up to|summer \d{4} update|oes|ppe)\b/i, category: 'personal' },
];

// Specific tag mapping (high priority, but only for unambiguous tags)
const SPECIFIC_TAG_MAP = {
	Photography: 'photography',
	Music: 'music',
};

// Broad tag mapping (lower priority — applied after keyword analysis)
// These tags are too broad to be definitive on their own
const BROAD_TAG_MAP = {
	Birding: 'ecology',
	'Nature Observations': 'ecology',
	DIY: 'hardware',
	'How-To': 'tutorial',
};

// Keyword patterns for title+body matching
const KEYWORD_RULES = [
	// tutorial — how-to content (before devops since many tutorials deploy things)
	{ pattern: /\b(step.by.step|tutorial|query kml|generate convex hull|gathering point data|gdal for|convert heic)\b/i, category: 'tutorial' },
	// software — programming projects (before devops to catch Flask/TypeScript/Python)
	{ pattern: /\b(python|typescript|javascript|react|flask|mongodb|opencv|npm|chapel|boilerplate|shiny.*app|ipython|accuwix|sveltekit|image server)\b/i, category: 'software' },
	// devops — infrastructure
	{ pattern: /\b(deploy|docker|nginx|raspbian|pi zero|qemu|kvm|remote desktop|nat|vpn|persistent live|cloud computing|samba|file sharing)\b/i, category: 'devops' },
	// hardware — physical builds
	{ pattern: /\b(3d print|fusion 360|solar|watt|panel|solder|pcb|antenna|enclosure|shield|microphone|headphone|amplifier|planar|electrostatic|earspeaker|prius|probe|ligature|mpcnc|cnc)\b/i, category: 'hardware' },
	// ecology — nature content (before music to catch bird/nature posts)
	{ pattern: /\b(bird|warbler|thrush|sparrow|tanager|oriole|owl|hawk|ebird|merlin|audubon|mushroom|toadstool|fungal|sit.?spot|fox park|langdon|wolf pine)\b/i, category: 'ecology' },
	// music — be specific to avoid false positives (e.g. "metal" in non-music content)
	{ pattern: /\b(guitar|soundcloud|music sketch|morning metal|evening metal)\b/i, category: 'music' },
	// photography
	{ pattern: /\b(gallery|photo gallery)\b/i, category: 'photography' },
	// devops — broader patterns
	{ pattern: /\b(aws|ec2|server|ubuntu|linux|ssh)\b/i, category: 'devops' },
	// software — broader
	{ pattern: /\b(esri|arcgis|kml|csv|geojson|gdal|api\b|fetch|r server)\b/i, category: 'software' },
	// personal
	{ pattern: /\b(makerspace|bits and bobs|datasets|plots|graphs)\b/i, category: 'personal' },
];

function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) return null;
	return {
		raw: match[1],
		endIndex: match[0].length,
		body: content.slice(match[0].length),
	};
}

function extractTags(frontmatter) {
	const match = frontmatter.match(/tags:\s*\[(.*?)\]/);
	if (!match) return [];
	return match[1].split(',').map((t) => t.trim().replace(/^["']|["']$/g, ''));
}

function guessCategory(title, tags, body) {
	// Priority 1: Title-based rules (strongest signal)
	for (const rule of TITLE_RULES) {
		if (rule.pattern.test(title)) {
			const match = title.match(rule.pattern);
			return { category: rule.category, reason: `title "${match[0]}"` };
		}
	}

	// Priority 2: Specific (unambiguous) tag mapping
	for (const tag of tags) {
		if (SPECIFIC_TAG_MAP[tag]) return { category: SPECIFIC_TAG_MAP[tag], reason: `tag "${tag}"` };
	}

	// Priority 3: Title + body keyword matching
	const titleAndBody = title + ' ' + body.slice(0, 800);
	for (const rule of KEYWORD_RULES) {
		if (rule.pattern.test(titleAndBody)) {
			const match = titleAndBody.match(rule.pattern);
			return { category: rule.category, reason: `keyword "${match[0]}"` };
		}
	}

	// Priority 4: Broad tag fallback (Birding, DIY, How-To)
	for (const tag of tags) {
		if (BROAD_TAG_MAP[tag]) return { category: BROAD_TAG_MAP[tag], reason: `tag "${tag}" (broad)` };
	}

	// Priority 5: Tags contain "Featured" or "Ideas" — personal
	if (tags.includes('Featured') || tags.includes('Ideas')) {
		return { category: 'personal', reason: 'tag "Featured"/"Ideas" fallback' };
	}

	return { category: 'personal', reason: 'default fallback' };
}

const dryRun = process.argv.includes('--dry-run');
const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();

let assigned = 0;
let skipped = 0;

for (const file of files) {
	const filePath = join(POSTS_DIR, file);
	const content = readFileSync(filePath, 'utf-8');
	const parsed = parseFrontmatter(content);
	if (!parsed) { skipped++; continue; }

	// Skip unpublished
	if (parsed.raw.includes('published: false')) { skipped++; continue; }

	// Skip if already has category
	if (parsed.raw.includes('category:')) { skipped++; continue; }

	const titleMatch = parsed.raw.match(/title:\s*["'](.+?)["']/);
	const title = titleMatch ? titleMatch[1] : file;
	const tags = extractTags(parsed.raw);
	const { category, reason } = guessCategory(title, tags, parsed.body);

	if (dryRun) {
		console.log(`${file} → ${category} (${reason})`);
	} else {
		const newFrontmatter = parsed.raw + `\ncategory: "${category}"`;
		const newContent = `---\n${newFrontmatter}\n---\n${parsed.body}`;
		writeFileSync(filePath, newContent, 'utf-8');
		console.log(`ASSIGNED: ${file} → ${category} (${reason})`);
	}
	assigned++;
}

console.log(`\n--- Summary ---`);
console.log(`Total: ${files.length}, Assigned: ${assigned}, Skipped: ${skipped}`);
if (dryRun) console.log(`(DRY RUN — no files modified)`);
