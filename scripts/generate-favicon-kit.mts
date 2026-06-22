#!/usr/bin/env node
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const staticDir = resolve(repoRoot, 'static');
const sourcePath = resolve(staticDir, 'icons/favicon-source.jpg');
const sourceUrl = 'https://github.com/Jesssullivan.png';
const refreshSource = process.argv.includes('--refresh-source');

const themeColor = '#0f766e';
const backgroundColor = '#0f172a';
const appName = 'transscendsurvival.org';

interface IcoEntry {
	size: number;
	buffer: Buffer;
}

function writeIco(images: IcoEntry[]): Buffer {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	const entries = Buffer.alloc(16 * images.length);
	let offset = header.length + entries.length;

	for (let i = 0; i < images.length; i++) {
		const image = images[i];
		const pos = i * 16;
		const sizeByte = image.size >= 256 ? 0 : image.size;
		entries.writeUInt8(sizeByte, pos);
		entries.writeUInt8(sizeByte, pos + 1);
		entries.writeUInt8(0, pos + 2);
		entries.writeUInt8(0, pos + 3);
		entries.writeUInt16LE(1, pos + 4);
		entries.writeUInt16LE(32, pos + 6);
		entries.writeUInt32LE(image.buffer.length, pos + 8);
		entries.writeUInt32LE(offset, pos + 12);
		offset += image.buffer.length;
	}

	return Buffer.concat([header, entries, ...images.map((image) => image.buffer)]);
}

async function loadSource(): Promise<Buffer> {
	await mkdir(dirname(sourcePath), { recursive: true });

	if (!refreshSource && existsSync(sourcePath)) {
		return readFile(sourcePath);
	}

	const response = await fetch(sourceUrl, {
		headers: {
			'user-agent': 'jesssullivan.github.io favicon generator',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${sourceUrl}: ${response.status} ${response.statusText}`);
	}

	const source = Buffer.from(await response.arrayBuffer());
	await writeFile(sourcePath, source);
	return source;
}

async function squarePng(source: Buffer, size: number): Promise<Buffer> {
	return sharp(source)
		.rotate()
		.resize(size, size, { fit: 'cover', position: 'attention' })
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();
}

async function circlePng(source: Buffer, size: number): Promise<Buffer> {
	const mask = Buffer.from(
		`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#000"/></svg>`,
	);

	return sharp(await squarePng(source, size))
		.composite([{ input: mask, blend: 'dest-in' }])
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();
}

async function maskablePng(source: Buffer, size: number): Promise<Buffer> {
	const innerSize = Math.round(size * 0.72);
	const inset = Math.round((size - innerSize) / 2);
	const avatar = await circlePng(source, innerSize);

	return sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: backgroundColor,
		},
	})
		.composite([{ input: avatar, left: inset, top: inset }])
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();
}

async function tilePng(source: Buffer, width: number, height: number): Promise<Buffer> {
	const iconSize = Math.round(Math.min(width, height) * 0.72);
	const avatar = await circlePng(source, iconSize);

	return sharp({
		create: {
			width,
			height,
			channels: 4,
			background: themeColor,
		},
	})
		.composite([
			{
				input: avatar,
				left: Math.round((width - iconSize) / 2),
				top: Math.round((height - iconSize) / 2),
			},
		])
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();
}

function svgWithEmbeddedPng(dataUri: string): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
		`<title>${appName}</title>`,
		`<image href="${dataUri}" width="512" height="512" preserveAspectRatio="xMidYMid slice"/>`,
		'</svg>',
		'',
	].join('\n');
}

async function safariPinnedTabSvg(source: Buffer): Promise<string> {
	const sampleSize = 64;
	const cell = 512 / sampleSize;
	const { data, info } = await sharp(source)
		.rotate()
		.resize(sampleSize, sampleSize, { fit: 'cover', position: 'attention' })
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const rects: string[] = [];

	for (let y = 0; y < info.height; y++) {
		for (let x = 0; x < info.width; x++) {
			const luminance = data[y * info.width + x];
			if (luminance < 82) continue;
			rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
		}
	}

	if (rects.length === 0) {
		throw new Error('Unable to generate Safari pinned tab mask from source image');
	}

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
		`<title>${appName}</title>`,
		'<g fill="#000" shape-rendering="crispEdges">',
		...rects,
		'</g>',
		'</svg>',
		'',
	].join('\n');
}

async function main(): Promise<void> {
	const source = await loadSource();
	const faviconSvgPng = await squarePng(source, 512);
	const faviconSvgDataUri = `data:image/png;base64,${faviconSvgPng.toString('base64')}`;

	const outputs: Array<[string, Buffer | string]> = [
		['favicon-16x16.png', await squarePng(source, 16)],
		['favicon-32x32.png', await squarePng(source, 32)],
		['favicon-48x48.png', await squarePng(source, 48)],
		['favicon.png', await squarePng(source, 512)],
		['apple-touch-icon.png', await squarePng(source, 180)],
		['android-chrome-192x192.png', await squarePng(source, 192)],
		['android-chrome-512x512.png', await squarePng(source, 512)],
		['maskable-icon-192x192.png', await maskablePng(source, 192)],
		['maskable-icon-512x512.png', await maskablePng(source, 512)],
		['mstile-70x70.png', await tilePng(source, 70, 70)],
		['mstile-144x144.png', await tilePng(source, 144, 144)],
		['mstile-150x150.png', await tilePng(source, 150, 150)],
		['mstile-310x150.png', await tilePng(source, 310, 150)],
		['mstile-310x310.png', await tilePng(source, 310, 310)],
		['favicon.svg', svgWithEmbeddedPng(faviconSvgDataUri)],
		['safari-pinned-tab.svg', await safariPinnedTabSvg(source)],
	];

	const icoImages = await Promise.all(
		[16, 32, 48].map(async (size) => ({ size, buffer: await squarePng(source, size) })),
	);
	outputs.push(['favicon.ico', writeIco(icoImages)]);

	const manifest = {
		name: appName,
		short_name: 'TSS',
		description: 'Blog and portfolio by Jess Sullivan.',
		id: '/',
		start_url: '/',
		scope: '/',
		display: 'minimal-ui',
		background_color: backgroundColor,
		theme_color: themeColor,
		icons: [
			{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
			{ src: '/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
			{ src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		],
	};

	outputs.push(['site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`]);
	outputs.push([
		'browserconfig.xml',
		[
			'<?xml version="1.0" encoding="utf-8"?>',
			'<browserconfig>',
			'  <msapplication>',
			'    <tile>',
			'      <square70x70logo src="/mstile-70x70.png"/>',
			'      <square150x150logo src="/mstile-150x150.png"/>',
			'      <wide310x150logo src="/mstile-310x150.png"/>',
			'      <square310x310logo src="/mstile-310x310.png"/>',
			`      <TileColor>${themeColor}</TileColor>`,
			'    </tile>',
			'  </msapplication>',
			'</browserconfig>',
			'',
		].join('\n'),
	]);

	for (const [name, content] of outputs) {
		const path = resolve(staticDir, name);
		await writeFile(path, content);
		console.log(`wrote static/${name}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
