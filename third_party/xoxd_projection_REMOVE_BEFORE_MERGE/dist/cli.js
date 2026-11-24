#!/usr/bin/env node
// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * xoxd-projection-fetch: the command a site build runs before it prerenders.
 *
 *   xoxd-projection-fetch --base-url <https url> --target <blog|firm>
 *     --manifest <sha256> --seq <n> --public-key-file <path> --out <dir>
 *     [--last-receipt <path>]
 *
 * The last build is the seq and manifest of a receipt. --last-receipt names
 * that receipt, such as a copy of the projection.json the live site serves,
 * and it must exist. Without it the fetcher reads the receipt already in the
 * output directory, and a missing one means a first build. It exits 0 when the output directory
 * holds the verified projection, 1 on any finding and 2 on a usage error.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isSite, SHA256_PATTERN } from './contract.js';
import { formatFinding } from './findings.js';
import { fetchProjection, OUTPUT, readLastBuild } from './fetch.js';

const USAGE =
	'usage: xoxd-projection-fetch --base-url <https url> --target <blog|firm> --manifest <sha256> --seq <n> --public-key-file <path> --out <dir> [--last-receipt <path>]';

function natural(text                    , name        )         {
	if (text === undefined || !/^(0|[1-9][0-9]*)$/.test(text)) throw new Error(`--${name} must be a natural number`);
	return Number(text);
}

async function main(argv                   )                  {
	let options
	 ;
	try {
		const { values } = parseArgs({
			args: [...argv],
			strict: true,
			allowPositionals: false,
			options: {
				'base-url': { type: 'string' },
				target: { type: 'string' },
				manifest: { type: 'string' },
				seq: { type: 'string' },
				'last-receipt': { type: 'string' },
				'public-key-file': { type: 'string' },
				out: { type: 'string' },
			},
		});
		const target = values.target;
		if (!isSite(target)) throw new Error('--target must be blog or firm');
		const manifestSha256 = values.manifest ?? '';
		if (!SHA256_PATTERN.test(manifestSha256)) throw new Error('--manifest must be a lowercase hex sha256');
		for (const name of ['base-url', 'public-key-file', 'out']         ) {
			if (values[name] === undefined || values[name] === '') throw new Error(`--${name} is required`);
		}
		// Under `bazel run` the process starts in the runfiles tree. Relative
		// paths mean the directory the command was typed in.
		const cwd = process.env.BUILD_WORKING_DIRECTORY ?? process.cwd();
		options = {
			baseUrl: values['base-url'] ?? '',
			target,
			manifestSha256,
			seq: natural(values.seq, 'seq'),
			lastReceipt: values['last-receipt'] === undefined ? null : resolve(cwd, values['last-receipt']),
			keyFile: resolve(cwd, values['public-key-file'] ?? ''),
			outDir: resolve(cwd, values.out ?? ''),
		};
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
		return 2;
	}

	try {
		const publicKey = (await readFile(options.keyFile, 'utf8')).trim();
		const last =
			options.lastReceipt === null
				? await readLastBuild(join(options.outDir, OUTPUT.receipt), options.target, true)
				: await readLastBuild(options.lastReceipt, options.target, false);
		const result = await fetchProjection({
			baseUrl: options.baseUrl,
			target: options.target,
			manifestSha256: options.manifestSha256,
			seq: options.seq,
			lastSeq: last.lastSeq,
			lastManifest: last.lastManifest,
			publicKey,
			outDir: options.outDir,
			// The https rule covers every request, so a redirect fails the fetch
			// instead of being followed, possibly to http.
			fetch: (url) => globalThis.fetch(url, { redirect: 'error' }),
		});
		if (!result.ok) {
			for (const item of result.findings) process.stderr.write(`${formatFinding(item)}\n`);
			process.stderr.write(`xoxd-projection-fetch: refused with ${result.findings.length} findings\n`);
			return 1;
		}
		process.stdout.write(
			`xoxd-projection-fetch: ${result.receipt.target} seq ${result.receipt.seq} manifest ${result.receipt.manifest} written to ${result.outDir}\n`,
		);
		return 0;
	} catch (error) {
		process.stderr.write(`xoxd-projection-fetch: ${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
}

process.exitCode = await main(process.argv.slice(2));
