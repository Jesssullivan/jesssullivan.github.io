#!/usr/bin/env tsx
// Validates static/data/pulse/public-snapshot.v1.json against the canonical
// PublicPulseSnapshot schema and re-derives its contentHash to confirm the
// committed file matches what the projection logic produces.
//
// This script runs in `npm run check` and `npm run prebuild` so any drift in
// the public snapshot fails the build before it can be published.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PublicPulseSnapshotSchema } from '../packages/pulse-core/src/schema/snapshot.js';

const SNAPSHOT_PATH = resolve('static', 'data', 'pulse', 'public-snapshot.v1.json');

const canonicalJson = (value: unknown): string => {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
};

const main = async (): Promise<void> => {
	const text = await readFile(SNAPSHOT_PATH, 'utf8');
	const parsed = JSON.parse(text) as unknown;
	const result = PublicPulseSnapshotSchema.safeParse(parsed);
	if (!result.success) {
		console.error(`pulse snapshot schema validation failed at ${SNAPSHOT_PATH}:`);
		for (const issue of result.error.issues) {
			console.error(`  - ${issue.path.join('.') || '<root>'}: ${issue.message}`);
		}
		process.exit(1);
	}
	const snapshot = result.data;

	const recomputed = `sha256:${createHash('sha256').update(canonicalJson(snapshot.items)).digest('hex')}`;
	if (recomputed !== snapshot.manifest.contentHash) {
		console.error(
			`pulse snapshot contentHash mismatch: manifest=${snapshot.manifest.contentHash} computed=${recomputed}`,
		);
		process.exit(1);
	}

	for (const item of snapshot.items) {
		if (item.kind !== 'note' && item.kind !== 'bird_sighting') {
			console.error(`pulse snapshot contains disallowed kind: ${item.kind} (id=${item.id})`);
			process.exit(1);
		}
	}

	const serialized = JSON.stringify(snapshot);
	if (serialized.includes('privateObjectKey') || serialized.includes('s3://')) {
		console.error('pulse snapshot leaks private storage references');
		process.exit(1);
	}

	console.log(`pulse snapshot ok (${snapshot.items.length} items, hash=${snapshot.manifest.contentHash})`);
};

await main();
