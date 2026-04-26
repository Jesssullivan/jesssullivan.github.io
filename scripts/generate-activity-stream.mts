#!/usr/bin/env node
/**
 * Generate activity stream JSON from AP outbox source.
 * Source: mock file (scripts/data/mock-outbox.json) or remote AP outbox URL.
 * Output: static/data/activity-outbox.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUTBOX_SOURCE = process.env.AP_OUTBOX_URL || 'scripts/data/mock-outbox.json';
const OUTPUT = 'static/data/activity-outbox.json';
const MAX_ITEMS = 100;

interface OutboxCollection {
	'@context': unknown;
	id: string;
	type: string;
	totalItems: number;
	orderedItems: Record<string, unknown>[];
}

async function fetchOutbox(source: string): Promise<OutboxCollection> {
	if (source.startsWith('http')) {
		const res = await fetch(source, {
			headers: { Accept: 'application/activity+json' },
		});
		if (!res.ok) throw new Error(`Failed to fetch outbox: ${res.status}`);
		return res.json() as Promise<OutboxCollection>;
	}
	const raw = await readFile(source, 'utf-8');
	return JSON.parse(raw) as OutboxCollection;
}

async function main(): Promise<void> {
	const outbox = await fetchOutbox(OUTBOX_SOURCE);

	if (outbox.type !== 'OrderedCollection') {
		throw new Error(`Expected OrderedCollection, got ${outbox.type}`);
	}

	const items = outbox.orderedItems.slice(0, MAX_ITEMS);

	const output = {
		'@context': outbox['@context'],
		id: outbox.id,
		type: 'OrderedCollection',
		totalItems: items.length,
		orderedItems: items,
	};

	await mkdir('static/data', { recursive: true });
	await writeFile(OUTPUT, JSON.stringify(output, null, 2));
	console.log(`Activity stream: ${items.length} activities -> ${OUTPUT}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
