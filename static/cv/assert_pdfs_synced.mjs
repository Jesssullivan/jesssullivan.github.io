#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const roots = unique([
	process.cwd(),
	process.env.RUNFILES_DIR,
	resolve(scriptDir, '..', '..'),
	resolve(scriptDir, '..', '..', '..'),
]);

const pairs = [
	{
		name: 'generic resume',
		source: ['../spear_resumes+/generic/resume.pdf', 'spear_resumes+/generic/resume.pdf'],
		static: ['static/cv/jess_sullivan_resume.pdf'],
	},
	{
		name: 'targeted resume',
		source: ['../spear_resumes+/cra/resume.pdf', 'spear_resumes+/cra/resume.pdf'],
		static: ['static/cv/jess_sullivan_resume_targeted.pdf'],
	},
	{
		name: 'full CV',
		source: ['../spear_resumes+/generic/cv.pdf', 'spear_resumes+/generic/cv.pdf'],
		static: ['static/cv/jess_sullivan_cv.pdf'],
	},
];

let failures = 0;

for (const pair of pairs) {
	const sourcePath = resolveExisting(pair.source);
	const staticPath = resolveExisting(pair.static);
	const source = readPdf(sourcePath, `${pair.name} source`);
	const current = readPdf(staticPath, `${pair.name} static file`);

	if (source.equals(current)) {
		console.log(`${pair.name}: synced (${digest(source)}, ${source.length} bytes)`);
		continue;
	}

	failures += 1;
	console.error(
		`${pair.name}: stale static PDF; source=${digest(source)} (${source.length} bytes), static=${digest(current)} (${current.length} bytes)`,
	);
}

if (failures > 0) {
	throw new Error(`${failures} CV PDF artifact(s) are stale; run bazel run //static/cv:sync_pdfs`);
}

function resolveExisting(candidates) {
	for (const root of roots) {
		for (const candidate of candidates) {
			const path = resolve(root, candidate);
			if (existsSync(path)) {
				return path;
			}
		}
	}

	throw new Error(`Unable to resolve runfile from candidates: ${candidates.join(', ')}`);
}

function readPdf(path, label) {
	const data = readFileSync(path);
	if (!data.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
		throw new Error(`${label} is not a PDF: ${path}`);
	}
	return data;
}

function digest(data) {
	return createHash('sha256').update(data).digest('hex');
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}
