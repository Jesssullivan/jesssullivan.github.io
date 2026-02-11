/**
 * process-wp-images.mjs
 *
 * Scans all .md files in src/posts/ for WordPress-hosted image URLs,
 * finds matching files in /tmp/wp-uploads/ (rsynced from xoxd-bates),
 * strips EXIF metadata, optimizes with sharp, generates WebP variants,
 * writes a URL mapping file, and rewrites all markdown files.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'src', 'posts');
const outputDir = join(root, 'static', 'images', 'posts');
const mapPath = join(root, 'static', 'images', 'wp-url-map.json');
const wpUploadsDir = '/tmp/wp-uploads';

// ── Helpers ──────────────────────────────────────────────────────────

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

/**
 * Extract the YYYY/MM/filename path from a WP URL.
 * e.g. https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2017/07/IMG.jpg?resize=...
 *   -> 2017/07/IMG.jpg
 */
function extractUploadPath(url) {
  // Strip query string first
  const noQs = url.split('?')[0];
  const match = noQs.match(/wp-content\/uploads\/(\d{4}\/\d{2}\/[^/\s)"'<>]+)/i);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Strip WordPress size suffix from filename.
 * e.g. "photo-300x200.jpg" -> "photo.jpg"
 * e.g. "IMG_3311-1-300x225.jpg" -> "IMG_3311-1.jpg"
 */
function stripSizeSuffix(filename) {
  const ext = extname(filename);
  const base = basename(filename, ext);
  // Match -NNNxNNN at the end of the basename
  const stripped = base.replace(/-\d+x\d+$/, '');
  if (stripped !== base) {
    return stripped + ext;
  }
  return null; // no size suffix found
}

/**
 * Strip WordPress edit hash suffix from filename.
 * e.g. "IMG_3357-e1527804133472.jpg" -> "IMG_3357.jpg"
 * e.g. "IMG_3355-1-e1527804648975-300x225.jpg" -> "IMG_3355-1.jpg"
 */
function stripEditHash(filename) {
  const ext = extname(filename);
  const base = basename(filename, ext);
  // Match -eNNNNNNNNNN (WP edit hash) possibly followed by -NNNxNNN
  const stripped = base.replace(/-e\d+(-\d+x\d+)?$/, '');
  if (stripped !== base) {
    return stripped + ext;
  }
  return null;
}

/**
 * Try adding WP "-scaled" suffix to filename.
 * WP 5.3+ stores large originals as "filename-scaled.ext"
 * e.g. "unnamed.jpg" -> "unnamed-scaled.jpg"
 */
function addScaledSuffix(filename) {
  const ext = extname(filename);
  const base = basename(filename, ext);
  return base + '-scaled' + ext;
}

/**
 * Try with the sized variant that exists in the backup.
 * Used as a last resort when the original isn't available.
 * e.g. "unnamed.jpg" -> look for "unnamed-225x300.jpg" (any sized version)
 */
function findSizedVariant(filename, fileIndex) {
  const ext = extname(filename).toLowerCase();
  const base = basename(filename, ext).toLowerCase();
  // Look through the index for any file that starts with this base and has a size suffix
  for (const [key, path] of fileIndex) {
    const keyExt = extname(key).toLowerCase();
    const keyBase = basename(key, keyExt).toLowerCase();
    if (keyExt === ext && keyBase.startsWith(base + '-') && /-\d+x\d+$/.test(keyBase)) {
      return path;
    }
  }
  return null;
}

// Build a lookup index of all files in wp-uploads for fast filename matching
function buildFileIndex(dir) {
  const index = new Map(); // filename (lowercase) -> full path
  const pathIndex = new Map(); // YYYY/MM/filename -> full path

  function walk(currentDir, relPath = '') {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const rel = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, rel);
      } else if (entry.isFile() && isImageExt(entry.name)) {
        // Store by lowercase filename for case-insensitive matching
        const key = entry.name.toLowerCase();
        if (!index.has(key)) {
          index.set(key, fullPath);
        }
        // Store by relative path
        pathIndex.set(rel, fullPath);
        // Also store lowercase version of path
        pathIndex.set(rel.toLowerCase(), fullPath);
      }
    }
  }

  walk(dir);
  return { index, pathIndex };
}

// ── URL Scanning ─────────────────────────────────────────────────────

function scanPosts() {
  const mdFiles = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  // Match URLs in markdown image syntax and also bare URLs
  const urlRegex = /https?:\/\/[^\s)"'<>]+/g;

  const allUrls = new Set();
  let filesWithMatches = 0;

  for (const file of mdFiles) {
    const content = readFileSync(join(postsDir, file), 'utf-8');
    const matches = content.match(urlRegex) || [];
    let found = false;
    for (const rawUrl of matches) {
      // Clean trailing punctuation
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

// ── Find local file ─────────────────────────────────────────────────

function findLocalFile(url, fileIndex, pathIndex) {
  // Strategy 1: Try exact YYYY/MM/filename path
  const uploadPath = extractUploadPath(url);
  if (uploadPath) {
    // Try exact match
    const exact = pathIndex.get(uploadPath);
    if (exact) return exact;

    // Try case-insensitive
    const exactLower = pathIndex.get(uploadPath.toLowerCase());
    if (exactLower) return exactLower;

    const filename = basename(uploadPath);
    const dirPart = dirname(uploadPath); // YYYY/MM

    // Strategy 2: Strip size suffix and try again
    const noSize = stripSizeSuffix(filename);
    if (noSize) {
      const tryPath = `${dirPart}/${noSize}`;
      const found = pathIndex.get(tryPath) || pathIndex.get(tryPath.toLowerCase());
      if (found) return found;
    }

    // Strategy 3: Strip edit hash and try
    const noEdit = stripEditHash(filename);
    if (noEdit) {
      const tryPath = `${dirPart}/${noEdit}`;
      const found = pathIndex.get(tryPath) || pathIndex.get(tryPath.toLowerCase());
      if (found) return found;
    }

    // Strategy 4: Strip both edit hash and size suffix
    if (noEdit) {
      const noEditNoSize = stripSizeSuffix(noEdit);
      if (noEditNoSize) {
        const tryPath = `${dirPart}/${noEditNoSize}`;
        const found = pathIndex.get(tryPath) || pathIndex.get(tryPath.toLowerCase());
        if (found) return found;
      }
    }
  }

  // Strategy 5: Just match by filename anywhere in the uploads dir
  const fname = filenameFromUrl(url);
  const byName = fileIndex.get(fname.toLowerCase());
  if (byName) return byName;

  // Strategy 6: Strip size suffix from filename and try
  const noSizeFname = stripSizeSuffix(fname);
  if (noSizeFname) {
    const found = fileIndex.get(noSizeFname.toLowerCase());
    if (found) return found;
  }

  // Strategy 7: Strip edit hash from filename and try
  const noEditFname = stripEditHash(fname);
  if (noEditFname) {
    const found = fileIndex.get(noEditFname.toLowerCase());
    if (found) return found;
  }

  // Strategy 8: Strip both
  if (noEditFname) {
    const noEditNoSizeFname = stripSizeSuffix(noEditFname);
    if (noEditNoSizeFname) {
      const found = fileIndex.get(noEditNoSizeFname.toLowerCase());
      if (found) return found;
    }
  }

  // Strategy 9: Try "-scaled" suffix (WP 5.3+)
  const scaledFname = addScaledSuffix(fname);
  const byScaled = fileIndex.get(scaledFname.toLowerCase());
  if (byScaled) return byScaled;

  // Strategy 10: Strip size suffix then try scaled
  if (noSizeFname) {
    const scaledNoSize = addScaledSuffix(noSizeFname);
    const found = fileIndex.get(scaledNoSize.toLowerCase());
    if (found) return found;
  }

  // Strategy 11: Try with path + scaled
  if (uploadPath) {
    const filename = basename(uploadPath);
    const dirPart = dirname(uploadPath);
    const scaledPath = `${dirPart}/${addScaledSuffix(filename)}`;
    const found = pathIndex.get(scaledPath) || pathIndex.get(scaledPath.toLowerCase());
    if (found) return found;

    // Also try stripped size + scaled
    const noSizeFile = stripSizeSuffix(filename);
    if (noSizeFile) {
      const scaledNoSizePath = `${dirPart}/${addScaledSuffix(noSizeFile)}`;
      const found2 = pathIndex.get(scaledNoSizePath) || pathIndex.get(scaledNoSizePath.toLowerCase());
      if (found2) return found2;
    }
  }

  // Strategy 12: Find any sized variant as last resort
  const sizedVariant = findSizedVariant(fname, fileIndex);
  if (sizedVariant) return sizedVariant;

  return null;
}

// ── Process Image ────────────────────────────────────────────────────

async function processImage(localPath, outputFilename) {
  const ext = extname(outputFilename).toLowerCase();
  const outPath = join(outputDir, outputFilename);
  const webpFilename = basename(outputFilename, ext) + '.webp';
  const webpPath = join(outputDir, webpFilename);

  const rawBuffer = readFileSync(localPath);
  const rawSize = rawBuffer.length;

  let optimizedBuffer;
  let corrupt = false;

  try {
    if (ext === '.png') {
      optimizedBuffer = await sharp(rawBuffer).rotate().png({ compressionLevel: 9 }).toBuffer();
    } else if (ext === '.gif') {
      // For GIFs, just copy as-is since sharp doesn't handle animated GIFs well
      optimizedBuffer = rawBuffer;
    } else {
      // jpg/jpeg -> optimized JPEG
      optimizedBuffer = await sharp(rawBuffer).rotate().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    }
  } catch (err) {
    // File may be corrupt/truncated - copy as-is
    console.log(`    WARN: sharp failed for ${outputFilename} (${err.message}), copying as-is`);
    optimizedBuffer = rawBuffer;
    corrupt = true;
  }

  // Generate WebP variant (static frame for GIFs)
  let webpBuffer;
  if (!corrupt) {
    try {
      webpBuffer = await sharp(rawBuffer).rotate().webp({ quality: 80 }).toBuffer();
      writeFileSync(webpPath, webpBuffer);
    } catch (err) {
      // Some images may fail webp conversion (e.g., animated GIFs)
      webpBuffer = null;
    }
  }

  writeFileSync(outPath, optimizedBuffer);

  return {
    localPath: `/images/posts/${outputFilename}`,
    rawSize,
    optimizedSize: optimizedBuffer.length,
    webpSize: webpBuffer ? webpBuffer.length : 0,
    corrupt,
  };
}

// ── Rewrite Markdown ─────────────────────────────────────────────────

function rewriteMarkdownFiles(urlMap) {
  const mdFiles = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  let totalReplacements = 0;
  let filesModified = 0;

  // Sort URLs by length descending to avoid partial replacement issues
  const sortedEntries = Object.entries(urlMap).sort((a, b) => b[0].length - a[0].length);

  for (const file of mdFiles) {
    const filePath = join(postsDir, file);
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;

    for (const [wpUrl, localPath] of sortedEntries) {
      // Escape special regex chars in URL
      const escaped = wpUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      const matches = content.match(regex);
      if (matches) {
        totalReplacements += matches.length;
        content = content.replace(regex, localPath);
      }
    }

    if (content !== originalContent) {
      writeFileSync(filePath, content);
      filesModified++;
    }
  }

  return { totalReplacements, filesModified };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== WordPress Image Migration (Local Files) ===\n');

  // Build file index from wp-uploads
  console.log(`Building file index from ${wpUploadsDir}...`);
  if (!existsSync(wpUploadsDir)) {
    console.error(`ERROR: ${wpUploadsDir} does not exist. Run rsync first.`);
    process.exit(1);
  }
  const { index: fileIndex, pathIndex } = buildFileIndex(wpUploadsDir);
  console.log(`Indexed ${fileIndex.size} unique filenames, ${pathIndex.size} paths.\n`);

  // Scan posts
  console.log('Scanning posts for WordPress image URLs...');
  const { urls, filesWithMatches } = scanPosts();
  console.log(`Found ${urls.length} unique image URLs across ${filesWithMatches} posts.\n`);

  if (urls.length === 0) {
    console.log('No images to process.');
    return;
  }

  mkdirSync(outputDir, { recursive: true });

  const urlMap = {};
  const seenOutputFilenames = new Set();
  let processed = 0;
  let found = 0;
  let notFound = 0;
  let alreadyExisted = 0;
  let totalRawSize = 0;
  let totalOptSize = 0;
  let totalWebpSize = 0;
  const notFoundUrls = [];
  const errors = [];

  for (const url of urls) {
    processed++;
    const fname = filenameFromUrl(url);
    const ext = extname(fname).toLowerCase();

    // Determine output filename (use the filename from the URL, deduplicated)
    let outputFilename = fname;

    // For sized variants, use the original filename for output
    const noSize = stripSizeSuffix(fname);
    const noEdit = stripEditHash(fname);
    // Prefer original (un-sized) name
    if (noSize && !outputFilename.includes('-e')) {
      // Check if the non-sized version is what we'd find
      outputFilename = noSize;
    }
    if (noEdit) {
      const noEditNoSize = stripSizeSuffix(noEdit);
      if (noEditNoSize) outputFilename = noEditNoSize;
      else outputFilename = noEdit;
    }

    // Deduplicate output filenames
    const lowerOut = outputFilename.toLowerCase();
    if (seenOutputFilenames.has(lowerOut)) {
      // This URL maps to the same file as a previous one - just use same path
      const existingPath = `/images/posts/${outputFilename}`;
      if (existsSync(join(outputDir, outputFilename))) {
        urlMap[url] = existingPath;
        if (processed % 50 === 0) {
          console.log(`  [${processed}/${urls.length}] found=${found} notFound=${notFound} dedup/existing=${alreadyExisted}`);
        }
        alreadyExisted++;
        continue;
      }
    }

    // Try to find the file locally
    const localFile = findLocalFile(url, fileIndex, pathIndex);

    if (localFile) {
      // Determine actual output filename from the found file if needed
      // Use the base filename for cleaner output
      if (!seenOutputFilenames.has(lowerOut)) {
        seenOutputFilenames.add(lowerOut);
      }

      try {
        const result = await processImage(localFile, outputFilename);
        urlMap[url] = result.localPath;
        totalRawSize += result.rawSize;
        totalOptSize += result.optimizedSize;
        totalWebpSize += result.webpSize;
        found++;
      } catch (err) {
        errors.push({ url, error: err.message, localFile });
        // Still try to record what we can
      }
    } else {
      // Check if previous download agent got it
      const existingFile = join(outputDir, outputFilename);
      if (existsSync(existingFile)) {
        urlMap[url] = `/images/posts/${outputFilename}`;
        alreadyExisted++;
        seenOutputFilenames.add(lowerOut);
      } else {
        // Also try with original filename (not stripped)
        const existingOrig = join(outputDir, fname);
        if (existsSync(existingOrig)) {
          urlMap[url] = `/images/posts/${fname}`;
          alreadyExisted++;
          seenOutputFilenames.add(fname.toLowerCase());
        } else {
          notFound++;
          notFoundUrls.push(url);
        }
      }
    }

    if (processed % 50 === 0 || processed === urls.length) {
      console.log(`  [${processed}/${urls.length}] found=${found} notFound=${notFound} dedup/existing=${alreadyExisted}`);
    }
  }

  // Write URL map
  writeFileSync(mapPath, JSON.stringify(urlMap, null, 2) + '\n');
  console.log(`\nWrote URL map to ${mapPath} (${Object.keys(urlMap).length} entries)`);

  // Rewrite markdown files
  console.log('\nRewriting markdown files...');
  const { totalReplacements, filesModified } = rewriteMarkdownFiles(urlMap);
  console.log(`Rewrote ${totalReplacements} URLs across ${filesModified} files.`);

  // Summary
  const fmt = (bytes) => {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  console.log('\n== Summary ======================================');
  console.log(`Total unique WP URLs found:    ${urls.length}`);
  console.log(`Processed from local files:    ${found}`);
  console.log(`Already existed (dedup):       ${alreadyExisted}`);
  console.log(`Not found:                     ${notFound}`);
  console.log(`Processing errors:             ${errors.length}`);
  console.log(`Raw size:                      ${fmt(totalRawSize)}`);
  console.log(`Optimized size:                ${fmt(totalOptSize)}`);
  console.log(`WebP variants:                 ${fmt(totalWebpSize)}`);
  if (totalRawSize > 0) {
    const savings = ((1 - totalOptSize / totalRawSize) * 100).toFixed(1);
    console.log(`Size reduction:                ${savings}%`);
  }
  console.log(`Markdown URLs rewritten:       ${totalReplacements}`);
  console.log(`Markdown files modified:       ${filesModified}`);
  console.log('=================================================');

  if (notFoundUrls.length > 0) {
    console.log(`\nNot found (${notFoundUrls.length}):`);
    for (const url of notFoundUrls) {
      const path = extractUploadPath(url);
      console.log(`  ${url}`);
      if (path) console.log(`    -> looked for: ${path}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\nProcessing errors (${errors.length}):`);
    for (const { url, error, localFile } of errors) {
      console.log(`  ${url}`);
      console.log(`    file: ${localFile}`);
      console.log(`    error: ${error}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
