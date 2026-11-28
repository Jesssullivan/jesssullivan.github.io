#!/usr/bin/env node
/**
 * Keeps //projection on the registry release of xoxd_projection (TIN-8654).
 * The draft of this change ran on a vendored copy until the module was
 * released (TIN-8643). This check fails CI if any stand-in comes back:
 * - the vendored package third_party/xoxd_projection_REMOVE_BEFORE_MERGE,
 * - XOXD_PROJECTION in projection/module.bzl naming anything but the
 *   registry repository @xoxd_projection//,
 * - MODULE.bazel without a bazel_dep on xoxd_projection, or with an
 *   override of that module.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAND_IN = 'third_party/xoxd_projection_REMOVE_BEFORE_MERGE';
const found = [];

if (existsSync(join(root, ...STAND_IN.split('/')))) found.push(STAND_IN);

const moduleBzl = readFileSync(join(root, 'projection', 'module.bzl'), 'utf8');
const label = moduleBzl.match(/^XOXD_PROJECTION = "([^"]*)"$/m)?.[1];
if (label !== '@xoxd_projection//') {
	found.push(`XOXD_PROJECTION in projection/module.bzl is ${label === undefined ? 'missing' : `"${label}"`}`);
}

const moduleBazel = readFileSync(join(root, 'MODULE.bazel'), 'utf8')
	.split('\n')
	.filter((line) => !line.trimStart().startsWith('#'))
	.join('\n');
if (!/bazel_dep\(\s*name\s*=\s*"xoxd_projection"/.test(moduleBazel)) {
	found.push('MODULE.bazel has no bazel_dep on xoxd_projection');
}
if (/_override\([^)]*module_name\s*=\s*"xoxd_projection"/s.test(moduleBazel)) {
	found.push('MODULE.bazel overrides xoxd_projection');
}

if (found.length === 0) {
	console.log('projection: xoxd_projection comes from the registry, with no stand-in');
} else {
	console.error(`projection: take xoxd_projection from the registry only: ${found.join('; ')}.`);
	process.exitCode = 1;
}
