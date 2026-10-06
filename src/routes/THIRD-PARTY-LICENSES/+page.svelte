<script lang="ts">
	// TIN-161: this page used to be a hand-written duplicate of
	// THIRD-PARTY-LICENSES.md and had drifted years of versions — it published
	// mermaid as a runtime dependency long after it stopped being one, and an
	// "All 243 production packages" summary that understated Apache-2.0 by two
	// orders of magnitude. It is now rendered from the same generated inventory
	// as the Markdown, so the two cannot disagree. Regenerate both with
	// `node scripts/truth-surfaces.mjs --write`; `scripts/truth-surfaces.mjs`
	// fails if either is out of date with package-lock.json.
	import inventory from '$lib/data/third-party-licenses.json';

	const npmUrl = (name: string) => `https://www.npmjs.com/package/${name}`;
	const sourceLabel = (url: unknown): string | null =>
		typeof url === 'string' ? (url.replace(/^https?:\/\//, '').split('/')[0] ?? null) : null;
</script>

<svelte:head>
	<title>Third-Party Licenses | transscendsurvival.org</title>
	<meta name="description" content="Open-source license attributions for transscendsurvival.org" />
	<meta name="robots" content="noindex" />
	<link rel="canonical" href="https://transscendsurvival.org/THIRD-PARTY-LICENSES" />
</svelte:head>

<article class="container mx-auto max-w-3xl px-4 py-12">
	<h1 class="text-3xl font-bold mb-6">Third-Party Licenses</h1>

	<p class="mb-4 text-surface-600 dark:text-surface-400">
		This site is dedicated to the
		<a
			href="https://creativecommons.org/publicdomain/zero/1.0/"
			class="text-primary-500 hover:underline"
			target="_blank"
			rel="noopener">public domain (CC0 1.0)</a
		>. It is built with the following open-source software.
	</p>

	<p class="mb-4 text-sm text-surface-600 dark:text-surface-400">
		Every row below is derived from <code>{inventory.source}</code> — the declared range from
		<code>package.json</code>, the resolved version, the license string and the source URL from the lockfile entry for
		that exact resolution. Nothing on this page is hand-entered. A package whose lockfile entry declares no license
		reads <strong>UNDECLARED</strong> and is never guessed.
	</p>

	{#each inventory.groups as group (group.key)}
		<h2 class="text-xl font-semibold mt-8 mb-4">{group.heading}</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm border-collapse">
				<thead>
					<tr class="border-b border-surface-300-700 text-left">
						<th class="py-2 pr-4">Package</th>
						<th class="py-2 pr-4">Declared</th>
						<th class="py-2 pr-4">Resolved</th>
						<th class="py-2 pr-4">License</th>
						<th class="py-2 pr-4">Source</th>
					</tr>
				</thead>
				<tbody>
					{#each group.rows as row (row.name)}
						<tr class="border-b border-surface-200-800">
							<td class="py-2 pr-4">
								<a href={npmUrl(row.name)} class="text-primary-500 hover:underline" rel="noopener">{row.name}</a>
							</td>
							<td class="py-2 pr-4"><code>{row.specifier}</code></td>
							<td class="py-2 pr-4">{row.version}</td>
							<td class="py-2 pr-4">{row.license}</td>
							<td class="py-2 pr-4">
								{#if sourceLabel(row.resolved)}
									<a href={row.resolved} class="text-primary-500 hover:underline" rel="noopener"
										>{sourceLabel(row.resolved)}</a
									>
								{:else}
									&mdash;
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}

	<h2 class="text-xl font-semibold mt-8 mb-4">Resolved Tree</h2>
	<p class="mb-4 text-sm text-surface-600 dark:text-surface-400">
		The lockfile records {inventory.tree.installCount} installs under <code>node_modules/</code>. That counts install
		paths, not packages — npm records a package once per place it lands. Deduplicated on <code>name@version</code>,
		the tree is <strong>{inventory.tree.packageCount}</strong> distinct third-party packages, of which
		<strong>{inventory.tree.runtimePackageCount}</strong> are reachable outside
		<code>devDependencies</code>.
	</p>

	<h3 class="text-lg font-semibold mt-6 mb-3">Runtime packages</h3>
	<p class="mb-3 text-sm text-surface-600 dark:text-surface-400">
		This is the set that governs attribution: the site is a prerendered static build, so only these licenses travel to
		a reader.
	</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm border-collapse">
			<thead>
				<tr class="border-b border-surface-300-700 text-left">
					<th class="py-2 pr-4">License</th>
					<th class="py-2 pr-4">Packages</th>
				</tr>
			</thead>
			<tbody>
				{#each inventory.tree.runtimeLicenseHistogram as [license, count] (license)}
					<tr class="border-b border-surface-200-800">
						<td class="py-2 pr-4">{license}</td>
						<td class="py-2 pr-4">{count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h3 class="text-lg font-semibold mt-6 mb-3">Full resolved tree</h3>
	<p class="mb-3 text-sm text-surface-600 dark:text-surface-400">
		Development-only packages included. Licenses appearing here but not above are build-time only and are not
		distributed.
	</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm border-collapse">
			<thead>
				<tr class="border-b border-surface-300-700 text-left">
					<th class="py-2 pr-4">License</th>
					<th class="py-2 pr-4">Packages</th>
				</tr>
			</thead>
			<tbody>
				{#each inventory.tree.licenseHistogram as [license, count] (license)}
					<tr class="border-b border-surface-200-800">
						<td class="py-2 pr-4">{license}</td>
						<td class="py-2 pr-4">{count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2 class="text-xl font-semibold mt-8 mb-4">Undeclared licenses</h2>
	{#if inventory.tree.undeclared.length === 0}
		<p class="text-sm text-surface-600 dark:text-surface-400">
			Every resolved third-party package declares a license.
		</p>
	{:else}
		<p class="text-sm text-surface-600 dark:text-surface-400">
			{inventory.tree.undeclared.length} resolved third-party package(s) declare no license field in the lockfile. Each
			is an unreviewed license and a follow-up, not a silent MIT.
		</p>
		<ul class="mt-2 text-sm list-disc list-inside text-surface-600 dark:text-surface-400">
			{#each inventory.tree.undeclared as name (name)}
				<li><code>{name}</code></li>
			{/each}
		</ul>
	{/if}

	{#if inventory.tree.workspacePackages.length > 0}
		<p class="mt-4 text-sm text-surface-600 dark:text-surface-400">
			The lockfile also carries {inventory.tree.workspacePackages.length} workspace link(s) —
			{inventory.tree.workspacePackages.join(', ')} — which are this repository's own code under its CC0 dedication.
			They are not third party and are excluded from every figure above.
		</p>
	{/if}

	<p class="mt-8 text-xs text-surface-400">
		This page and
		<a
			href="https://github.com/Jesssullivan/jesssullivan.github.io/blob/main/THIRD-PARTY-LICENSES.md"
			class="text-primary-500 hover:underline"
			target="_blank"
			rel="noopener">THIRD-PARTY-LICENSES.md</a
		>
		are generated from the same inventory by <code>scripts/truth-surfaces.mjs</code>, which fails if either drifts from
		<code>{inventory.source}</code>.
	</p>
</article>
