import { accessSync, constants, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function configureChromiumFontconfig(runtimeDir) {
	if (process.platform !== 'linux') {
		return;
	}

	if (process.env.FONTCONFIG_FILE && isReadableFile(process.env.FONTCONFIG_FILE)) {
		return;
	}

	const fontDirs = discoverFontDirs();
	if (fontDirs.length === 0) {
		return;
	}

	const configDir = join(runtimeDir, 'fontconfig');
	const cacheDir = join(configDir, 'cache');
	mkdirSync(cacheDir, { recursive: true });

	const configFile = join(configDir, 'fonts.conf');
	writeFileSync(
		configFile,
		[
			'<?xml version="1.0"?>',
			'<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
			'<fontconfig>',
			...fontDirs.map((dir) => `  <dir>${escapeXml(dir)}</dir>`),
			`  <cachedir>${escapeXml(cacheDir)}</cachedir>`,
			'</fontconfig>',
			'',
		].join('\n'),
	);

	process.env.FONTCONFIG_FILE = configFile;
	process.env.FONTCONFIG_PATH = configDir;
	process.env.FONTCONFIG_CACHE = cacheDir;
	console.log(
		`Configured Chromium fontconfig with ${fontDirs.length} font director${fontDirs.length === 1 ? 'y' : 'ies'}`,
	);
}

function discoverFontDirs() {
	const dirs = new Set();
	for (const dir of ['/usr/share/fonts', '/usr/local/share/fonts']) {
		if (isReadableDirectory(dir)) dirs.add(dir);
	}

	const nixStore = '/nix/store';
	if (isReadableDirectory(nixStore)) {
		for (const entry of readdirSync(nixStore)) {
			if (!/dejavu-fonts|liberation-fonts|noto-fonts|freefont/i.test(entry)) {
				continue;
			}

			const dir = join(nixStore, entry, 'share', 'fonts');
			if (isReadableDirectory(dir)) dirs.add(dir);
		}
	}

	return [...dirs];
}

function isReadableFile(path) {
	try {
		return existsSync(path) && statSync(path).isFile() && canAccess(path, constants.R_OK);
	} catch {
		return false;
	}
}

function isReadableDirectory(path) {
	try {
		return existsSync(path) && statSync(path).isDirectory() && canAccess(path, constants.R_OK);
	} catch {
		return false;
	}
}

function canAccess(path, mode) {
	try {
		accessSync(path, mode);
		return true;
	} catch {
		return false;
	}
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
