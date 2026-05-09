#!/usr/bin/env tsx
// Materializes reviewed tinyland.dev post projections into the existing
// src/posts/*.md frontmatter flow. The static site remains a read-only
// consumer: this script only reads a checked-in snapshot.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const SNAPSHOT_PATH = resolve('static', 'data', 'tinyland', 'posts', 'public-snapshot.v1.json');
const POSTS_ROOT = resolve('src', 'posts');
const FORBIDDEN_PATTERN = /privateKey|publicKeyPem|secret|apiKey|accessToken|privateObjectKey|s3:\/\//i;

interface TinylandPostProjection {
	slug: string;
	targetFile: string;
	title: string;
	date: string;
	description: string;
	tags: string[];
	published: boolean;
	visibility: string;
	authorSlug: string;
	category?: string;
	featureImage?: string;
	sourceRepo?: string;
	sourcePath?: string;
	originalUrl?: string;
	tinylandSourceRecord: string;
	tinylandSourceHash: string;
	reviewStatus: string;
	contentMarkdown: string;
}

interface TinylandPostSnapshot {
	schemaVersion: 'tinyland.static-spoke.snapshot.v1';
	snapshotId: string;
	generatedAt: string;
	sourceAuthority: string;
	contentHash: string;
	itemCount: number;
	policyVersion: string;
	projectionKind: string;
	spokeTarget: string;
	brandRef: string;
	publicSnapshotUrl: string;
	activityPubStatus: string;
	consumerContract?: {
		publicBaseUrl?: string;
		staticSnapshotCopy?: string;
		runtimeBrokerFetch?: boolean;
		mutationApi?: boolean;
		activityPubWorker?: boolean;
	};
	posts: TinylandPostProjection[];
}

interface CliOptions {
	check: boolean;
	adoptReviewed: boolean;
}

function parseOptions(): CliOptions {
	const args = new Set(process.argv.slice(2));
	return {
		check: args.has('--check'),
		adoptReviewed: args.has('--adopt-reviewed'),
	};
}

function sha256(text: string): string {
	return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function snapshotHash(snapshot: TinylandPostSnapshot): string {
	return sha256(JSON.stringify({ ...snapshot, contentHash: '' }));
}

function readSnapshot(): TinylandPostSnapshot {
	const raw = readFileSync(SNAPSHOT_PATH, 'utf8');
	const snapshot = JSON.parse(raw) as TinylandPostSnapshot;
	const findings: string[] = [];

	if (snapshot.schemaVersion !== 'tinyland.static-spoke.snapshot.v1') {
		findings.push('schemaVersion must be tinyland.static-spoke.snapshot.v1');
	}
	if (snapshot.sourceAuthority !== 'tinyland.dev') {
		findings.push('sourceAuthority must be tinyland.dev');
	}
	if (snapshot.projectionKind !== 'posts') {
		findings.push('projectionKind must be posts');
	}
	if (snapshot.spokeTarget !== 'transscendsurvival.org') {
		findings.push('spokeTarget must be transscendsurvival.org');
	}
	if (snapshot.brandRef !== 'jesssullivan-github-io') {
		findings.push('brandRef must be jesssullivan-github-io');
	}
	if (snapshot.contentHash !== snapshotHash(snapshot)) {
		findings.push('contentHash does not match canonical snapshot hash');
	}
	if (!Array.isArray(snapshot.posts) || snapshot.posts.length !== snapshot.itemCount) {
		findings.push('posts length must match itemCount');
	}
	if (snapshot.consumerContract?.runtimeBrokerFetch !== false) {
		findings.push('consumerContract.runtimeBrokerFetch must be false');
	}
	if (snapshot.consumerContract?.mutationApi !== false) {
		findings.push('consumerContract.mutationApi must be false');
	}
	if (snapshot.consumerContract?.activityPubWorker !== false) {
		findings.push('consumerContract.activityPubWorker must be false');
	}
	if (FORBIDDEN_PATTERN.test(raw)) {
		findings.push('snapshot contains private or secret-shaped material');
	}

	for (const post of snapshot.posts ?? []) {
		if (!post.targetFile.startsWith('src/posts/') || !post.targetFile.endsWith('.md')) {
			findings.push(`${post.slug}: targetFile must stay under src/posts/*.md`);
		}
		if (post.published !== true || post.visibility !== 'public') {
			findings.push(`${post.slug}: only public published posts may be ingested`);
		}
		if (post.reviewStatus !== 'operator-reviewed-source-public') {
			findings.push(`${post.slug}: reviewStatus must be operator-reviewed-source-public`);
		}
		if (!post.tinylandSourceHash.startsWith('sha256:')) {
			findings.push(`${post.slug}: tinylandSourceHash must be sha256-prefixed`);
		}
	}

	if (findings.length > 0) {
		throw new Error(`tinyland post snapshot validation failed:\n${findings.map((f) => `- ${f}`).join('\n')}`);
	}

	return snapshot;
}

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function yamlArray(values: string[]): string {
	return `[${values.map((value) => yamlString(value)).join(', ')}]`;
}

function optionalLine(key: string, value: string | undefined): string[] {
	return value ? [`${key}: ${yamlString(value)}`] : [];
}

function hashPrefix(hash: string): string {
	const [algorithm, digest] = hash.split(':', 2);
	return digest ? `${algorithm}:${digest.slice(0, 12)}` : hash.slice(0, 12);
}

function canonicalBlogUrl(post: TinylandPostProjection, snapshot: TinylandPostSnapshot): string {
	const baseUrl = snapshot.consumerContract?.publicBaseUrl ?? 'https://transscendsurvival.org';
	return `${baseUrl.replace(/\/$/, '')}/blog/${post.slug}`;
}

function legacyOriginalUrl(post: TinylandPostProjection, snapshot: TinylandPostSnapshot): string | undefined {
	if (!post.originalUrl) return undefined;

	const normalize = (value: string) => value.replace(/\/$/, '');
	return normalize(post.originalUrl) === normalize(canonicalBlogUrl(post, snapshot)) ? undefined : post.originalUrl;
}

function renderPost(post: TinylandPostProjection, snapshot: TinylandPostSnapshot): string {
	const lines = [
		'---',
		`title: ${yamlString(post.title)}`,
		`date: ${yamlString(post.date)}`,
		`description: ${yamlString(post.description)}`,
		`tags: ${yamlArray(post.tags)}`,
		...optionalLine('category', post.category),
		'published: true',
		`slug: ${yamlString(post.slug)}`,
		`author_slug: ${yamlString(post.authorSlug)}`,
		...optionalLine('original_url', legacyOriginalUrl(post, snapshot)),
		...optionalLine('feature_image', post.featureImage),
		...optionalLine('source_repo', post.sourceRepo),
		...optionalLine('source_path', post.sourcePath),
		'tinyland_projection: true',
		`tinyland_projection_snapshot: ${yamlString(snapshot.snapshotId)}`,
		`tinyland_projection_snapshot_hash_prefix: ${yamlString(hashPrefix(snapshot.contentHash))}`,
		`tinyland_projection_source: ${yamlString(post.tinylandSourceRecord)}`,
		`tinyland_projection_source_hash_prefix: ${yamlString(hashPrefix(post.tinylandSourceHash))}`,
		'---',
	];

	const body = post.contentMarkdown.startsWith('\n') ? post.contentMarkdown : `\n${post.contentMarkdown}`;
	return `${lines.join('\n')}${body.endsWith('\n') ? body : `${body}\n`}`;
}

function targetPathFor(post: TinylandPostProjection): string {
	const targetPath = resolve(post.targetFile);
	const relativeTarget = relative(POSTS_ROOT, targetPath);
	if (relativeTarget.startsWith('..') || relativeTarget === '' || targetPath === POSTS_ROOT) {
		throw new Error(`${post.slug}: target path escapes src/posts`);
	}
	return targetPath;
}

function hasProjectionMarker(content: string): boolean {
	return /^tinyland_projection:\s*true$/m.test(content);
}

function run(): void {
	const options = parseOptions();
	const snapshot = readSnapshot();
	const changed: string[] = [];
	const blocked: string[] = [];

	for (const post of snapshot.posts) {
		const targetPath = targetPathFor(post);
		const expected = renderPost(post, snapshot);
		const exists = existsSync(targetPath);
		const current = exists ? readFileSync(targetPath, 'utf8') : '';

		if (current === expected) continue;

		if (options.check) {
			changed.push(post.targetFile);
			continue;
		}

		if (exists && !hasProjectionMarker(current) && !options.adoptReviewed) {
			blocked.push(`${post.targetFile} exists without tinyland_projection: true`);
			continue;
		}

		mkdirSync(dirname(targetPath), { recursive: true });
		writeFileSync(targetPath, expected, 'utf8');
		changed.push(post.targetFile);
	}

	if (blocked.length > 0) {
		throw new Error(
			`refusing to clobber human-owned posts; rerun with --adopt-reviewed for this reviewed tranche:\n${blocked
				.map((item) => `- ${item}`)
				.join('\n')}`,
		);
	}

	if (options.check && changed.length > 0) {
		throw new Error(
			`tinyland projected posts are stale; run npm run ingest:tinyland-posts:\n${changed
				.map((item) => `- ${item}`)
				.join('\n')}`,
		);
	}

	const action = options.check ? 'checked' : 'materialized';
	console.log(`${action} ${snapshot.posts.length} tinyland projected posts (${changed.length} changed)`);
}

try {
	run();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
