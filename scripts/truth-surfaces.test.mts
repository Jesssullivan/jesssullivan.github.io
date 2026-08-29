import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	BUILD_METRICS_DOC,
	LICENSES_DOC,
	buildLicenseInventory,
	checkBuildMetricsFreshness,
	checkTruthSurfaces,
	renderLicensesDoc,
} from './truth-surfaces.mjs';

/**
 * TIN-161 — the two static surfaces that claimed to describe the build.
 *
 * `THIRD-PARTY-LICENSES.md` was hand-maintained and had drifted years of
 * versions; `docs/build-metrics.md` was a February snapshot titled "Baseline".
 * Neither could fail, because nothing checked them. These tests are the check,
 * and half of them exist to prove the check can go red: a guard that has only
 * ever been seen passing is an unfailable assertion.
 */

const temps: string[] = [];
afterEach(() => {
	while (temps.length > 0) {
		rmSync(temps.pop() as string, { recursive: true, force: true });
	}
});

type Fixture = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	lock?: Record<string, { version?: string; license?: string; resolved?: string }>;
	metrics?: string;
	licensesDoc?: string;
};

const METRICS_TEMPLATE = (status: string, vite: string, svelte: string, kit: string) => `# Build Metrics Baseline

- **Status:** ${status}
- **Captured:** 2026-02-11 on branch \`feature/sprint3-week8\`

## Toolchain At Capture

| Package | Declared at capture |
| --- | --- |
| \`vite\` | ${vite} |
| \`svelte\` | ${svelte} |
| \`@sveltejs/kit\` | ${kit} |
`;

function fixture({ dependencies = {}, devDependencies = {}, lock = {}, metrics, licensesDoc }: Fixture): string {
	const root = mkdtempSync(join(tmpdir(), 'truth-surfaces-'));
	temps.push(root);

	writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies, devDependencies }, null, 2));
	writeFileSync(
		join(root, 'package-lock.json'),
		JSON.stringify(
			{
				lockfileVersion: 3,
				packages: Object.fromEntries(Object.entries(lock).map(([name, entry]) => [`node_modules/${name}`, entry])),
			},
			null,
			2,
		),
	);

	mkdirSync(join(root, 'docs'), { recursive: true });
	writeFileSync(join(root, BUILD_METRICS_DOC), metrics ?? METRICS_TEMPLATE('CURRENT', '^6.4.1', '^5.19.0', '^2.16.0'));
	writeFileSync(
		join(root, LICENSES_DOC),
		licensesDoc ?? renderLicensesDoc(buildLicenseInventory(root)),
	);
	return root;
}

describe('license surface is derived, not maintained', () => {
	it('reads version and license from the lockfile entry for the resolved version', () => {
		const root = fixture({
			dependencies: { shiki: '^4.2.0' },
			devDependencies: { vite: '^8.0.14' },
			lock: {
				shiki: { version: '4.2.0', license: 'MIT' },
				vite: { version: '8.0.14', license: 'MIT' },
			},
		});
		const inventory = buildLicenseInventory(root);
		expect(inventory.runtime).toEqual([
			{ name: 'shiki', specifier: '^4.2.0', version: '4.2.0', license: 'MIT', resolved: null },
		]);
		expect(inventory.build[0]).toMatchObject({ name: 'vite', version: '8.0.14' });
	});

	it('prints UNDECLARED rather than guessing when the lockfile declares no license', () => {
		const root = fixture({
			dependencies: { khroma: '^2.1.0' },
			lock: { khroma: { version: '2.1.0' } },
		});
		const inventory = buildLicenseInventory(root);
		expect(inventory.runtime[0].license).toBe('UNDECLARED');
		expect(inventory.undeclared).toEqual(['khroma']);
		expect(renderLicensesDoc(inventory)).toContain('UNDECLARED');
		// The failure mode this replaces: a hand-written MIT for a package
		// nobody read the license of.
		expect(renderLicensesDoc(inventory)).not.toContain('| khroma | `^2.1.0` | 2.1.0 | MIT |');
	});

	it('goes red when a resolved version moves and the document does not', () => {
		const root = fixture({
			dependencies: { shiki: '^4.2.0' },
			// The build-metrics half of the check shares this fixture root, so the
			// toolchain it records has to be declared here too — otherwise a
			// build-metrics violation would mask the license one being asserted.
			devDependencies: { vite: '^6.4.1', svelte: '^5.19.0', '@sveltejs/kit': '^2.16.0' },
			lock: { shiki: { version: '4.2.0', license: 'MIT' } },
		});
		expect(checkTruthSurfaces(root)).toEqual([]);

		// Bump the lockfile the way a dependency PR would, leaving the
		// committed document behind — the exact drift that produced
		// `shiki 3.22.0` in a tree resolving 4.2.0.
		writeFileSync(
			join(root, 'package-lock.json'),
			JSON.stringify({
				lockfileVersion: 3,
				packages: { 'node_modules/shiki': { version: '4.3.0', license: 'MIT' } },
			}),
		);
		expect(checkTruthSurfaces(root).join('\n')).toMatch(/THIRD-PARTY-LICENSES\.md is out of date/);
	});

	it('is deterministic: rendering twice produces identical bytes', () => {
		const root = fixture({
			dependencies: { marked: '^4.3.0' },
			lock: { marked: { version: '4.3.0', license: 'MIT' } },
		});
		const inventory = buildLicenseInventory(root);
		expect(renderLicensesDoc(inventory)).toBe(renderLicensesDoc(buildLicenseInventory(root)));
	});
});

describe('build-metrics freshness fails in both directions', () => {
	const deps = { vite: '^6.4.1', svelte: '^5.19.0', '@sveltejs/kit': '^2.16.0' };

	it('passes when the recorded toolchain matches and the page does not claim to be stale', () => {
		const root = fixture({ devDependencies: deps });
		expect(checkBuildMetricsFreshness(root)).toEqual([]);
	});

	it('fails when the toolchain moved and the page still presents itself as current', () => {
		const root = fixture({ devDependencies: { ...deps, vite: '^8.0.14' } });
		expect(checkBuildMetricsFreshness(root).join('\n')).toMatch(/the toolchain moved .* but Status does not say STALE/s);
	});

	it('passes once the page is marked STALE against a moved toolchain', () => {
		const root = fixture({
			devDependencies: { ...deps, vite: '^8.0.14' },
			metrics: METRICS_TEMPLATE('STALE — superseded', '^6.4.1', '^5.19.0', '^2.16.0'),
		});
		expect(checkBuildMetricsFreshness(root)).toEqual([]);
	});

	it('fails when the page keeps a STALE marker the toolchain no longer justifies', () => {
		const root = fixture({
			devDependencies: deps,
			metrics: METRICS_TEMPLATE('STALE — superseded', '^6.4.1', '^5.19.0', '^2.16.0'),
		});
		expect(checkBuildMetricsFreshness(root).join('\n')).toMatch(/Status says STALE but the recorded toolchain matches/);
	});

	it('fails when the page will not say which toolchain produced it', () => {
		const root = fixture({
			devDependencies: deps,
			metrics: '# Build Metrics Baseline\n\n- **Status:** CURRENT\n- **Captured:** 2026-02-11\n',
		});
		const violations = checkBuildMetricsFreshness(root).join('\n');
		expect(violations).toMatch(/does not record the `vite` version/);
		expect(violations).toMatch(/does not record the `@sveltejs\/kit` version/);
	});

	it('fails when the page carries no Status line at all', () => {
		const root = fixture({ devDependencies: deps, metrics: '# Build Metrics Baseline\n\nnumbers\n' });
		expect(checkBuildMetricsFreshness(root).join('\n')).toMatch(/no "- \*\*Status:\*\* \.\.\." line/);
	});
});

describe('this repository satisfies both surfaces', () => {
	it('has no truth-surface violations', () => {
		expect(checkTruthSurfaces(process.cwd())).toEqual([]);
	});

	it('publishes a license row for every direct dependency, none of them guessed', () => {
		const inventory = buildLicenseInventory(process.cwd());
		const declared = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
		const directCount =
			Object.keys(declared.dependencies ?? {}).length + Object.keys(declared.devDependencies ?? {}).length;
		expect(directCount).toBeGreaterThan(0);
		expect(inventory.runtime.length + inventory.build.length).toBe(directCount);
		expect(inventory.runtime.concat(inventory.build).filter((row) => row.version === 'UNRESOLVED')).toEqual([]);
	});
});
