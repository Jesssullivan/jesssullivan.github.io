#!/usr/bin/env node
/**
 * Wayback Media Recovery Orchestrator
 *
 * Runs the full pipeline: audit → CDX query → download → update posts.
 * Can run individual steps or the full pipeline.
 *
 * Usage:
 *   node scripts/wayback-recover.mjs [options]
 *
 * Options:
 *   --step <name>   Run a single step: audit, query, download, update
 *   --dry-run       Dry-run mode (no writes, no downloads)
 *   --apply         Apply changes (for update step)
 *
 * Steps (in order):
 *   1. audit    — Scan posts for missing/external media
 *   2. query    — Query Wayback CDX API for available archives
 *   3. download — Download archived media not yet local
 *   4. update   — Replace external URLs in posts with local paths
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = __dirname;

const args = process.argv.slice(2);
const stepIdx = args.indexOf('--step');
const step = stepIdx >= 0 ? args[stepIdx + 1] : null;
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');

const CDX_OUTPUT = join(scriptsDir, '..', 'wayback-cdx-results.json');

function run(cmd) {
	console.log(`\n${'='.repeat(72)}`);
	console.log(`> ${cmd}`);
	console.log('='.repeat(72));
	try {
		execSync(cmd, { stdio: 'inherit', cwd: join(scriptsDir, '..') });
	} catch (err) {
		console.error(`Step failed with exit code ${err.status}`);
		if (!dryRun) process.exit(err.status || 1);
	}
}

const steps = {
	audit() {
		run(`node scripts/audit-media.mjs`);
	},
	query() {
		if (dryRun) {
			run(`node scripts/wayback-cdx-query.mjs --dry-run`);
		} else {
			run(`node scripts/wayback-cdx-query.mjs --output ${CDX_OUTPUT}`);
		}
	},
	download() {
		if (dryRun) {
			run(`node scripts/wayback-download.mjs ${CDX_OUTPUT} --dry-run`);
		} else {
			run(`node scripts/wayback-download.mjs ${CDX_OUTPUT}`);
		}
	},
	update() {
		if (apply) {
			run(`node scripts/update-post-images.mjs --apply`);
		} else {
			run(`node scripts/update-post-images.mjs`);
		}
	},
};

if (step) {
	if (!steps[step]) {
		console.error(`Unknown step: ${step}`);
		console.error(`Available steps: ${Object.keys(steps).join(', ')}`);
		process.exit(1);
	}
	steps[step]();
} else {
	console.log('Running full wayback media recovery pipeline...');
	if (dryRun) console.log('(DRY RUN mode)');
	steps.audit();
	steps.query();
	if (!dryRun) steps.download();
	steps.update();
	console.log('\nPipeline complete.');
}
