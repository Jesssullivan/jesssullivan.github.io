#!/usr/bin/env node
import sharp from 'sharp';
import { readdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { existsSync } from 'node:fs';

const IMAGES_DIR = 'static/images/posts';
const DIMENSIONS_OUTPUT = 'static/images/posts/dimensions.json';
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80;
const dryRun = process.argv.includes('--dry-run');

async function main() {
	const files = await readdir(IMAGES_DIR);
	const imageFiles = files.filter((f) => /\.(jpe?g|png)$/i.test(f));
	const dimensions = {};
	let webpCount = 0;
	let resizeCount = 0;
	let skipCount = 0;

	for (const file of imageFiles) {
		const filepath = join(IMAGES_DIR, file);
		const ext = extname(file).toLowerCase();
		const base = basename(file, ext);
		const webpPath = join(IMAGES_DIR, `${base}.webp`);

		let metadata;
		try {
			metadata = await sharp(filepath).metadata();
		} catch (err) {
			console.warn(`  skip (unreadable): ${file} — ${err.message}`);
			skipCount++;
			continue;
		}

		const width = metadata.width ?? 0;
		const height = metadata.height ?? 0;
		dimensions[`/images/posts/${file}`] = { width, height };

		// Generate WebP if missing
		if (!existsSync(webpPath)) {
			if (dryRun) {
				console.log(`  would create: ${base}.webp`);
			} else {
				try {
					let pipeline = sharp(filepath);
					if (width > MAX_WIDTH) pipeline = pipeline.resize(MAX_WIDTH);
					await pipeline.webp({ quality: WEBP_QUALITY }).toFile(webpPath);
				} catch (err) {
					console.warn(`  skip WebP (error): ${file} — ${err.message}`);
					skipCount++;
					continue;
				}
			}
			webpCount++;
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
					console.warn(`  skip resize (error): ${file} — ${err.message}`);
					// Clean up partial .tmp file
					try { await unlink(filepath + '.tmp'); } catch { /* ok */ }
					skipCount++;
				}
			}
		}
	}

	// Also record dimensions for existing WebP-only files and other formats
	for (const file of files) {
		const key = `/images/posts/${file}`;
		if (dimensions[key]) continue;
		if (!/\.(webp|gif|svg)$/i.test(file)) continue;
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
		`${dryRun ? '[dry-run] ' : ''}Optimized: ${webpCount} WebP generated, ${resizeCount} resized, ${skipCount} skipped, ${Object.keys(dimensions).length} dimensions recorded`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
