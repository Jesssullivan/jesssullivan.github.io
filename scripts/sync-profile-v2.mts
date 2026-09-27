/** Copy an explicitly supplied, law-filtered producer release; never fetch or fabricate. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { dirname, join, resolve } from 'node:path';
import { parseProfileV1 } from '../src/lib/profile/schema';

const source = process.argv[2];
if (!source)
	throw new Error(
		'Usage: npx tsx scripts/sync-profile-v2.mts /path/to/reviewed/profile.v1.json [--timeline] [--legacy /path/to/profile/out/facts.json]',
	);
const raw = await readFile(resolve(source), 'utf8');
const profile = parseProfileV1(JSON.parse(raw));
const output = JSON.stringify(profile, null, 2) + '\n';
const files = new Map<string, string | Uint8Array>([['profile.v1.json', output]]);
let legacyFactsHash: string | undefined;
const legacyFlag = process.argv.indexOf('--legacy');
if (legacyFlag !== -1) {
	const legacySource = process.argv[legacyFlag + 1];
	if (!legacySource || legacySource.startsWith('--')) throw new Error('--legacy requires a generated facts.json path');
	const legacyPath = resolve(legacySource);
	const legacyBytes = await readFile(legacyPath);
	const legacy = JSON.parse(legacyBytes.toString('utf8'));
	if (legacy.schema !== 1 || !Array.isArray(legacy.svgs) || !Array.isArray(legacy.images))
		throw new Error('Expected generated legacy profile facts with an artifact manifest');
	for (const field of ['identity', 'roles', 'ventures', 'community', 'publications', 'links', 'images'] as const)
		if (profile[field] !== undefined)
			deepStrictEqual(legacy[field], profile[field], `Legacy and v2 claim sources disagree: ${field}`);
	const artifacts = new Set<string>([
		...legacy.svgs,
		...legacy.images.flatMap((image: { src: string; src_dark?: string }) =>
			[image.src, image.src_dark].filter(Boolean),
		),
	]);
	for (const relative of artifacts) {
		if (typeof relative !== 'string' || !/^(?:svg|img)\/[A-Za-z0-9_.-]+\.(?:svg|png|jpe?g|webp)$/.test(relative))
			throw new Error('Unsafe generated legacy artifact path');
		files.set(relative, await readFile(join(dirname(legacyPath), relative)));
	}
	files.set('facts.json', legacyBytes);
	legacyFactsHash = createHash('sha256').update(legacyBytes).digest('hex');
}
files.set(
	'profile.v1.provenance.json',
	JSON.stringify(
		{
			schema: 'profile-fallback-receipt.v1',
			source_commit: profile.source_commit,
			fetched_at: profile.fetched_at,
			corpus_sha256: profile.corpus_sha256,
			content_sha256: createHash('sha256').update(output).digest('hex'),
			...(legacyFactsHash ? { legacy_facts_sha256: legacyFactsHash } : {}),
		},
		null,
		2,
	) + '\n',
);

// Optional reviewed presentation bundle, adjacent to the producer projection.
// These fixed filenames remain separate from legacy facts/SVG outputs.
if (process.argv.includes('--timeline')) {
	for (const suffix of ['light', 'dark', 'compact-light', 'compact-dark']) {
		const file = `timeline-${suffix}.svg`;
		files.set(join('v2/svg', file), await readFile(join(dirname(resolve(source)), 'svg', file)));
	}
}

// All sources, claim equality and manifest paths are checked before any copy.
for (const [relative, bytes] of files) {
	const destination = join('static/profile', relative);
	await mkdir(dirname(destination), { recursive: true });
	await writeFile(destination, bytes);
}
console.log(`Validated and synced ${files.size} reviewed profile artifacts. No network or publication.`);
