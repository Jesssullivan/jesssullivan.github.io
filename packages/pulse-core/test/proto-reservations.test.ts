import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, '..', 'scripts', 'validate-proto-reservations.mts');

describe('proto schema-evolution validator', () => {
	it('passes against the canonical pulse.proto', () => {
		const result = spawnSync('npx', ['--no-install', 'tsx', SCRIPT], {
			encoding: 'utf8',
		});
		if (result.status !== 0) {
			throw new Error(
				`validator exited with status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
			);
		}
		expect(result.stdout).toContain('proto schema-evolution check ok');
	});
});
