#!/usr/bin/env tsx
// Generates static/data/pulse/public-snapshot.v1.json from the deterministic
// pulse-core fixtures. The broker mock provides the same projection logic the
// real broker will use, so the static blog never ships hand-edited public
// data.
//
// Outputs:
//   static/data/pulse/public-snapshot.v1.json
//
// The script is deterministic: stable clock, stable id generator, stable
// fixture set. Re-running without source changes MUST produce a byte-identical
// file.

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
	createBroker,
	fixedClock,
	seededIdGenerator,
	FIXTURE_NOTES,
	FIXTURE_BIRDS,
	PublicPulseSnapshotSchema,
} from '../packages/pulse-core/src/index.js';

const OUTPUT_DIR = resolve('static', 'data', 'pulse');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'public-snapshot.v1.json');

const SNAPSHOT_GENERATED_AT = '2026-04-27T17:00:00.000Z';
const SOURCE_SNAPSHOT_ID = 'pulse-core-fixtures-2026-04-27';

const main = async (): Promise<void> => {
	const broker = createBroker({
		clock: fixedClock(SNAPSHOT_GENERATED_AT),
		idGenerator: seededIdGenerator(0),
	});

	for (const event of [...FIXTURE_NOTES, ...FIXTURE_BIRDS]) {
		const result = broker.ingest({
			actor: event.actor,
			occurredAt: event.occurredAt,
			visibility: event.visibility,
			source: event.source,
			tags: event.tags,
			media: event.media,
			payload: event.payload,
		});
		if (result.status === 'invalid') {
			throw new Error(`fixture failed schema validation: ${event.id}\n${result.errors.join('\n')}`);
		}
	}

	const { snapshot, denied } = broker.deriveSnapshot({
		sourceSnapshotId: SOURCE_SNAPSHOT_ID,
	});

	const reparsed = PublicPulseSnapshotSchema.safeParse(snapshot);
	if (!reparsed.success) {
		throw new Error(`generated snapshot fails its own schema: ${reparsed.error.message}`);
	}

	await mkdir(OUTPUT_DIR, { recursive: true });
	const json = `${JSON.stringify(snapshot, null, '\t')}\n`;
	await writeFile(OUTPUT_PATH, json, 'utf8');

	console.log(
		`wrote ${OUTPUT_PATH} (${snapshot.items.length} items, ${denied.length} denied, hash=${snapshot.manifest.contentHash})`,
	);
};

await main();
