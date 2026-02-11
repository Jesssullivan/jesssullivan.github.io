import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';

const POSTS_DIR = new URL('../src/posts/', import.meta.url).pathname;

// --- Helpers ---

/** Extract the post title from YAML frontmatter */
function extractTitle(content) {
  const m = content.match(/^---\s*\n[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m);
  if (!m) return null;
  // Strip surrounding quotes if present
  return m[1].replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
}

/** Title-case a string */
function titleCase(str) {
  return str
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Derive alt text from a URL's filename.
 * - IMG_XXXX / img_xxxx / DSC0XXXX → "Photo"
 * - Screen-Shot-... / Screenshot-... → "Screenshot"
 * - FullSizeRender → "Photo"
 * - Otherwise strip extension, size suffixes, replace separators, title-case.
 */
function altFromFilename(url) {
  try {
    // Strip query params for filename extraction
    const clean = url.split('?')[0];
    // Handle URLs that may end with / (WordPress slug-style links)
    const trimmed = clean.replace(/\/$/, '');
    const name = basename(trimmed);
    const stem = name.replace(/\.\w+$/, ''); // remove extension

    // Camera roll photos (IMG_, img_, DSC)
    if (/^IMG[_-]\d+/i.test(stem)) return 'Photo';
    if (/^DSC\d+/i.test(stem)) return 'Photo';
    if (/^FullSizeRender$/i.test(stem)) return 'Photo';

    // Screenshots
    if (/^Screen-?Shot/i.test(stem) || /^Screenshot/i.test(stem)) return 'Screenshot';

    // Clean up the stem for everything else
    let label = stem
      // Remove trailing size suffixes like -300x200, -1, -2, -e12345
      .replace(/-e\d+$/, '')
      .replace(/-\d+x\d+$/, '')
      .replace(/-\d{1,2}$/, '')
      // Replace hyphens/underscores with spaces
      .replace(/[-_]+/g, ' ')
      .trim();

    if (!label || /^\d+$/.test(label)) return null; // pure numbers - no useful info

    label = titleCase(label);

    // Truncate to 125 chars
    if (label.length > 125) label = label.slice(0, 122) + '...';

    return label;
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like it contains only markdown link/table syntax noise
 * rather than useful descriptive text.
 */
function isNoise(text) {
  if (!text) return true;
  // Table separators
  if (/^[\s|:-]+$/.test(text)) return true;
  if (/^---/.test(text)) return true;
  // Pure markdown link syntax residue
  if (/^\]\(/.test(text)) return true;
  // Pure URL
  if (/^https?:\/\//.test(text)) return true;
  // Too short
  if (text.length < 3) return true;
  return false;
}

/**
 * Extract text immediately following the last ](url) on a line,
 * but only real descriptive text, not markdown link syntax.
 */
function getInlineTextAfterImages(line) {
  // Find the last closing paren that is part of a markdown image/link
  // then get everything after it
  // We look for text after the FINAL )](url) pattern on the line
  const parts = line.split(/\]\([^)]*\)/);
  if (parts.length < 2) return null;
  const trailing = parts[parts.length - 1].trim();

  // Clean up trailing emphasis markers, list markers, etc.
  let text = cleanCaption(trailing);

  if (isNoise(text)) return null;
  if (text.length < 5) return null;
  if (text.length > 125) text = text.slice(0, 122) + '...';
  return text;
}

/**
 * Clean up a caption string: strip markdown emphasis, list markers,
 * leading/trailing whitespace.
 */
function cleanCaption(text) {
  return text
    // Strip leading list markers: *, -, +, numbered
    .replace(/^[\s]*[-*+]\s+/, '')
    .replace(/^[\s]*\d+\.\s+/, '')
    // Strip emphasis/bold markers (greedy, both ends)
    .replace(/^[*_]+/g, '')
    .replace(/[*_]+$/g, '')
    // Strip again after removing list markers (nested emphasis)
    .replace(/^[*_]+/g, '')
    .replace(/[*_]+$/g, '')
    .trim();
}

/**
 * Look at surrounding lines for a caption or descriptive context.
 * Returns null if nothing good is found.
 */
function captionFromSurroundingLines(lines, lineIndex) {
  // 1) Next non-empty line as caption (common WordPress export pattern)
  //    e.g. ![](url)
  //           Red Maple bark
  for (let i = lineIndex + 1; i < Math.min(lineIndex + 3, lines.length); i++) {
    const next = lines[i].trim();
    if (!next) continue;
    // Skip if next line is another image, header, separator, link, HTML, or table border
    if (next.startsWith('![')) break;
    if (next.startsWith('#')) break;
    if (/^[*_-]{3,}$/.test(next) || next === '* * *') break;
    if (/^\[.*\]\(.*\)$/.test(next)) break;
    if (/^</.test(next)) break;
    if (/^---\|---/.test(next) || /^\|/.test(next)) break;

    let caption = cleanCaption(next);

    if (isNoise(caption)) break;
    if (caption.length >= 3 && caption.length <= 125) return caption;
    if (caption.length > 125) return caption.slice(0, 122) + '...';
    break;
  }

  // 2) Look at the preceding non-empty line for descriptive context
  //    e.g.  **_Fast Pi camera stand sketch:_**
  //          ![](url)
  for (let i = lineIndex - 1; i >= Math.max(lineIndex - 3, 0); i--) {
    const prev = lines[i].trim();
    if (!prev) continue;
    // Skip if previous line is another image, header, separator
    if (prev.startsWith('![') || prev.startsWith('[![')) break;
    if (prev.startsWith('#')) break;
    if (/^[*_-]{3,}$/.test(prev) || prev === '* * *') break;
    if (/^---\|---/.test(prev) || /^\|/.test(prev)) break;

    let caption = cleanCaption(prev)
      .replace(/:$/, '');

    if (isNoise(caption)) break;
    // Only use if it looks like a short descriptive label
    if (caption.length >= 5 && caption.length <= 100 && !caption.includes('![')) return caption;
    break;
  }

  return null;
}

/**
 * Process a single file: find all ![](url) patterns and fill in alt text.
 * Returns { filename, count, details[] }.
 */
async function processFile(filepath) {
  const raw = await readFile(filepath, 'utf-8');
  const lines = raw.split('\n');
  const title = extractTitle(raw);
  const details = [];
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Only process lines that contain empty-alt images
    if (!line.includes('![]')) continue;

    // Gather context once per line
    const inlineText = getInlineTextAfterImages(line);
    const surroundingCaption = captionFromSurroundingLines(lines, i);
    let firstOnLine = true;

    const newLine = line.replace(/!\[\]\(([^)]+)\)/g, (match, url) => {
      let alt = null;

      // 1) Try inline text after images (only for first image on line)
      if (firstOnLine && inlineText) {
        alt = inlineText;
      }

      // 2) Try surrounding line captions (only for first image on line)
      if (!alt && firstOnLine && surroundingCaption) {
        alt = surroundingCaption;
      }

      // 3) Try filename-based alt
      if (!alt) {
        alt = altFromFilename(url);
      }

      // 4) Fall back to post title
      if (!alt && title) {
        alt = `Image from ${title}`;
        if (alt.length > 125) alt = alt.slice(0, 122) + '...';
      }

      // 5) Last resort
      if (!alt) {
        alt = 'Photo';
      }

      // Sanitize: make sure alt text doesn't contain characters that
      // would break markdown image syntax or HTML alt attributes
      alt = alt.replace(/[\[\]]/g, '');
      // Replace double quotes (straight and curly) with single quotes
      // to avoid breaking HTML alt="..." attributes
      alt = alt.replace(/["\u201C\u201D]/g, "'");

      details.push({ line: i + 1, url: url.slice(0, 80), alt });
      firstOnLine = false;
      return `![${alt}](${url})`;
    });

    if (newLine !== line) {
      lines[i] = newLine;
      modified = true;
    }
  }

  if (modified) {
    await writeFile(filepath, lines.join('\n'), 'utf-8');
  }

  return {
    filename: basename(filepath),
    count: details.length,
    details,
  };
}

// --- Main ---

async function main() {
  const files = (await readdir(POSTS_DIR))
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`Scanning ${files.length} markdown files in ${POSTS_DIR}\n`);

  let totalFound = 0;
  let totalFixed = 0;
  const results = [];

  for (const file of files) {
    const result = await processFile(join(POSTS_DIR, file));
    if (result.count > 0) {
      results.push(result);
      totalFound += result.count;
      totalFixed += result.count;
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total empty-alt images found: ${totalFound}`);
  console.log(`Total images fixed:           ${totalFixed}`);
  console.log(`Files modified:               ${results.length}`);
  console.log('='.repeat(60));
  console.log('');

  for (const r of results) {
    console.log(`  ${r.filename} (${r.count} images)`);
    for (const d of r.details) {
      console.log(`    L${d.line}: alt="${d.alt}"`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
