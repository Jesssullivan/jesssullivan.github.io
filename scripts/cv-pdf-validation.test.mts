import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const cvDir = join(root, 'cv');
const staticCvDir = join(root, 'static', 'cv');

const docs = [
	{
		tex: 'jess_sullivan_resume.tex',
		pdf: 'jess_sullivan_resume.pdf',
	},
	{
		tex: 'jess_sullivan_cv.tex',
		pdf: 'jess_sullivan_cv.pdf',
	},
] as const;

type PdfAnnotation = {
	uri: string;
	rect: [number, number, number, number];
};

function hasTectonic(): boolean {
	return spawnSync('tectonic', ['--version'], { stdio: 'ignore' }).status === 0;
}

function renderPdfs(outDir: string): void {
	for (const doc of docs) {
		const result = spawnSync('tectonic', ['--outdir', outDir, doc.tex], {
			cwd: cvDir,
			encoding: 'utf8',
			timeout: 120_000,
		});

		expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	}
}

function extractPdfTextStreams(pdfPath: string): string[] {
	const data = readFileSync(pdfPath);
	const text = data.toString('latin1');
	const streams: string[] = [text];

	for (const match of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
		try {
			streams.push(inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'));
		} catch {
			// Non-Flate streams are not relevant for URI annotations.
		}
	}

	return streams;
}

function extractUriAnnotations(pdfPath: string): PdfAnnotation[] {
	return extractPdfTextStreams(pdfPath).flatMap((stream) =>
		[...stream.matchAll(/\/URI\((.*?)\).*?\/Rect\[([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)\]/gs)].map((match) => ({
			uri: match[1],
			rect: [Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])],
		})),
	);
}

describe.skipIf(!hasTectonic())('CV PDF rendering', () => {
	test('tracked PDFs match freshly rendered hyperlink structure', () => {
		const outDir = mkdtempSync(join(tmpdir(), 'cv-pdf-validation-'));

		try {
			renderPdfs(outDir);

			for (const doc of docs) {
				const rendered = join(outDir, doc.pdf);
				const tracked = join(staticCvDir, doc.pdf);
				const sizeDelta = Math.abs(statSync(rendered).size - statSync(tracked).size);

				expect(sizeDelta).toBeLessThan(1024);
				expect(extractUriAnnotations(rendered)).toEqual(extractUriAnnotations(tracked));
			}
		} finally {
			rmSync(outDir, { force: true, recursive: true });
		}
	}, 240_000);

	test('resume competency links are shadow links and TOTP is not linked to tinyland-auth', () => {
		const resumeSource = readFileSync(join(cvDir, 'jess_sullivan_resume.tex'), 'utf8');
		const table = resumeSource.slice(resumeSource.indexOf('% CORE COMPETENCIES')).split('\\end{tabular}', 1)[0];

		expect(resumeSource).toContain('\\newcommand{\\shadowlink}[2]{\\href{#1}{\\textcolor{black}{#2}}}');
		expect(table).not.toContain('\\cvlink');
		expect(table).not.toContain('tinyland-auth');
		expect(table).toContain('\\shadowlink{https://github.com/tinyland-inc/bazel-registry}{Bazel}');
		expect(table).toContain('\\shadowlink{https://github.com/Jesssullivan/caldera}{Caldera}');
		expect(table).toContain('\\shadowlink{https://github.com/Jesssullivan/caldera}{SAML}');
		expect(table).toContain('\\shadowlink{https://github.com/Jesssullivan/oauth-mux}{OAuth}');
		expect(table).toContain('OAuth}, TOTP & GitLab AutoDevOps');
	});

	test('resume PDF top competency annotations omit the tinyland-auth TOTP link', () => {
		const annotations = extractUriAnnotations(join(staticCvDir, 'jess_sullivan_resume.pdf'));
		const topCompetencyUris = annotations
			.filter(({ rect: [x1, y1] }) => x1 >= 330 && x1 <= 475 && y1 >= 590 && y1 <= 635)
			.map(({ uri }) => uri);

		expect(topCompetencyUris).toEqual(
			expect.arrayContaining([
				'https://github.com/tinyland-inc/bazel-registry',
				'https://github.com/Jesssullivan/caldera',
				'https://github.com/Jesssullivan/oauth-mux',
			]),
		);
		expect(topCompetencyUris).not.toContain('https://github.com/tinyland-inc/tinyland-auth');
	});
});
