#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { existsSync } from 'node:fs';
import type { ImageDimensions } from './lib/types.mts';

const IMAGES_DIR = 'static/images/posts';
const DIMENSIONS_OUTPUT = 'static/images/posts/dimensions.json';
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;
const AVIF_QUALITY = 60;
const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
	const files = await readdir(IMAGES_DIR);
	const imageFiles = files.filter((f) => /\.(jpe?g|png)$/i.test(f));
	const dimensions: Record<string, ImageDimensions> = {};
	let webpCount = 0;
	let avifCount = 0;
	let resizeCount = 0;
	let skipCount = 0;
	let staleCount = 0;

	for (const file of imageFiles) {
		const filepath = join(IMAGES_DIR, file);
		const ext = extname(file).toLowerCase();
		const base = basename(file, ext);
		const webpPath = join(IMAGES_DIR, `${base}.webp`);
		const avifPath = join(IMAGES_DIR, `${base}.avif`);

		let metadata: sharp.Metadata;
		try {
			metadata = await sharp(filepath).metadata();
		} catch (err) {
			console.warn(`  skip (unreadable): ${file} — ${(err as Error).message}`);
			skipCount++;
			continue;
		}

		const width = metadata.width ?? 0;
		const height = metadata.height ?? 0;
		dimensions[`/images/posts/${file}`] = { width, height };

		// Check if existing WebP is stale (dimensions don't match source)
		if (existsSync(webpPath)) {
			try {
				const webpMeta = await sharp(webpPath).metadata();
				const webpWidth = webpMeta.width ?? 0;
				const webpHeight = webpMeta.height ?? 0;
				if (webpWidth !== width || webpHeight !== height) {
					if (dryRun) {
						console.log(`  would regenerate (stale): ${base}.webp (${webpWidth}x${webpHeight} != ${width}x${height})`);
					} else {
						console.log(`  removing stale: ${base}.webp (${webpWidth}x${webpHeight} != ${width}x${height})`);
						try { await unlink(webpPath); } catch { /* already gone */ }
					}
					staleCount++;
				}
			} catch {
				// If we can't read the WebP, remove and regenerate
				if (!dryRun) { try { await unlink(webpPath); } catch { /* already gone */ } }
				staleCount++;
			}
		}

		// Check if existing AVIF is stale (dimensions don't match source)
		if (existsSync(avifPath)) {
			try {
				const avifMeta = await sharp(avifPath).metadata();
				const avifWidth = avifMeta.width ?? 0;
				const avifHeight = avifMeta.height ?? 0;
				if (avifWidth !== width || avifHeight !== height) {
					if (dryRun) {
						console.log(`  would regenerate (stale): ${base}.avif (${avifWidth}x${avifHeight} != ${width}x${height})`);
					} else {
						console.log(`  removing stale: ${base}.avif (${avifWidth}x${avifHeight} != ${width}x${height})`);
						await unlink(avifPath);
					}
					staleCount++;
				}
			} catch {
				if (!dryRun) { try { await unlink(avifPath); } catch { /* already gone */ } }
				staleCount++;
			}
		}

		// Generate WebP if missing
		if (!existsSync(webpPath)) {
			if (dryRun) {
				console.log(`  would create: ${base}.webp`);
			} else {
				try {
					let pipeline = sharp(filepath);
					if (width > MAX_WIDTH) pipeline = pipeline.resize(MAX_WIDTH);
					await pipeline.webp({ quality: WEBP_QUALITY }).toFile(webpPath);
					// Delete if Sharp produced a 0-byte file (truncated source)
					const webpStat = await stat(webpPath);
					if (webpStat.size === 0) {
						await unlink(webpPath);
						console.warn(`  skip WebP (0-byte output): ${file}`);
						skipCount++;
						continue;
					}
				} catch (err) {
					console.warn(`  skip WebP (error): ${file} — ${(err as Error).message}`);
					try { await unlink(webpPath); } catch { /* ok */ }
					skipCount++;
					continue;
				}
			}
			webpCount++;
		}

		// Generate AVIF if missing
		if (!existsSync(avifPath)) {
			if (dryRun) {
				console.log(`  would create: ${base}.avif`);
			} else {
				try {
					let pipeline = sharp(filepath);
					if (width > MAX_WIDTH) pipeline = pipeline.resize(MAX_WIDTH);
					await pipeline.avif({ quality: AVIF_QUALITY }).toFile(avifPath);
					const avifStat = await stat(avifPath);
					if (avifStat.size === 0) {
						await unlink(avifPath);
						console.warn(`  skip AVIF (0-byte output): ${file}`);
						skipCount++;
						continue;
					}
				} catch (err) {
					console.warn(`  skip AVIF (error): ${file} — ${(err as Error).message}`);
					try { await unlink(avifPath); } catch { /* ok */ }
					skipCount++;
					continue;
				}
			}
			avifCount++;
		}

		// Record WebP dimensions
		if (existsSync(webpPath)) {
			try {
				const webpMeta = await sharp(webpPath).metadata();
				dimensions[`/images/posts/${base}.webp`] = {
					width: webpMeta.width ?? width,
					height: webpMeta.height ?? height
				};
			} catch {
				/* skip unreadable webp */
			}
		}

		// Record AVIF dimensions
		if (existsSync(avifPath)) {
			try {
				const avifMeta = await sharp(avifPath).metadata();
				dimensions[`/images/posts/${base}.avif`] = {
					width: avifMeta.width ?? width,
					height: avifMeta.height ?? height
				};
			} catch {
				/* skip unreadable avif */
			}
		}

		// Resize originals wider than MAX_WIDTH
		if (width > MAX_WIDTH) {
			if (dryRun) {
				console.log(`  would resize: ${file} (${width}px -> ${MAX_WIDTH}px)`);
				resizeCount++;
			} else {
				try {
					const tmpPath = filepath + '.tmp';
					await sharp(filepath).resize(MAX_WIDTH).toFile(tmpPath);
					await rename(tmpPath, filepath);
					const newMeta = await sharp(filepath).metadata();
					dimensions[`/images/posts/${file}`] = {
						width: newMeta.width ?? MAX_WIDTH,
						height: newMeta.height ?? height
					};
					resizeCount++;
				} catch (err) {
					console.warn(`  skip resize (error): ${file} — ${(err as Error).message}`);
					// Clean up partial .tmp file
					try { await unlink(filepath + '.tmp'); } catch { /* ok */ }
					skipCount++;
				}
			}
		}
	}

	// Also record dimensions for existing WebP-only, AVIF-only, and other format files
	for (const file of files) {
		const key = `/images/posts/${file}`;
		if (dimensions[key]) continue;
		if (!/\.(webp|avif|gif|svg)$/i.test(file)) continue;
		// Skip animated GIFs — sharp cannot reliably read multi-frame metadata
		if (/\.gif$/i.test(file)) {
			const filepath = join(IMAGES_DIR, file);
			try {
				const meta = await sharp(filepath).metadata();
				// Animated GIFs report pages > 1 in sharp
				if (meta.pages && meta.pages > 1) {
					console.log(`  skip (animated GIF): ${file}`);
					continue;
				}
				dimensions[key] = { width: meta.width ?? 0, height: meta.height ?? 0 };
			} catch {
				console.log(`  skip (unreadable GIF): ${file}`);
			}
			continue;
		}
		const filepath = join(IMAGES_DIR, file);
		try {
			const meta = await sharp(filepath).metadata();
			dimensions[key] = { width: meta.width ?? 0, height: meta.height ?? 0 };
		} catch {
			/* skip unreadable */
		}
	}

	if (!dryRun) {
		await writeFile(DIMENSIONS_OUTPUT, JSON.stringify(dimensions, null, 2));
	}

	console.log(
		`${dryRun ? '[dry-run] ' : ''}Optimized: ${webpCount} WebP, ${avifCount} AVIF generated, ${resizeCount} resized, ${staleCount} stale removed, ${skipCount} skipped, ${Object.keys(dimensions).length} dimensions recorded`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
