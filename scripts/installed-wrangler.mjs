#!/usr/bin/env node
// Explicit existing-package selector. Never installs, invokes npx, or reads credentials.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = '/Users/jess/.npm/_npx/61e1327a8aba9411';
export const NODE = '/nix/store/dqsv0zlh74q4jhympjf4kpf8kslbms3p-nodejs-slim-22.23.2/bin/node';
export const ENTRY = `${PACKAGE_ROOT}/node_modules/wrangler/bin/wrangler.js`;
export const VERSION = '4.95.0';
export const INTEGRITY = 'sha512-vgXzFVSCdUbeCadgVXvu8fK5tzNm8T9W+7lriyGWZMx0B1+CAdr4d8JTlZszHfgjypRAHmAxb49etZGIRD9pgg==';
// Independently reviewed source pin, not a caller-supplied self-issued receipt.
export const REVIEWED = Object.freeze({ schema: 'tinyland.installed-wrangler.v1', version: VERSION, packageRoot: PACKAGE_ROOT, executable: NODE, entry: ENTRY,
  nodeSha256: '15482b66d8def992a3f9c289303444eef4d8cbc78d49171cef597c7799ab7d1f',
  entrySha256: '72d02815cbffc9ad14e1667188296e7126e13f0d90bfbb6046db8e6c4b6ff39a',
  lockSha256: '2c2b497c2eb73fc239ef31a236aabd0fca28f36a3da0551ee2ab6781d100b08d', lockIntegrity: INTEGRITY,
  treeSha256: '82bc01b851caa96866365a67cfdc674edc2e6be0df95994a86eb8b58f72ffeef', entryCount: 1864, byteCount: 309797833 });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => { throw new Error(message); };

export function treeIdentity(root = PACKAGE_ROOT) {
  if (realpathSync(root) !== root) fail('Package root is not physical');
  const rows = [];
  const inodes = new Map();
  let count = 0, bytes = 0;
  function visit(relative) {
    const absolute = path.join(root, relative), stat = lstatSync(absolute);
    if (stat.uid !== process.getuid() || (stat.mode & 0o022)) fail('Package custody differs');
    if (++count > 60000) fail('Package tree exceeds bound');
    if (stat.isSymbolicLink()) {
      const target = realpathSync(absolute);
      if (!target.startsWith(`${root}/`)) fail('Package link escapes tree');
      rows.push([relative, 'link', readlinkSync(absolute)]);
    } else if (stat.isDirectory()) {
      rows.push([relative, 'dir', stat.mode & 0o777]);
      for (const name of readdirSync(absolute).sort()) visit(path.join(relative, name));
    } else if (stat.isFile()) {
      bytes += stat.size;
      if (bytes > 512 * 1024 * 1024) fail('Package bytes exceeds bound');
      const inode = `${stat.dev}:${stat.ino}`, links = inodes.get(inode) || { count: 0, expected: stat.nlink };
      links.count++; inodes.set(inode, links);
      const content = readFileSync(absolute), after = lstatSync(absolute);
      if (content.length !== stat.size || after.ino !== stat.ino || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail('Package changed while reading');
      rows.push([relative, 'file', stat.mode & 0o777, content.length, hash(content)]);
    } else fail('Unsupported package entry');
  }
  visit('');
  for (const links of inodes.values()) if (links.count !== links.expected) fail('Package hardlink escapes tree');
  return { treeSha256: hash(JSON.stringify(rows)), entryCount: count, byteCount: bytes };
}

export function identify() {
  const lockBytes = readFileSync(`${PACKAGE_ROOT}/package-lock.json`);
  const lock = JSON.parse(lockBytes), installed = JSON.parse(readFileSync(`${PACKAGE_ROOT}/node_modules/wrangler/package.json`));
  const declared = lock.packages?.['node_modules/wrangler'];
  if (installed.name !== 'wrangler' || installed.version !== VERSION || declared?.version !== VERSION || declared.integrity !== INTEGRITY || declared.resolved !== `https://registry.npmjs.org/wrangler/-/wrangler-${VERSION}.tgz`) fail('Exact existing package/lock differs');
  if (realpathSync(NODE) !== NODE || !lstatSync(NODE).isFile() || (lstatSync(NODE).mode & 0o222)) fail('Pinned Node is not immutable');
  return { schema: 'tinyland.installed-wrangler.v1', version: VERSION, packageRoot: PACKAGE_ROOT, executable: NODE, entry: ENTRY, nodeSha256: hash(readFileSync(NODE)), entrySha256: hash(readFileSync(ENTRY)), lockSha256: hash(lockBytes), lockIntegrity: INTEGRITY, ...treeIdentity() };
}

export function verify(expected = REVIEWED) {
  const actual = identify();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('Reviewed package tree receipt differs');
  return actual;
}

// Caller retains artifact/source/project/credential guards and invokes this
// immediately before spawning. No ambient executable lookup or download fallback.
export function publisherTool(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) fail('Explicit tool arguments required');
  verify();
  return { executable: NODE, args: [ENTRY, ...args], identity: REVIEWED };
}

export function diagnostics(home) {
  // Owner-provided empty private diagnostic directory; no inherited env/config.
  const st = lstatSync(home);
  if (!st.isDirectory() || st.uid !== process.getuid() || (st.mode & 0o077) || readdirSync(home).length || realpathSync(home) !== home) fail('Diagnostic home must be empty, private, physical');
  const env = { HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home, WRANGLER_SEND_METRICS: 'false', WRANGLER_CHECK_FOR_UPDATES: 'false', CI: 'true', NO_COLOR: '1', PATH: path.dirname(NODE) };
  const before = verify();
  const run = (args) => {
    const result = spawnSync(NODE, [ENTRY, ...args], { env, cwd: home, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
    if (result.error || result.status !== 0) fail('Offline tool diagnostic failed');
    return result.stdout;
  };
  if (run(['--version']).trim() !== VERSION) fail('Actual tool version differs');
  const help = run(['pages', 'deploy', '--help']);
  if (!help.includes('--project-name') || !help.includes('--commit-hash') || !help.includes('--branch')) fail('Required deploy arguments absent');
  verify(before);
  return { identity: before, diagnostics: { version: VERSION, pagesDeployHelpSha256: hash(help), credentialsPassed: false, installationInvoked: false } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) fail('One explicit private diagnostic home required');
    console.log(JSON.stringify(diagnostics(process.argv[2]), null, 2));
  } catch (error) { console.error(`installed-wrangler: ${error.message}`); process.exitCode = 1; }
}
