import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { sha256OfBytes } from '../src/bytes.ts';
import {
	EXTENSION_MEDIA_TYPES,
	KIND_MEDIA_TYPES,
	manifestPath,
	MEDIA_TYPES,
	PATH_PATTERN,
	SEGMENT_PATTERN,
	TARGETS,
} from '../src/contract.ts';
import type { Manifest } from '../src/contract.ts';
import { fixtureBytes, TESTDATA } from './helpers.ts';

function listFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
		item.isDirectory() ? listFiles(join(dir, item.name)) : [join(dir, item.name)],
	);
}

const sums = readFileSync(join(TESTDATA, 'SHA256SUMS'), 'utf8')
	.trimEnd()
	.split('\n')
	.map((line) => {
		const match = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line);
		if (match === null) throw new Error(`bad SHA256SUMS line: ${line}`);
		return { sha256: match[1], path: match[2] };
	});

describe('vendored contract files', () => {
	it('names the contract version and the hub commit it was copied from', () => {
		const provenance = readFileSync(join(TESTDATA, 'PROVENANCE'), 'utf8');
		assert.match(provenance, /xoxd-projection\/v2/);
		assert.match(provenance, /\bd91134c54\b/);
	});

	it('lists every vendored file once, and nothing else', () => {
		const vendored = ['projection-v2', 'vectors']
			.flatMap((dir) => listFiles(join(TESTDATA, dir)))
			.map((file) => relative(TESTDATA, file).split('\\').join('/'))
			.sort();
		assert.deepEqual(
			sums.map((row) => row.path),
			vendored,
		);
	});

	it('still hashes to the recorded sha256, byte for byte', async () => {
		for (const row of sums) {
			const actual = await sha256OfBytes(readFileSync(join(TESTDATA, row.path)));
			assert.equal(actual, row.sha256, `${row.path} drifted from the vendored contract`);
		}
	});
});

describe('the module tables equal the contract schema', () => {
	const schema = JSON.parse(
		readFileSync(join(TESTDATA, 'projection-v2', 'schema', 'manifest.schema.json'), 'utf8'),
	) as {
		$defs: {
			segment: { pattern: string };
			sitePath: { pattern: string };
			mediaType: { enum: string[]; 'x-extensions': Record<string, string>; 'x-kinds': Record<string, string[]> };
		};
	};

	it('has the same media type allowlist, extension table and kind table', () => {
		const media = schema.$defs.mediaType;
		assert.deepEqual([...MEDIA_TYPES], media.enum);
		assert.deepEqual(Object.fromEntries(EXTENSION_MEDIA_TYPES), media['x-extensions']);
		assert.deepEqual(
			Object.fromEntries([...KIND_MEDIA_TYPES].map(([kind, types]) => [kind, [...types]])),
			media['x-kinds'],
		);
	});

	it('has the same segment and path patterns', () => {
		assert.equal(SEGMENT_PATTERN.source, schema.$defs.segment.pattern);
		assert.equal(PATH_PATTERN.source.replaceAll('\\/', '/'), schema.$defs.sitePath.pattern.replaceAll('\\/', '/'));
	});

	it('has the target rows the signed fixture manifests carry', () => {
		const heads = { blog: 'fbce3ad37f64d9aee7cecc90a2dda1d6bba77f726bb73541b031cf08997e2ee3', firm: '7e605f3e948516b6873cd0794ccb83f8a3d5a2632fbcaa33fc505edd80bab259' } as const;
		for (const [site, sha256] of Object.entries(heads) as Array<['blog' | 'firm', string]>) {
			const bytes = fixtureBytes(manifestPath(site, sha256));
			assert.ok(bytes);
			const manifest = JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
			const row = TARGETS[site];
			assert.deepEqual(manifest.target, { actor: row.actor, id: row.id, origin: row.origin });
		}
	});
});
