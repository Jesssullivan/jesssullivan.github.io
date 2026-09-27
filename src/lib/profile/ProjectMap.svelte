<script lang="ts">
	import { tick } from 'svelte';
	import type { ProfileV1 } from './schema';
	import { categoryStyle } from './theme';
	import { MAP_SIZE, directionalNeighbor, markerPath, neighbors, point, visibleProjects, type Project } from './map';
	let { profile, embedded = false }: { profile: ProfileV1; embedded?: boolean } = $props();
	let query = $state(''),
		category = $state(''),
		selectedId = $state(''),
		hoverId = $state(''),
		zoom = $state(1);
	let svg: SVGSVGElement | undefined = $state();
	const rows = $derived(visibleProjects(profile, query, category));
	const selected = $derived(rows.find((r) => r.id === selectedId) ?? rows[0]);
	const active = $derived(rows.find((r) => r.id === hoverId) ?? selected);
	const related = $derived(active ? neighbors(profile, active.id) : []);
	const relatedIds = $derived(new Set(related.map((r) => r.repo.id)));
	const byId = $derived(new Map(profile.repos.map((r) => [r.id, r])));
	const shownIds = $derived(new Set(rows.map((r) => r.id)));
	const categories = $derived(new Map(profile.categories.map((c) => [c.id, c.label])));
	const anchor = $derived(selected ? point(selected) : { x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
	const transform = $derived(`translate(${anchor.x} ${anchor.y}) scale(${zoom}) translate(${-anchor.x} ${-anchor.y})`);
	async function select(repo: Project, focus = false) {
		selectedId = repo.id;
		hoverId = '';
		if (focus) {
			await tick();
			svg?.querySelector<SVGGElement>(`[data-project="${repo.id}"]`)?.focus();
		}
	}
	function key(event: KeyboardEvent, repo: Project) {
		if (event.key.startsWith('Arrow')) {
			event.preventDefault();
			void select(directionalNeighbor(rows, repo, event.key), true);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void select(repo);
		} else if (event.key === 'Home') {
			event.preventDefault();
			if (rows[0]) void select(rows[0], true);
		} else if (event.key === 'End') {
			event.preventDefault();
			if (rows.at(-1)) void select(rows.at(-1)!, true);
		} else if (event.key === 'Escape') {
			hoverId = '';
			zoom = 1;
		}
	}
</script>

<section class="project-map profile-panel" id="project-map" aria-labelledby="map-heading">
	<div class="map-heading">
		<div>
			<h2 id="map-heading">Project similarity</h2>
			<p class="profile-muted">Related metadata, shared neighborhoods. Every mark is a public project.</p>
		</div>
		{#if embedded}<a href="/projects">Open the full explorer →</a>{/if}
	</div>
	<div class="map-controls">
		<label
			>Find a project or language<input
				type="search"
				bind:value={query}
				placeholder="Search descriptions or languages"
			/></label
		>
		<label
			>Category<select bind:value={category}
				><option value="">All categories</option>{#each profile.categories as item (item.id)}<option value={item.id}
						>{item.label}</option
					>{/each}</select
			></label
		>
	</div>
	<div class="map-layout">
		<div class="map-scene">
			<div class="map-tools">
				<p id="map-instructions">Select a mark, or use the project chooser. Arrow keys move between marks.</p>
				<div class="zoom-controls" aria-label="Map zoom">
					<button onclick={() => (zoom = Math.min(3, zoom + 0.5))} disabled={zoom >= 3} aria-label="Zoom in">+</button
					><button onclick={() => (zoom = Math.max(1, zoom - 0.5))} disabled={zoom <= 1} aria-label="Zoom out">−</button
					><button onclick={() => (zoom = 1)} disabled={zoom === 1}>Reset</button>
				</div>
			</div>
			<svg
				bind:this={svg}
				viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
				aria-labelledby="map-heading"
				aria-describedby="map-instructions map-caveat"
				class="map-svg"
			>
				<title>Public project metadata similarity</title>
				<desc
					>Equal-area category marks at the producer's fitted coordinates. Connections use the same metadata similarity
					as the embedding. A complete catalogue follows the map.</desc
				>
				<defs><clipPath id="profile-map-clip"><rect x="12" y="12" width="696" height="696" /></clipPath></defs>
				<g clip-path="url(#profile-map-clip)">
					<g {transform}>
						{#each profile.edges as edge (`${edge.a}:${edge.b}`)}
							{@const a = byId.get(edge.a)!}{@const b = byId.get(edge.b)!}{@const ap = point(a)}{@const bp = point(b)}
							{#if shownIds.has(edge.a) && shownIds.has(edge.b)}
								<line
									x1={ap.x}
									y1={ap.y}
									x2={bp.x}
									y2={bp.y}
									class:connected={active && (edge.a === active.id || edge.b === active.id)}
									class="map-edge"
									vector-effect="non-scaling-stroke"
								/>
							{/if}
						{/each}
						{#each rows as repo (repo.id)}
							{@const p = point(repo)}
							<g
								transform={`translate(${p.x} ${p.y})`}
								role="button"
								tabindex={repo.id === selected?.id ? 0 : -1}
								aria-label={`${repo.label}. ${categories.get(repo.category)}${repo.archived ? '. Archived' : ''}`}
								aria-pressed={repo.id === selected?.id}
								aria-controls="project-detail"
								data-project={repo.id}
								class="map-node"
								class:chosen={active?.id === repo.id}
								class:neighbor={relatedIds.has(repo.id)}
								style={categoryStyle(repo.category)}
								onclick={() => select(repo)}
								onkeydown={(e) => key(e, repo)}
								onpointerenter={() => (hoverId = repo.id)}
								onpointerleave={() => (hoverId = '')}
								onfocus={() => (selectedId = repo.id)}
							>
								<title>{repo.label}</title><circle r="18" fill="transparent" /><circle
									class="node-focus"
									r="13"
									fill="none"
								/><path class="category-mark" d={markerPath(repo.category, 6)} vector-effect="non-scaling-stroke" />
							</g>
						{/each}
					</g>
				</g>
				{#if !rows.length}<text x="360" y="360" text-anchor="middle" fill="var(--profile-ink)" font-size="22"
						>No matching projects</text
					>{/if}
			</svg>
			{#if active}<div class="mobile-selection">
					<span>{active.label}</span><a href="#project-detail">Read project details →</a>
				</div>{/if}
			<p class="profile-muted map-caveat" id="map-caveat">
				Nearby marks may share metadata. Axes and distances between distant groups have no substantive meaning. Size
				does not rank projects.
			</p>
			<div class="map-legend" aria-label="Project categories">
				{#each profile.categories as item (item.id)}<button
						class:active={category === item.id}
						aria-pressed={category === item.id}
						onclick={() => (category = category === item.id ? '' : item.id)}
						><svg viewBox="-12 -12 24 24" width="24" height="24" aria-hidden="true" style={categoryStyle(item.id)}
							><path class="category-mark" d={markerPath(item.id, 5)} /></svg
						>{item.label}</button
					>{/each}
			</div>
		</div>
		<aside id="project-detail" class="project-detail" aria-label="Selected project">
			<label class="project-chooser"
				>Choose a project<select
					value={selected?.id ?? ''}
					onchange={(event) => {
						const row = rows.find((r) => r.id === event.currentTarget.value);
						if (row) void select(row);
					}}
					><option value="" disabled>Select a project</option>{#each rows as repo (repo.id)}<option value={repo.id}
							>{repo.label}</option
						>{/each}</select
				></label
			>
			{#if active}
				<div aria-live="polite" aria-atomic="true" class="project-popover" data-testid="project-popover">
					<p class="detail-category">
						{categories.get(active.category)}{active.category_inferred ? ' · inferred category' : ''}
					</p>
					<h3>{active.label}</h3>
					<p class="profile-muted">
						Updated <time datetime={active.updated}>{active.updated}</time>{active.archived ? ' · archived' : ''}
					</p>
					{#if active.link}<a class="project-proof" href={active.link} target="_blank" rel="noopener noreferrer"
							>View public repository ↗</a
						>{:else}<p class="profile-muted">Shown without a repository link.</p>{/if}
					<h4>Current repository languages</h4>
					{#if Object.keys(active.langs).length}<ul class="language-shares">
							{#each Object.entries(active.langs).sort((a, b) => b[1] - a[1]) as [language, share] (language)}<li>
									<span>{language}</span><span>{share < 0.01 ? '<1' : Math.round(share * 100)}%</span>
								</li>{/each}
						</ul>{:else}<p class="profile-muted">No language breakdown available.</p>{/if}
					<p class="profile-muted detail-note">Snapshot code shares, not historical activity or proficiency.</p>
				</div>
				<h4>Metadata connections</h4>
				{#if related.length}<ul class="connections">
						{#each related as relation (relation.repo.id)}<li>
								<button
									onclick={() => {
										query = '';
										category = '';
										void select(relation.repo);
									}}
									><span>{relation.repo.label}</span><span class="similarity"
										>{relation.similarity.toFixed(2)}<span class="sr-only"> metadata similarity</span></span
									></button
								>
							</li>{/each}
					</ul>{:else}<p class="profile-muted">No qualifying connection in this snapshot.</p>{/if}
			{/if}
		</aside>
	</div>
	<details id="map-methods">
		<summary>How to read this map</summary>
		<div class="method-copy">
			<p>
				Coordinates are fitted by t-SNE from public descriptions, README terms, topics and languages. The shared
				similarity is 60% TF–IDF cosine similarity plus 40% Jaccard similarity over topics and language names. Category
				colors and shapes are display labels; they do not set the coordinates.
			</p>
			<p>
				Lines show the union of each project's three strongest qualifying connections, with similarity at least 0.15. A
				project can therefore have more than three lines. The values beside connections refer to metadata similarity on
				a 0–1 scale.
			</p>
			<p>
				The precomputed dissimilarity is 1 minus that similarity. The pinned numerical implementation squares that
				distance when fitting affinities. A new fit can change neighborhoods; the two-dimensional view is an
				approximation, not a hierarchy or a measure of expertise.
			</p>
			<p>
				Seed {profile.methods.embedding.seed}; perplexity {profile.methods.embedding.perplexity}; {profile.methods
					.embedding.iterations} iterations. {profile.methods.embedding.algorithm === 'degenerate'
					? 'This snapshot has insufficient relative evidence for a meaningful fit.'
					: ''}
			</p>
		</div>
	</details>
	<details id="project-catalogue">
		<summary>Accessible project catalogue</summary>
		<div class="table-scroll">
			<table>
				<caption>Public projects in the current filter; selecting a description opens its map details.</caption><thead
					><tr><th scope="col">Project</th><th scope="col">Category</th><th scope="col">Evidence</th></tr></thead
				><tbody
					>{#each rows as repo (repo.id)}<tr
							><td
								><button class="catalogue-label" onclick={() => select(repo, true)}>{repo.label}</button
								>{#if repo.archived}<span class="profile-muted"> · archived</span>{/if}</td
							><td>{categories.get(repo.category)}{repo.category_inferred ? ' (inferred)' : ''}</td><td
								>{#if repo.link}<a href={repo.link} target="_blank" rel="noopener noreferrer">Repository ↗</a
									>{:else}Unlinked{/if}</td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
	</details>
</section>

<style>
	.map-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	.map-heading h2 {
		font-size: clamp(1.4rem, 3vw, 1.9rem);
		margin: 0;
	}
	.map-heading p {
		margin: 0.6rem 0 1.25rem;
	}
	.map-heading > a {
		white-space: nowrap;
	}
	.map-controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.3rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.88rem;
		font-weight: 600;
	}
	input,
	select {
		width: 100%;
		font-weight: 400;
		min-width: 0;
	}
	.map-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(250px, 28%);
		gap: 1.5rem;
	}
	.map-scene {
		min-width: 0;
	}
	.map-tools {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
	}
	.map-tools p {
		max-width: 36ch;
		font-size: 0.85rem;
		margin: 0.4rem 0;
		color: var(--profile-muted);
	}
	.zoom-controls {
		display: flex;
		gap: 0.35rem;
	}
	.zoom-controls button {
		min-width: 44px;
		padding: 0.35rem 0.55rem;
	}
	.map-svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: hidden;
		touch-action: pan-y;
		background: var(--profile-bg);
	}
	.map-edge {
		stroke: var(--profile-outline);
		stroke-width: 0.8;
		opacity: 0.36;
	}
	.map-edge.connected {
		stroke: var(--profile-accent);
		stroke-width: 1.8;
		opacity: 1;
	}
	.map-node {
		cursor: pointer;
		outline: none;
	}
	.node-focus {
		stroke: transparent;
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.map-node.chosen .node-focus {
		stroke: var(--profile-accent);
	}
	.map-node:focus-visible .node-focus {
		stroke: var(--profile-ink);
		stroke-width: 3;
	}
	.map-node.neighbor .node-focus {
		stroke: var(--profile-outline);
		stroke-dasharray: 2 3;
	}
	.mobile-selection {
		display: none;
	}
	.map-caveat {
		font-size: 0.85rem;
		margin: 0 0 1rem;
	}
	.map-legend {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.map-legend button {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-align: left;
		border-color: var(--profile-rule);
		font-size: 0.82rem;
		padding: 0.35rem;
	}
	.map-legend button.active {
		border-color: var(--profile-outline);
	}
	.project-detail {
		border-inline-start: 1px solid var(--profile-rule);
		padding-inline-start: 1.4rem;
		min-width: 0;
	}
	.project-chooser {
		font-size: 0.85rem;
	}
	.project-chooser select {
		font-size: 0.85rem;
	}
	.detail-category {
		font: 500 0.8rem/1.5 var(--profile-font-mono);
		color: var(--profile-muted);
		margin: 1.4rem 0 0.75rem;
	}
	.project-detail h3 {
		font-size: 1.2rem;
		line-height: 1.4;
		overflow-wrap: anywhere;
		margin: 0.4rem 0 1rem;
	}
	.project-detail h4 {
		font: 600 0.9rem var(--profile-font-mono);
		margin: 1.5rem 0 0.6rem;
	}
	.project-detail p {
		font-size: 0.86rem;
	}
	.project-proof {
		display: inline-block;
		min-height: 44px;
		padding: 0.5rem 0;
	}
	.language-shares {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.8rem;
	}
	.language-shares li {
		display: flex;
		gap: 0.6rem;
		font-size: 0.8rem;
		border-bottom: 1px solid var(--profile-rule);
	}
	.detail-note {
		margin: 0.5rem 0;
	}
	.connections {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.connections button {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		font-size: 0.83rem;
		border-color: var(--profile-rule);
	}
	.similarity {
		font: 500 0.8rem var(--profile-font-mono);
		align-self: center;
	}
	.method-copy {
		max-width: 76ch;
	}
	.catalogue-label {
		text-align: left;
		border: 0 !important;
		background: transparent !important;
		padding: 0 !important;
		color: var(--profile-link) !important;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	caption {
		text-align: left;
		padding: 0.6rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@media (max-width: 860px) {
		.mobile-selection {
			display: grid;
			gap: 0.65rem;
			border-block: 1px solid var(--profile-rule);
			padding: 1rem 0;
			margin-bottom: 1rem;
			font-size: 0.95rem;
		}
		.map-layout {
			grid-template-columns: 1fr;
		}
		.project-detail {
			border-inline-start: 0;
			border-top: 1px solid var(--profile-rule);
			padding: 1rem 0 0;
		}
		.map-heading {
			display: block;
		}
		.map-controls {
			grid-template-columns: 1fr;
		}
		.map-legend {
			grid-template-columns: 1fr 1fr;
		}
		.project-detail h3 {
			font-size: 1.25rem;
		}
		.project-detail p,
		.language-shares li,
		.connections button,
		.project-chooser,
		.project-chooser select,
		.detail-category {
			font-size: 0.95rem;
		}
		.map-tools {
			flex-wrap: wrap;
		}
		.map-tools p {
			max-width: 100%;
		}
		.map-legend button {
			font-size: 0.9rem;
		}
		.map-caveat {
			font-size: 0.9rem;
		}
	}
</style>
