import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

interface TinylandProjectedPost {
	targetFile: string;
	slug: string;
	tinylandSourceRecord: string;
	tinylandSourceHash: string;
}

interface TinylandPostSnapshot {
	schemaVersion: string;
	snapshotId: string;
	sourceAuthority: string;
	spokeTarget: string;
	projectionKind: string;
	contentHash: string;
	consumerContract: {
		runtimeBrokerFetch: boolean;
		mutationApi: boolean;
		activityPubWorker: boolean;
	};
	activityPubStatus: string;
	posts: TinylandProjectedPost[];
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}

function readText(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

function snapshotHash(snapshot: TinylandPostSnapshot): string {
	return `sha256:${createHash('sha256')
		.update(JSON.stringify({ ...snapshot, contentHash: '' }))
		.digest('hex')}`;
}

describe('Tinyland post projection snapshot', () => {
	it('keeps transscendsurvival.org as a checked-in static consumer', () => {
		const snapshot = readJson<TinylandPostSnapshot>('static/data/tinyland/posts/public-snapshot.v1.json');

		expect(snapshot.schemaVersion).toBe('tinyland.static-spoke.snapshot.v1');
		expect(snapshot.sourceAuthority).toBe('tinyland.dev');
		expect(snapshot.spokeTarget).toBe('transscendsurvival.org');
		expect(snapshot.projectionKind).toBe('posts');
		expect(snapshot.contentHash).toBe(snapshotHash(snapshot));
		expect(snapshot.consumerContract.runtimeBrokerFetch).toBe(false);
		expect(snapshot.consumerContract.mutationApi).toBe(false);
		expect(snapshot.consumerContract.activityPubWorker).toBe(false);
		expect(snapshot.activityPubStatus).toContain('not a public federation launch');
		expect(JSON.stringify(snapshot)).not.toMatch(
			/privateKey|publicKeyPem|secret|apiKey|accessToken|privateObjectKey|s3:\/\//i,
		);
	});

	it('materializes reviewed posts into the extant frontmatter flow', () => {
		const snapshot = readJson<TinylandPostSnapshot>('static/data/tinyland/posts/public-snapshot.v1.json');

		for (const post of snapshot.posts) {
			const materialized = readText(post.targetFile);

			expect(materialized).toContain('tinyland_projection: true');
			expect(materialized).toContain(`tinyland_projection_snapshot: "${snapshot.snapshotId}"`);
			expect(materialized).toContain(
				`tinyland_projection_snapshot_hash_prefix: "${snapshot.contentHash.slice(0, 19)}"`,
			);
			expect(materialized).toContain(`tinyland_projection_source: "${post.tinylandSourceRecord}"`);
			expect(materialized).toContain(
				`tinyland_projection_source_hash_prefix: "${post.tinylandSourceHash.slice(0, 19)}"`,
			);
			expect(materialized).toContain(`slug: "${post.slug}"`);
			expect(materialized).toContain('published: true');
		}
	});
});
