import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	BUILD_METRICS_DOC,
	DEPENDENCY_GROUPS,
	LICENSES_DATA,
	LICENSES_DOC,
	buildLicenseInventory,
	checkBuildMetricsFreshness,
	checkBuildMetricsProvenance,
	checkTruthSurfaces,
	renderLicensesData,
	renderLicensesDoc,
} from './truth-surfaces.mjs';

/**
 * TIN-161 — the static surfaces that claimed to describe the build.
 *
 * `THIRD-PARTY-LICENSES.md` was hand-maintained and had drifted years of
 * versions; `src/routes/THIRD-PARTY-LICENSES/+page.svelte` is the copy the
 * public actually reads and had drifted the same way; `docs/build-metrics.md`
 * was a February snapshot titled "Baseline". None could fail, because nothing
 * checked them. These tests are the check, and most of them exist to prove the
 * check can go red: a guard that has only ever been seen passing is an
 * unfailable assertion.
 */

const temps: string[] = [];
afterEach(() => {
	while (temps.length > 0) {
		rmSync(temps.pop() as string, { recursive: true, force: true });
	}
});

type LockEntry = { version?: string; license?: string; resolved?: string; dev?: boolean; link?: boolean };

type Fixture = {
	manifest?: Record<string, unknown>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	/** Keyed by install path; a bare name is shorthand for `node_modules/<name>`. */
	lock?: Record<string, LockEntry>;
	metrics?: string;
	licensesDoc?: string;
	licensesData?: string;
};

const CAPTURE_COMMIT = '9aac474';

const METRICS_TEMPLATE = (status: string, vite: string, svelte: string, kit: string) => `# Build Metrics Baseline

- **Status:** ${status}
- **Captured:** 2026-02-11 on branch \`feature/sprint3-week8\` (commit \`${CAPTURE_COMMIT}\`)

## Toolchain At Capture

| Package | Declared at capture |
| --- | --- |
| \`vite\` | ${vite} |
| \`svelte\` | ${svelte} |
| \`@sveltejs/kit\` | ${kit} |
`;

/** A `readAtCommit` that answers for one commit only, like git history does. */
const commitReader = (commit: string, manifest: Record<string, unknown>) => (asked: string, path: string) =>
	asked === commit && path === 'package.json' ? JSON.stringify(manifest) : null;

const write = (root: string, relative: string, contents: string) => {
	mkdirSync(dirname(join(root, relative)), { recursive: true });
	writeFileSync(join(root, relative), contents);
};

function fixture({
	manifest,
	dependencies = {},
	devDependencies = {},
	lock = {},
	metrics,
	licensesDoc,
	licensesData,
}: Fixture): string {
	const root = mkdtempSync(join(tmpdir(), 'truth-surfaces-'));
	temps.push(root);

	write(root, 'package.json', JSON.stringify(manifest ?? { dependencies, devDependencies }, null, 2));
	write(
		root,
		'package-lock.json',
		JSON.stringify(
			{
				lockfileVersion: 3,
				packages: Object.fromEntries(
					Object.entries(lock).map(([path, entry]) => [
						path.startsWith('node_modules/') ? path : `node_modules/${path}`,
						entry,
					]),
				),
			},
			null,
			2,
		),
	);

	write(root, BUILD_METRICS_DOC, metrics ?? METRICS_TEMPLATE('CURRENT', '^6.4.1', '^5.19.0', '^2.16.0'));
	const inventory = buildLicenseInventory(root);
	write(root, LICENSES_DOC, licensesDoc ?? renderLicensesDoc(inventory));
	write(root, LICENSES_DATA, licensesData ?? renderLicensesData(inventory));
	return root;
}

describe('license surface is derived, not maintained', () => {
	it('reads version, license and source from the lockfile entry for the resolved version', () => {
		const root = fixture({
			dependencies: { shiki: '^4.2.0' },
			devDependencies: { vite: '^8.0.14' },
			lock: {
				shiki: { version: '4.2.0', license: 'MIT', resolved: 'https://registry.npmjs.org/shiki/-/shiki-4.2.0.tgz' },
				vite: { version: '8.0.14', license: 'MIT', dev: true },
			},
		});
		const inventory = buildLicenseInventory(root);
		expect(inventory.runtime).toEqual([
			{
				name: 'shiki',
				specifier: '^4.2.0',
				version: '4.2.0',
				license: 'MIT',
				resolved: 'https://registry.npmjs.org/shiki/-/shiki-4.2.0.tgz',
			},
		]);
		expect(inventory.build[0]).toMatchObject({ name: 'vite', version: '8.0.14' });
		// `resolved` is the only field that reveals a package that did not come
		// from the registry, so the document has to print it.
		expect(renderLicensesDoc(inventory)).toContain('<https://registry.npmjs.org/shiki/-/shiki-4.2.0.tgz>');
	});

	it('prints UNDECLARED rather than guessing when the lockfile declares no license', () => {
		const root = fixture({
			dependencies: { khroma: '^2.1.0' },
			lock: { khroma: { version: '2.1.0' } },
		});
		const inventory = buildLicenseInventory(root);
		expect(inventory.runtime[0].license).toBe('UNDECLARED');
		expect(inventory.tree.undeclared).toEqual(['khroma@2.1.0']);
		expect(renderLicensesDoc(inventory)).toContain('UNDECLARED');
		// The failure mode this replaces: a hand-written MIT for a package
		// nobody read the license of.
		expect(renderLicensesDoc(inventory)).not.toContain('| khroma | `^2.1.0` | 2.1.0 | MIT |');
	});

	it('publishes every dependency group the manifest declares, not just the two this repo uses', () => {
		const root = fixture({
			manifest: {
				dependencies: { shiki: '^4.2.0' },
				devDependencies: { vite: '^8.0.14' },
				optionalDependencies: { fsevents: '^2.3.3' },
				peerDependencies: { svelte: '^5.55.4' },
			},
			lock: {
				shiki: { version: '4.2.0', license: 'MIT' },
				vite: { version: '8.0.14', license: 'MIT' },
				fsevents: { version: '2.3.3', license: 'MIT' },
				svelte: { version: '5.55.4', license: 'MIT' },
			},
		});
		const inventory = buildLicenseInventory(root);
		expect(inventory.optional).toEqual([
			{ name: 'fsevents', specifier: '^2.3.3', version: '2.3.3', license: 'MIT', resolved: null },
		]);
		expect(inventory.peer[0]).toMatchObject({ name: 'svelte', version: '5.55.4' });
		// An omitted group used to be invisible: the package simply never
		// appeared, and no figure moved.
		const rendered = renderLicensesDoc(inventory);
		expect(rendered).toContain('## Optional Dependencies');
		expect(rendered).toContain('| fsevents |');
		expect(rendered).toContain('## Peer Dependencies');
	});

	it('omits the heading for a dependency group the manifest does not declare', () => {
		const root = fixture({ dependencies: { shiki: '^4.2.0' }, lock: { shiki: { version: '4.2.0', license: 'MIT' } } });
		expect(renderLicensesDoc(buildLicenseInventory(root))).not.toContain('Optional Dependencies');
	});

	it('counts a package installed at several paths once, not once per path', () => {
		const root = fixture({
			dependencies: { a: '^1.0.0' },
			lock: {
				a: { version: '1.0.0', license: 'MIT' },
				'node_modules/a/node_modules/dup': { version: '2.0.0', license: 'ISC' },
				'node_modules/b/node_modules/dup': { version: '2.0.0', license: 'ISC' },
				'node_modules/c/node_modules/dup': { version: '3.0.0', license: 'ISC' },
			},
		});
		const { tree } = buildLicenseInventory(root);
		// Four install paths, three packages: `dup@2.0.0` lands twice.
		expect(tree.installCount).toBe(4);
		expect(tree.packageCount).toBe(3);
		expect(tree.licenseHistogram).toEqual([
			['ISC', 2],
			['MIT', 1],
		]);
	});

	it("excludes this repository's own workspace links from the third-party figures", () => {
		const root = fixture({
			dependencies: { a: '^1.0.0' },
			lock: {
				a: { version: '1.0.0', license: 'MIT' },
				'@blog/pulse-core': { link: true },
				'@blog/pulse-client': { link: true },
			},
		});
		const { tree } = buildLicenseInventory(root);
		expect(tree.packageCount).toBe(1);
		expect(tree.workspacePackages).toEqual(['@blog/pulse-client', '@blog/pulse-core']);
		// Workspace links carry no license field. Counting them as third party
		// published this repo's own code as an unlicensed dependency.
		expect(tree.undeclared).toEqual([]);
	});

	it('separates the runtime histogram from the dev-inclusive one', () => {
		const root = fixture({
			dependencies: { a: '^1.0.0' },
			devDependencies: { b: '^1.0.0' },
			lock: {
				a: { version: '1.0.0', license: 'MIT' },
				b: { version: '1.0.0', license: 'LGPL-3.0-or-later', dev: true },
			},
		});
		const { tree } = buildLicenseInventory(root);
		expect(tree.runtimePackageCount).toBe(1);
		expect(tree.runtimeLicenseHistogram).toEqual([['MIT', 1]]);
		// A copyleft build tool is not distributed by a prerendered static
		// site, and blending it into one number made the attribution useless.
		expect(tree.licenseHistogram).toEqual([
			['LGPL-3.0-or-later', 1],
			['MIT', 1],
		]);
	});

	it('treats a package as runtime when any of its installs is outside the dev tree', () => {
		const root = fixture({
			dependencies: { a: '^1.0.0' },
			lock: {
				a: { version: '1.0.0', license: 'MIT' },
				'node_modules/tool/node_modules/shared': { version: '1.0.0', license: 'ISC', dev: true },
				'node_modules/a/node_modules/shared': { version: '1.0.0', license: 'ISC' },
			},
		});
		const { tree } = buildLicenseInventory(root);
		expect(tree.runtimePackageCount).toBe(2);
		expect(tree.runtimeLicenseHistogram).toEqual([
			['ISC', 1],
			['MIT', 1],
		]);
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

	it('goes red when the data the published page renders drifts, not just the Markdown', () => {
		const root = fixture({
			dependencies: { shiki: '^4.2.0' },
			devDependencies: { vite: '^6.4.1', svelte: '^5.19.0', '@sveltejs/kit': '^2.16.0' },
			lock: { shiki: { version: '4.2.0', license: 'MIT' } },
		});
		expect(checkTruthSurfaces(root)).toEqual([]);

		// The original defect: the Markdown was regenerated and the prerendered
		// route — the copy the public reads — was left behind.
		writeFileSync(join(root, LICENSES_DATA), '{"generatedBy":"a hand"}\n');
		expect(checkTruthSurfaces(root).join('\n')).toMatch(/third-party-licenses\.json is out of date/);
	});

	it('reports a missing surface as a violation instead of throwing', () => {
		const root = fixture({ dependencies: { shiki: '^4.2.0' }, lock: { shiki: { version: '4.2.0', license: 'MIT' } } });
		rmSync(join(root, LICENSES_DOC));
		rmSync(join(root, LICENSES_DATA));
		const violations = checkTruthSurfaces(root).join('\n');
		expect(violations).toMatch(/THIRD-PARTY-LICENSES\.md: missing/);
		expect(violations).toMatch(/third-party-licenses\.json: missing/);
	});

	it('renders the same bytes when the manifest and lockfile key order is reversed', () => {
		// The claim worth testing is stability across input order, not that a
		// pure function called twice agrees with itself — that cannot fail.
		const dependencies = { shiki: '^4.2.0', marked: '^4.3.0', dompurify: '^3.4.13' };
		const lock = {
			shiki: { version: '4.2.0', license: 'MIT' },
			marked: { version: '4.3.0', license: 'MIT' },
			dompurify: { version: '3.4.13', license: '(MPL-2.0 OR Apache-2.0)' },
		};
		const reverse = <T,>(value: Record<string, T>) => Object.fromEntries(Object.entries(value).reverse());

		const forward = renderLicensesDoc(buildLicenseInventory(fixture({ dependencies, lock })));
		const backward = renderLicensesDoc(
			buildLicenseInventory(fixture({ dependencies: reverse(dependencies), lock: reverse(lock) })),
		);
		expect(backward).toBe(forward);
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

	it('reports a deleted metrics page as a violation instead of throwing', () => {
		const root = fixture({ devDependencies: deps });
		rmSync(join(root, BUILD_METRICS_DOC));
		expect(checkBuildMetricsFreshness(root).join('\n')).toMatch(/docs\/build-metrics\.md: missing/);
	});
});

describe('the toolchain row is provenance, not a field', () => {
	const capture = { devDependencies: { vite: '^6.4.1', svelte: '^5.19.0', '@sveltejs/kit': '^2.16.0' } };

	it('passes when the recorded row is what the capture commit declared', () => {
		const root = fixture({ devDependencies: capture.devDependencies });
		expect(checkBuildMetricsProvenance(root, commitReader(CAPTURE_COMMIT, capture))).toEqual([]);
	});

	it('fails when the row is retyped to whatever makes the freshness check green', () => {
		// Without this, the cheapest path to green after a Vite bump is to edit
		// three cells and drop the STALE marker, without recapturing a single
		// number — the guard would reward falsifying the provenance.
		const root = fixture({
			devDependencies: { vite: '^8.0.14', svelte: '^5.55.4', '@sveltejs/kit': '^2.61.1' },
			metrics: METRICS_TEMPLATE('CURRENT', '^8.0.14', '^5.55.4', '^2.61.1'),
		});
		expect(checkBuildMetricsFreshness(root)).toEqual([]);
		const violations = checkBuildMetricsProvenance(root, commitReader(CAPTURE_COMMIT, capture)).join('\n');
		expect(violations).toMatch(/records `vite` at \^8\.0\.14 "at capture", but `9aac474:package\.json` declares \^6\.4\.1/);
		expect(violations).toMatch(/records `@sveltejs\/kit` at \^2\.61\.1/);
	});

	it('fails when the page will not name the commit it was captured at', () => {
		const root = fixture({
			devDependencies: capture.devDependencies,
			metrics: METRICS_TEMPLATE('CURRENT', '^6.4.1', '^5.19.0', '^2.16.0').replace(/ \(commit `[0-9a-f]+`\)/, ''),
		});
		expect(checkBuildMetricsProvenance(root, commitReader(CAPTURE_COMMIT, capture)).join('\n')).toMatch(
			/does not name the commit it was captured at/,
		);
	});

	it('fails when the named commit is not in this repository', () => {
		const root = fixture({
			devDependencies: capture.devDependencies,
			metrics: METRICS_TEMPLATE('CURRENT', '^6.4.1', '^5.19.0', '^2.16.0').replace(CAPTURE_COMMIT, 'deadbee'),
		});
		expect(checkBuildMetricsProvenance(root, commitReader(CAPTURE_COMMIT, capture)).join('\n')).toMatch(
			/cannot read package\.json at the declared capture commit `deadbee`/,
		);
	});

	it('is wired into checkTruthSurfaces wherever git history is available', () => {
		// Proving the wiring, not just the function: the Vitest sandbox is a
		// copied tree with no `.git`, so an unwired provenance check would be
		// invisible to every other case here. This fixture has a `.git`, so
		// checkTruthSurfaces must reach for history — and fail, because the
		// fixture is not a real repository.
		const root = fixture({ devDependencies: capture.devDependencies });
		mkdirSync(join(root, '.git'), { recursive: true });
		expect(checkTruthSurfaces(root).join('\n')).toMatch(/cannot read package\.json at the declared capture commit/);
	});
});

describe('this repository satisfies every surface', () => {
	it('has no truth-surface violations', () => {
		expect(checkTruthSurfaces(process.cwd())).toEqual([]);
	});

	it('publishes a license row for every direct dependency, none of them guessed', () => {
		const inventory = buildLicenseInventory(process.cwd());
		const declared = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
		// Derived from the manifest rather than restating the two keys the
		// implementation reads: a group the implementation ignores has to show
		// up as a count mismatch, not as silence.
		const directCount = Object.entries(declared)
			.filter(([key, value]) => key.endsWith('ependencies') && value !== null && typeof value === 'object')
			.reduce((total, [, value]) => total + Object.keys(value as Record<string, string>).length, 0);
		const published = inventory.groups.reduce((total, group) => total + group.rows.length, 0);
		expect(directCount).toBeGreaterThan(0);
		expect(published).toBe(directCount);
		expect(inventory.groups.flatMap((group) => group.rows).filter((row) => row.version === 'UNRESOLVED')).toEqual([]);
	});

	it('knows about every dependency group the manifest could declare', () => {
		const declared = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
		const known = new Set(DEPENDENCY_GROUPS.map((group) => group.key));
		const unknown = Object.keys(declared).filter((key) => key.endsWith('ependencies') && !known.has(key));
		expect(unknown).toEqual([]);
	});

	it('renders the published route from the generated inventory rather than hand-written rows', () => {
		const page = readFileSync(join(process.cwd(), 'src/routes/THIRD-PARTY-LICENSES/+page.svelte'), 'utf-8');
		expect(existsSync(join(process.cwd(), LICENSES_DATA))).toBe(true);
		expect(page).toContain("import inventory from '$lib/data/third-party-licenses.json'");
		// The defect this replaces: 30-odd hand-written <tr> rows that drifted
		// independently of the Markdown they claimed to summarise.
		expect(page).not.toMatch(/<td[^>]*>\s*\d+\.\d+\.\d+\s*<\/td>/);
	});
});
