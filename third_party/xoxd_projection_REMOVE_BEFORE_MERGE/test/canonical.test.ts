import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	approvalHash,
	canonicalJson,
	canonicalJsonWithNull,
	combineHashes,
	componentHashes,
	publicComponentHashes,
} from '../src/canonical.ts';
import type { ApprovalComponents, Document } from '../src/contract.ts';
import { shapePublicDocument } from '../src/shape.ts';
import { TESTDATA } from './helpers.ts';

interface Vector {
	readonly rule: string;
	readonly name: string;
	readonly input: Document;
	readonly expected: ApprovalComponents & { readonly hash: string };
	readonly sameHashAs?: string;
	readonly differsFrom?: string;
}

const VECTOR_DIR = join(TESTDATA, 'vectors', 'canonical-v0');
const vectors: Vector[] = readdirSync(VECTOR_DIR)
	.filter((file) => file.endsWith('.json'))
	.sort()
	.map((file) => JSON.parse(readFileSync(join(VECTOR_DIR, file), 'utf8')) as Vector);
const byName = new Map(vectors.map((vector) => [vector.name, vector]));

describe('canonical-v0 vectors', () => {
	it('has the fourteen hub vectors, each named after its file', () => {
		assert.equal(vectors.length, 14);
		for (const vector of vectors) assert.equal(vector.rule, 'canonical-v0');
	});

	for (const vector of vectors) {
		it(`${vector.name}: the component hashes and the final hash match byte for byte`, async () => {
			const { hash, ...components } = vector.expected;
			assert.deepEqual(await componentHashes(vector.input), components);
			assert.equal(await approvalHash(vector.input), hash);
			assert.equal(await combineHashes(components), hash);
		});
	}

	it('pairs that must agree agree, and pairs that must differ differ', () => {
		let pairs = 0;
		for (const vector of vectors) {
			if (vector.sameHashAs !== undefined) {
				assert.equal(vector.expected.hash, byName.get(vector.sameHashAs)?.expected.hash);
				pairs += 1;
			}
			if (vector.differsFrom !== undefined) {
				const other = byName.get(vector.differsFrom);
				assert.ok(other);
				assert.notEqual(vector.expected.hash, other.expected.hash);
				pairs += 1;
			}
		}
		assert.ok(pairs >= 7);
	});

	it('a public Document recomputes the hash from the published variants component', async () => {
		for (const vector of vectors) {
			const { variants: _variants, ...publicDocument } = vector.input;
			const shaped = shapePublicDocument(publicDocument);
			assert.ok(shaped.ok, vector.name);
			const components = await publicComponentHashes(publicDocument);
			const hash = await combineHashes({ ...components, variants: vector.expected.variants });
			assert.equal(hash, vector.expected.hash, vector.name);
		}
	});
});

describe('canonicalJson', () => {
	it('sorts keys by UTF-16 code units, not by locale', () => {
		assert.equal(canonicalJson({ b: 1, a: 2, B: 3, 'é': 4, z: 5 }), '{"B":3,"a":2,"b":1,"z":5,"é":4}');
	});

	it('normalizes strings and keys to NFC', () => {
		assert.equal(canonicalJson({ 'é': 'é' }), '{"é":"é"}');
	});

	it('serializes numbers as ECMAScript does', () => {
		assert.equal(canonicalJson([1, 1.5, -0, 1e21, 0.000001]), '[1,1.5,0,1e+21,0.000001]');
	});

	it('refuses null, a lone surrogate, a non-finite number and keys equal after NFC', () => {
		assert.throws(() => canonicalJson({ a: null }));
		assert.throws(() => canonicalJson('\ud800'));
		assert.throws(() => canonicalJson(Number.NaN));
		assert.throws(() => canonicalJson({ 'é': 1, 'é': 2 }));
	});

	it('keeps null in the manifest form', () => {
		assert.equal(canonicalJsonWithNull({ b: null, a: [null] }), '{"a":[null],"b":null}');
	});
});
