#!/usr/bin/env node
/**
 * The check the "Hub projection v2" carrier workflow runs on a hub dispatch.
 * It reads PROJECTION_MANIFEST, PROJECTION_SEQ and PROJECTION_BASE from the
 * environment and refuses, before anything is fetched or built:
 * - a run on any ref but main,
 * - an input that breaks its contract format,
 * - a base outside allowedBases in projection/config.json,
 * - a pinned key that is still the placeholder.
 * The production workflow checks the inputs again and the projection step
 * verifies the manifest itself. Exit codes: 0 accepted, 1 refused, 2 usage.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StepError, parseConfig, parseKey, readInputs } from './step.mjs';

/** Checks a dispatch against the committed configuration and key. */
export function checkDispatch({ env, configText, keyText }) {
	if (env.GITHUB_REF !== 'refs/heads/main') {
		throw new StepError(`a hub dispatch must run on refs/heads/main, not ${env.GITHUB_REF ?? 'an unknown ref'}`);
	}
	const inputs = readInputs(env);
	if (inputs === null) throw new StepError('a hub dispatch needs all three inputs', 2);
	const config = parseConfig(configText);
	if (parseKey(keyText).placeholder) {
		throw new StepError('the pinned hub key is the placeholder, so a hub dispatch is refused');
	}
	if (!config.allowedBases.includes(inputs.base)) {
		throw new StepError(`${inputs.base} is not in the allowedBases of projection/config.json`);
	}
	return inputs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		const configText = await readFile(join(here, 'config.json'), 'utf8');
		const keyText = await readFile(join(here, parseConfig(configText).publicKeyFile), 'utf8');
		const inputs = checkDispatch({ env: process.env, configText, keyText });
		console.log(`projection: dispatch accepted for seq ${inputs.seq} manifest ${inputs.manifest}`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = error instanceof StepError ? error.code : 1;
	}
}
