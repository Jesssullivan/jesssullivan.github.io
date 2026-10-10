import { describe, expect, it } from 'vitest';
import { applyHunks, parsePatch } from './apply-dependency-patches.mjs';

const pristine = ['export let ts = undefined;', '', 'try {', '\tts = 1;', '} catch {}', ''].join('\n');

// Header comment lines (as in patches/*.patch) precede the diff and must be ignored.
const addOnly = [
	'# Upstream: example',
	'diff --git a/src/ts.js b/src/ts.js',
	'--- a/src/ts.js',
	'+++ b/src/ts.js',
	'@@ -3,3 +3,5 @@ export let ts = undefined;',
	' try {',
	' \tts = 1;',
	' } catch {}',
	'+',
	'+if (!ts) ts = 2;',
	'',
].join('\n');

const replacing = [
	'--- a/src/ts.js',
	'+++ b/src/ts.js',
	'@@ -1,2 +1,2 @@',
	'-export let ts = undefined;',
	'+export let ts = null;',
	' ',
	'',
].join('\n');

describe('apply-dependency-patches', () => {
	it('parses file paths and hunk bodies after leading header comments', () => {
		const files = parsePatch(addOnly);
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('src/ts.js');
		expect(files[0].hunks[0].old).toEqual(['try {', '\tts = 1;', '} catch {}']);
		expect(files[0].hunks[0].new).toHaveLength(5);
	});

	it('applies hunks exactly and restores the original in reverse', () => {
		const [file] = parsePatch(addOnly);
		const patched = applyHunks(pristine, file.hunks);
		expect(patched).toContain('if (!ts) ts = 2;');
		expect(applyHunks(patched, file.hunks, true)).toBe(pristine);
	});

	it('detects an applied add-only patch only through the reverse check', () => {
		const [file] = parsePatch(addOnly);
		const patched = applyHunks(pristine, file.hunks);
		// The context still matches, so a forward re-apply would succeed; the
		// script therefore checks the reverse patch first.
		expect(applyHunks(pristine, file.hunks, true)).toBeNull();
		expect(applyHunks(patched, file.hunks, true)).not.toBeNull();
	});

	it('refuses hunks whose context does not match (no fuzz)', () => {
		const [file] = parsePatch(replacing);
		expect(applyHunks(pristine.replace('undefined', 'void 0'), file.hunks)).toBeNull();
		expect(applyHunks(pristine, file.hunks)).toBe(pristine.replace('undefined', 'null'));
	});

	it('rejects a hunk that is longer than its header', () => {
		expect(() => parsePatch(replacing.replace('@@ -1,2 +1,2 @@', '@@ -1,1 +1,2 @@'))).toThrow();
	});
});
