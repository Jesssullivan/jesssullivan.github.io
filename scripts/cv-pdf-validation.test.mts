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

function sectionBetween(source: string, start: string, end: string): string {
	const startIndex = source.indexOf(start);
	expect(startIndex).toBeGreaterThanOrEqual(0);
	const endIndex = source.indexOf(end, startIndex);
	expect(endIndex).toBeGreaterThan(startIndex);
	return source.slice(startIndex, endIndex);
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

	test('resume competency entries stay broad and package-neutral', () => {
		const resumeSource = readFileSync(join(cvDir, 'jess_sullivan_resume.tex'), 'utf8');
		const table = resumeSource.slice(resumeSource.indexOf('% CORE COMPETENCIES')).split('\\end{tabular}', 1)[0];

		expect(table).not.toContain('\\cvlink');
		expect(table).not.toContain('\\shadowlink');
		expect(table).not.toContain('tinyland-auth');
		expect(table).not.toContain('Mitre');
		expect(table).not.toContain('Caldera');
		expect(table).not.toContain('TOTP');
		expect(table).toContain('Nix, Bazel');
		expect(table).toContain('Enterprise MFA systems \\& standards');
		expect(table).toContain('OpenTelemetry');
		expect(table).not.toContain('SAML, OAuth, identity interoperability');
	});

	test('current stack sections use uniform prose without package callouts', () => {
		const resumeSource = readFileSync(join(cvDir, 'jess_sullivan_resume.tex'), 'utf8');
		const cvSource = readFileSync(join(cvDir, 'jess_sullivan_cv.tex'), 'utf8');
		const resumeStack = sectionBetween(resumeSource, 'Current stack \\& technologies:', 'Research:');
		const cvStack = sectionBetween(cvSource, 'My current stack \\& technologies:', 'Research:');

		for (const stack of [resumeStack, cvStack]) {
			expect(stack).toContain('SvelteKit Runes');
			expect(stack).toContain('Tailwind CSS');
			expect(stack).toContain('Skeleton UI');
			expect(stack).toContain('Effect TS');
			expect(stack).toContain('Tempo/Grafana');
			expect(stack).not.toContain('ABI/FFI work');
			expect(stack).not.toContain('performance-oriented systems');
			expect(stack).not.toContain('\\tech');
			expect(stack).not.toContain('\\cvlink');
			expect(stack).not.toContain('tinyland-auth');
			expect(stack).not.toContain('scheduling-kit');
			expect(stack).not.toContain('scheduling-bridge');
			expect(stack).not.toContain('jesssullivan.github.io');
			expect(stack.toLowerCase()).not.toContain('telemetry');
			expect(stack).not.toContain('OpenTelemetry');
		}

		expect(resumeStack).not.toContain('Systems \\& research');
		expect(resumeStack).not.toContain('Futhark');
		expect(resumeStack).not.toContain('Caldera');
		expect(resumeStack).not.toContain('Wireshark');
		expect(cvStack).toContain('Futhark');
		expect(cvStack).toContain('Caldera');
		expect(cvStack).toContain('Wireshark');
		expect(cvSource).toContain('\\cvlink{https://github.com/Jesssullivan/scheduling-bridge/pull/135}{\\tech{scheduling-bridge}}');
		expect(cvSource).toContain('\\cvlink{https://github.com/tinyland-inc/tinyland-auth}{\\tech{tinyland-auth}}');
		expect(resumeSource).toContain('\\cvlink{https://github.com/Jesssullivan/zig-crypto}{\\tech{zig-crypto}}');
		expect(cvSource).toContain('\\cvlink{https://github.com/Jesssullivan/zig-ctap2}{\\tech{zig-ctap2}}');
		expect(resumeSource).toContain('\\textbf{Functional \\& Heterogeneous Compute:}');
		expect(cvSource).toContain('\\textbf{Functional \\& Heterogeneous Compute:}');
		expect(resumeSource).toContain('ESDT monads, fine-grained classification systems');
		expect(cvSource).toContain('ESDT monads, fine-grained classification systems');
		expect(resumeSource.toLowerCase()).not.toContain('pixelwise');
		expect(cvSource.toLowerCase()).not.toContain('pixelwise');
		expect(resumeSource).not.toContain('\\textbf{Heterogeneous Compute:}');
		expect(cvSource).not.toContain('\\textbf{Functional Programming:}');
	});

	test('resume experience starts with reverse-chronological employment and ends with FOSS', () => {
		const resumeSource = readFileSync(join(cvDir, 'jess_sullivan_resume.tex'), 'utf8');
		const experience = sectionBetween(resumeSource, '\\section{Experience}', '% VOLUNTEER & COMMUNITY');
		const bates = experience.indexOf('Systems Analyst (DevSecOps) @ Bates College');
		const fabLab = experience.indexOf('Fabrication Laboratory Manager @ Cornell CALS');
		const macaulay = experience.indexOf('Computer Vision Software Engineer @ Macaulay Library');
		const foss = experience.indexOf('Full Stack Contracting and FOSS');

		expect(bates).toBeGreaterThanOrEqual(0);
		expect(fabLab).toBeGreaterThan(bates);
		expect(macaulay).toBeGreaterThan(fabLab);
		expect(foss).toBeGreaterThan(macaulay);
	});

	test('resume PDF annotations omit removed header package links', () => {
		const uris = extractUriAnnotations(join(staticCvDir, 'jess_sullivan_resume.pdf')).map(({ uri }) => uri);

		expect(uris).not.toContain('https://github.com/tinyland-inc/bazel-registry');
		expect(uris).not.toContain('https://github.com/Jesssullivan/oauth-mux');
		expect(uris).not.toContain('https://github.com/tinyland-inc/tinyland-auth');
	});
});
