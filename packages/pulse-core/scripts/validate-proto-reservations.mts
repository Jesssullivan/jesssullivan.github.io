#!/usr/bin/env tsx
// Schema-evolution guard. Walks the canonical pulse.proto file, extracts the
// active field numbers and names per message, and verifies that none of them
// collide with entries in proto/reserved.json.
//
// Usage:
//   tsx scripts/validate-proto-reservations.mts
//
// Exits non-zero on any violation. Intended to run in CI and locally before
// merging schema changes. Also fails loudly if the reserved.json file omits a
// message that the proto declares, so additions cannot silently bypass the
// ledger.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(here, '..', 'proto', 'tinyland', 'pulse', 'v1', 'pulse.proto');
const RESERVED_PATH = resolve(here, '..', 'proto', 'reserved.json');

interface MessageDef {
	name: string;
	fields: Array<{ name: string; number: number }>;
	reservedNumbers: number[];
	reservedNames: string[];
}

interface ReservedFile {
	messages: Record<string, { reserved_numbers: number[]; reserved_names: string[] }>;
}

const stripComments = (text: string): string =>
	text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '');

const parseMessages = (proto: string): MessageDef[] => {
	const cleaned = stripComments(proto);
	const messages: MessageDef[] = [];
	const messageRe = /message\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
	for (const match of cleaned.matchAll(messageRe)) {
		const [, name, body] = match;
		if (!name || body === undefined) continue;
		const fields: Array<{ name: string; number: number }> = [];
		// Match `<type> <name> = <number>;` lines, skipping `oneof` headers and
		// nested-message braces. The `oneof` blocks themselves contain field lines
		// of the same shape, which is what we want.
		const fieldRe = /(?:^|\n)\s*(?:repeated\s+)?[\w.]+\s+(\w+)\s*=\s*(\d+)\s*;/g;
		for (const fm of body.matchAll(fieldRe)) {
			const [, fname, fnum] = fm;
			if (!fname || !fnum) continue;
			fields.push({ name: fname, number: Number(fnum) });
		}
		const reservedNumbers: number[] = [];
		const reservedNames: string[] = [];
		const reservedNumRe = /reserved\s+([0-9,\s]+);/g;
		for (const rm of body.matchAll(reservedNumRe)) {
			const [, list] = rm;
			if (!list) continue;
			for (const part of list.split(',')) {
				const n = Number(part.trim());
				if (Number.isFinite(n)) reservedNumbers.push(n);
			}
		}
		const reservedNameRe = /reserved\s+((?:"[^"]+"\s*,?\s*)+);/g;
		for (const rm of body.matchAll(reservedNameRe)) {
			const [, list] = rm;
			if (!list) continue;
			for (const part of list.matchAll(/"([^"]+)"/g)) {
				if (part[1]) reservedNames.push(part[1]);
			}
		}
		messages.push({ name, fields, reservedNumbers, reservedNames });
	}
	return messages;
};

const main = async (): Promise<void> => {
	const [protoText, reservedText] = await Promise.all([
		readFile(PROTO_PATH, 'utf8'),
		readFile(RESERVED_PATH, 'utf8'),
	]);
	const reserved = JSON.parse(reservedText) as ReservedFile;
	const messages = parseMessages(protoText);

	const errors: string[] = [];

	for (const msg of messages) {
		const ledger = reserved.messages[msg.name];
		if (!ledger) {
			errors.push(`message ${msg.name} is missing from proto/reserved.json`);
			continue;
		}
		// Active fields must not appear in either proto-level `reserved` clauses
		// or in the JSON ledger.
		const ledgerNums = new Set([...msg.reservedNumbers, ...ledger.reserved_numbers]);
		const ledgerNames = new Set([...msg.reservedNames, ...ledger.reserved_names]);
		for (const f of msg.fields) {
			if (ledgerNums.has(f.number)) {
				errors.push(`${msg.name}.${f.name} (=${f.number}) reuses a reserved field number`);
			}
			if (ledgerNames.has(f.name)) {
				errors.push(`${msg.name}.${f.name} reuses a reserved field name`);
			}
		}
		// Field numbers must be unique within a message.
		const seen = new Map<number, string>();
		for (const f of msg.fields) {
			const prior = seen.get(f.number);
			if (prior !== undefined) {
				errors.push(`${msg.name}: field ${f.name} and ${prior} share number ${f.number}`);
			}
			seen.set(f.number, f.name);
		}
	}

	// Ledger entries that name a message no longer present in the proto are
	// allowed (the message itself was retired) but warned about so they are
	// reviewed deliberately.
	const knownMessages = new Set(messages.map((m) => m.name));
	for (const name of Object.keys(reserved.messages)) {
		if (!knownMessages.has(name)) {
			console.warn(`note: reserved.json carries entries for retired message ${name}`);
		}
	}

	if (errors.length > 0) {
		console.error('proto schema-evolution check failed:');
		for (const e of errors) console.error(`  - ${e}`);
		process.exit(1);
	}

	console.log(`proto schema-evolution check ok (${messages.length} messages)`);
};

await main();
