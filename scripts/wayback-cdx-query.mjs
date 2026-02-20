#!/usr/bin/env node
/**
 * Wayback Machine CDX API Query
 *
 * Queries the Wayback Machine CDX API for archived media files
 * from transscendsurvival.org/wp-content/uploads/.
 *
 * Usage:
 *   node scripts/wayback-cdx-query.mjs [options]
 *
 * Options:
 *   --output <path>   Write results to JSON file (default: stdout)
 *   --dry-run         Show query URL without executing
 *   --url <pattern>   Custom URL pattern to search (default: transscendsurvival.org/wp-content/uploads/*)
 *   --limit <n>       Max results (default: unlimited)
 */

import { writeFileSync } from 'fs';
import { parseCdxResponse } from './wayback-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;
const urlIdx = args.indexOf('--url');
const urlPattern = urlIdx >= 0 ? args[urlIdx + 1] : 'transscendsurvival.org/wp-content/uploads/*';
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

const cdxUrl = new URL('https://web.archive.org/cdx/search/cdx');
cdxUrl.searchParams.set('url', urlPattern);
cdxUrl.searchParams.set('output', 'json');
cdxUrl.searchParams.set('filter', 'mimetype:image/.*');
cdxUrl.searchParams.set('collapse', 'digest'); // deduplicate by content hash
cdxUrl.searchParams.set('filter', 'statuscode:200');
if (limit) cdxUrl.searchParams.set('limit', String(limit));

console.error(`CDX Query URL: ${cdxUrl.toString()}`);

if (dryRun) {
	console.log('Dry run — would query:');
	console.log(cdxUrl.toString());
	process.exit(0);
}

async function queryWithRetry(url, retries = 3) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			console.error(`Attempt ${attempt}/${retries}...`);
			const res = await fetch(url.toString());
			if (res.status === 429) {
				const wait = Math.pow(2, attempt) * 2000;
				console.error(`Rate limited. Waiting ${wait / 1000}s...`);
				await new Promise((r) => setTimeout(r, wait));
				continue;
			}
			if (!res.ok) {
				throw new Error(`CDX API returned ${res.status}: ${res.statusText}`);
			}
			return await res.json();
		} catch (err) {
			if (attempt === retries) throw err;
			const wait = Math.pow(2, attempt) * 1000;
			console.error(`Error: ${err.message}. Retrying in ${wait / 1000}s...`);
			await new Promise((r) => setTimeout(r, wait));
		}
	}
}

try {
	const data = await queryWithRetry(cdxUrl);
	const records = parseCdxResponse(data);

	console.error(`Found ${records.length} unique archived images.`);

	if (outputPath) {
		writeFileSync(outputPath, JSON.stringify(records, null, 2));
		console.error(`Written to ${outputPath}`);
	} else {
		console.log(JSON.stringify(records, null, 2));
	}

	// Summary by year
	const byYear = {};
	for (const r of records) {
		const year = r.timestamp.substring(0, 4);
		byYear[year] = (byYear[year] || 0) + 1;
	}
	console.error('\nArchived images by year:');
	for (const [year, count] of Object.entries(byYear).sort()) {
		console.error(`  ${year}: ${count}`);
	}
} catch (err) {
	console.error(`Failed: ${err.message}`);
	process.exit(1);
}
