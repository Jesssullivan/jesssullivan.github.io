#!/usr/bin/env node
/**
 * TEMPORARY (TIN-8654). Fails CI while the draft-only stand-in for the
 * xoxd_projection registry release is present on anything but a draft pull
 * request: the vendored package third_party/xoxd_projection_REMOVE_BEFORE_MERGE
 * or projection/module.bzl pointing at it. Delete this file and its CI step
 * together with the stand-in, once xoxd_projection 1.0.0 resolves from the
 * registry (TIN-8643).
 *
 * CI passes GITHUB_EVENT_NAME and PR_DRAFT (the pull request's draft flag).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAND_IN = 'third_party/xoxd_projection_REMOVE_BEFORE_MERGE';
const present = [];
if (readFileSync(join(root, 'projection', 'module.bzl'), 'utf8').includes(STAND_IN)) {
	present.push('projection/module.bzl pointing at the vendored copy');
}
if (existsSync(join(root, ...STAND_IN.split('/')))) present.push(STAND_IN);

if (present.length === 0) {
	console.log('projection: no temporary xoxd_projection override is present');
} else if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.PR_DRAFT === 'true') {
	console.log(`projection: allowed on a draft pull request only: ${present.join(' and ')}`);
} else {
	console.error(`projection: remove before merge: ${present.join(' and ')}. See "Before merge" in docs/notes-from-projection.md.`);
	process.exitCode = 1;
}
