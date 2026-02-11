/**
 * download-wp-images.mjs
 *
 * Scans all .md files in src/posts/ for WordPress-hosted image URLs,
 * downloads them (with Wayback Machine fallback for dead WP CDN links),
 * strips EXIF metadata, optimizes with sharp, generates WebP variants,
 * and writes a URL mapping file.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'src', 'posts');
const outputDir = join(root, 'static', 'images', 'posts');
const mapPath = join(root, 'static', 'images', 'wp-url-map.json');

const MAX_CONCURRENT = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract the filename from a WP URL, stripping query strings. */
function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1]);
  } catch {
    const noQs = url.split('?')[0];
    const parts = noQs.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }
}

/** Is this an image file extension? */
function isImageExt(filename) {
  const ext = extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext);
}

/** Short hash of a string (first 8 hex chars of sha256). */
function shortHash(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 8);
}

/**
 * Extract the origin URL path from a WP CDN proxy URL.
 * e.g. https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2017/07/IMG.jpg?resize=...
 *   -> https://transscendsurvival.org/wp-content/uploads/2017/07/IMG.jpg
 *
 * For localhost URLs:
 *   https://i1.wp.com/localhost/wp-content/uploads/2016/12/file.jpg?...
 *   -> https://transscendsurvival.org/wp-content/uploads/2016/12/file.jpg
 */
function extractOriginUrl(url) {
  try {
    const parsed = new URL(url);

    // If it's an i[0-9].wp.com proxy URL, the pathname contains the origin host + path
    if (/^i[0-9]\.wp\.com$/i.test(parsed.hostname)) {
      // pathname: /transscendsurvival.org/wp-content/uploads/...
      // or /www.transscendsurvival.org/wp-content/uploads/...
      // or /localhost/wp-content/uploads/...
      // or /raw.githubusercontent.com/...
      const pathWithoutLeadingSlash = parsed.pathname.slice(1);
      const slashIdx = pathWithoutLeadingSlash.indexOf('/');
      if (slashIdx === -1) return null;

      let originHost = pathWithoutLeadingSlash.slice(0, slashIdx);
      const originPath = pathWithoutLeadingSlash.slice(slashIdx);

      // Rewrite localhost to transscendsurvival.org
      if (originHost === 'localhost' || originHost.startsWith('localhost:')) {
        originHost = 'transscendsurvival.org';
      }

      return `https://${originHost}${originPath}`;
    }

    // If it's a direct wp-content/uploads URL (not proxied)
    // Strip query string and return
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

/**
 * Build candidate Wayback Machine URLs for a given origin URL.
 * Returns an array of URLs to try in order.
 */
function waybackCandidates(originUrl) {
  if (!originUrl) return [];

  const candidates = [];
  try {
    const parsed = new URL(originUrl);
    const path = parsed.pathname;

    // Try both www and non-www variants
    const hosts = new Set();
    hosts.add(parsed.hostname);
    if (parsed.hostname.startsWith('www.')) {
      hosts.add(parsed.hostname.slice(4));
    } else {
      hosts.add('www.' + parsed.hostname);
    }

    // Try both http and https, multiple years
    for (const host of hosts) {
      for (const proto of ['https', 'http']) {
        const baseUrl = `${proto}://${host}${path}`;
        // Use Wayback's wildcard timestamp - it finds the closest snapshot
        candidates.push(`https://web.archive.org/web/2022if_/${baseUrl}`);
        candidates.push(`https://web.archive.org/web/2020if_/${baseUrl}`);
        candidates.push(`https://web.archive.org/web/2018if_/${baseUrl}`);
      }
    }
  } catch {
    // ignore
  }

  return candidates;
}

// ── URL Scanning ─────────────────────────────────────────────────────

function scanPosts() {
  const mdFiles = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  const urlRegex = /https?:\/\/[^\s)"'<>]+/g;

  const allUrls = new Set();
  let filesWithMatches = 0;

  for (const file of mdFiles) {
    const content = readFileSync(join(postsDir, file), 'utf-8');
    const matches = content.match(urlRegex) || [];
    let found = false;
    for (const rawUrl of matches) {
      // Clean trailing punctuation that may have been captured
      let url = rawUrl.replace(/[),;]+$/, '');
      // Must match WP patterns
      if (!/i[0-9]\.wp\.com/i.test(url) && !/wp-content\/uploads/i.test(url)) continue;
      // Must have an image extension (before query string)
      const fname = filenameFromUrl(url);
      if (!isImageExt(fname)) continue;
      allUrls.add(url);
      found = true;
    }
    if (found) filesWithMatches++;
  }

  return { urls: [...allUrls], filesWithMatches };
}

// ── Download ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return resp;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/** Try downloading from the original URL with retries. Returns Buffer or null. */
async function tryDirectDownload(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetchWithTimeout(url);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        // Verify it looks like an image (check for common magic bytes)
        if (buf.length > 100 && looksLikeImage(buf)) {
          return buf;
        }
        return null; // got a response but it's not an image
      }
      if (resp.status === 404) return null; // definitive not found
      // Other errors: retry
    } catch {
      // network error: retry
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }
  return null;
}

/** Try downloading from the Wayback Machine. Returns Buffer or null. */
async function tryWaybackDownload(originUrl) {
  const candidates = waybackCandidates(originUrl);
  for (const wbUrl of candidates) {
    try {
      const resp = await fetchWithTimeout(wbUrl, 45_000);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length > 100 && looksLikeImage(buf)) {
          return buf;
        }
      }
    } catch {
      // try next candidate
    }
    // Small delay between Wayback attempts to be polite
    await sleep(300);
  }
  return null;
}

/** Check magic bytes to see if buffer is likely an image. */
function looksLikeImage(buf) {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: 47 49 46
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.length > 11) {
    if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  }
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // TIFF: 49 49 or 4D 4D
  if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4d && buf[1] === 0x4d)) return true;
  return false;
}

/**
 * Download an image with fallback strategy:
 * 1. Try the original URL directly
 * 2. On failure, try Wayback Machine with multiple URL variants
 */
async function downloadImage(url) {
  // Attempt 1: direct download
  const directBuf = await tryDirectDownload(url);
  if (directBuf) return { buffer: directBuf, source: 'direct' };

  // Attempt 2: Wayback Machine
  const originUrl = extractOriginUrl(url);
  if (originUrl) {
    const wbBuf = await tryWaybackDownload(originUrl);
    if (wbBuf) return { buffer: wbBuf, source: 'wayback' };
  }

  throw new Error('All download attempts failed (direct + Wayback Machine)');
}

// ── Process ──────────────────────────────────────────────────────────

async function processImage(url, seenFilenames) {
  const origFilename = filenameFromUrl(url);
  const ext = extname(origFilename).toLowerCase();

  // Deduplicate filenames: if another URL already claimed this name, add a hash suffix
  let finalFilename = origFilename;
  const nameBase = basename(origFilename, ext);
  if (seenFilenames.has(origFilename.toLowerCase())) {
    const hash = shortHash(url);
    finalFilename = `${nameBase}-${hash}${ext}`;
  }
  seenFilenames.add(finalFilename.toLowerCase());

  const outPath = join(outputDir, finalFilename);
  const webpFilename = basename(finalFilename, ext) + '.webp';
  const webpPath = join(outputDir, webpFilename);

  // Download (with Wayback fallback)
  const { buffer: rawBuffer, source } = await downloadImage(url);
  const rawSize = rawBuffer.length;

  // Process with sharp: rotate (apply EXIF orientation), strip all metadata, optimize
  let optimizedBuffer;
  if (ext === '.png') {
    optimizedBuffer = await sharp(rawBuffer).rotate().png({ quality: 80, effort: 6 }).toBuffer();
  } else if (ext === '.gif') {
    // Convert GIF to PNG with metadata stripped
    optimizedBuffer = await sharp(rawBuffer).rotate().png().toBuffer();
  } else {
    // jpg/jpeg -> optimized JPEG
    optimizedBuffer = await sharp(rawBuffer).rotate().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  }

  // Generate WebP variant
  const webpBuffer = await sharp(rawBuffer).rotate().webp({ quality: 80 }).toBuffer();

  // Write files
  writeFileSync(outPath, optimizedBuffer);
  writeFileSync(webpPath, webpBuffer);

  return {
    originalUrl: url,
    localPath: `/images/posts/${finalFilename}`,
    rawSize,
    optimizedSize: optimizedBuffer.length,
    webpSize: webpBuffer.length,
    source,
  };
}

// ── Concurrency limiter ──────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Scanning posts for WordPress image URLs...');
  const { urls, filesWithMatches } = scanPosts();
  console.log(`Found ${urls.length} unique image URLs across ${filesWithMatches} posts.\n`);

  if (urls.length === 0) {
    console.log('No images to download.');
    return;
  }

  mkdirSync(outputDir, { recursive: true });

  const urlMap = {};
  const seenFilenames = new Set();
  let downloaded = 0;
  let fromDirect = 0;
  let fromWayback = 0;
  let failed = 0;
  let totalRawSize = 0;
  let totalOptSize = 0;
  let totalWebpSize = 0;
  const errors = [];
  let processed = 0;

  const tasks = urls.map((url) => async () => {
    try {
      const result = await processImage(url, seenFilenames);
      urlMap[url] = result.localPath;
      totalRawSize += result.rawSize;
      totalOptSize += result.optimizedSize;
      totalWebpSize += result.webpSize;
      downloaded++;
      if (result.source === 'wayback') fromWayback++;
      else fromDirect++;
    } catch (err) {
      failed++;
      errors.push({ url, error: err.message });
    }
    processed++;
    if (processed % 25 === 0 || processed === urls.length) {
      console.log(
        `  [${processed}/${urls.length}] OK: ${downloaded} (direct: ${fromDirect}, wayback: ${fromWayback}), failed: ${failed}`
      );
    }
  });

  console.log(`Downloading ${urls.length} images (max ${MAX_CONCURRENT} concurrent)...`);
  console.log('Using Wayback Machine as fallback for dead WP CDN links.\n');
  await runWithConcurrency(tasks, MAX_CONCURRENT);

  // Write URL map
  writeFileSync(mapPath, JSON.stringify(urlMap, null, 2) + '\n');
  console.log(`\nWrote URL map to ${mapPath}`);

  // Summary
  const fmt = (bytes) => {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  console.log('\n── Summary ──────────────────────────────────────');
  console.log(`Total unique URLs found:  ${urls.length}`);
  console.log(`Downloaded successfully:  ${downloaded}`);
  console.log(`  - From direct URL:      ${fromDirect}`);
  console.log(`  - From Wayback Machine: ${fromWayback}`);
  console.log(`Failed:                   ${failed}`);
  console.log(`Raw download size:        ${fmt(totalRawSize)}`);
  console.log(`Optimized size (jpg/png): ${fmt(totalOptSize)}`);
  console.log(`WebP variants size:       ${fmt(totalWebpSize)}`);
  console.log(`Combined output size:     ${fmt(totalOptSize + totalWebpSize)}`);
  if (totalRawSize > 0) {
    const savings = ((1 - totalOptSize / totalRawSize) * 100).toFixed(1);
    console.log(`Size reduction (opt):     ${savings}%`);
  }
  console.log('─────────────────────────────────────────────────');

  if (errors.length > 0) {
    console.log(`\nFailed URLs (${errors.length}):`);
    for (const { url, error } of errors) {
      console.log(`  ${url}`);
      console.log(`    -> ${error}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
