<script lang="ts">
	import type { Post } from '$lib/posts';
	import type { PublicPulseSnapshotAny } from '$lib/pulse/snapshot';

	let { posts, snapshot }: { posts: Post[]; snapshot: PublicPulseSnapshotAny } = $props();

	const nodes = $derived([
		...posts.slice(0, 4).map((post) => ({
			id: `post-${post.slug}`,
			kind: 'Post',
			date: post.date,
			title: post.title,
			href: `/blog/${post.slug}`,
		})),
		...snapshot.items.slice(0, 2).map((item) => ({
			id: `pulse-${item.id}`,
			kind: item.kind === 'bird_sighting' ? 'Bird sighting' : 'Pulse note',
			date: item.occurredAt,
			title: item.summary || (item.kind === 'bird_sighting' ? item.birdSighting?.commonName : item.content) || 'Pulse',
			href: '/pulse',
		})),
	]);
</script>

<section class="constellation" aria-labelledby="constellation-heading">
	<div class="constellation-heading">
		<div>
			<p class="eyebrow">A map of what’s public</p>
			<h2 id="constellation-heading" class="font-heading text-2xl font-bold">The constellation</h2>
			<p class="intro">Follow a thread into the full post, or keep scrolling through the reader.</p>
		</div>
		<div class="controls">
			<input id="constellation-pause" class="motion-toggle" type="checkbox" />
			<label for="constellation-pause">Pause motion</label>
			<a href="#latest">Browse as a list ↓</a>
		</div>
	</div>

	{#if nodes.length > 0}
		<ol class="constellation-field" aria-label="Recent public writing and notes">
			{#each nodes as node (node.id)}
				<li class="constellation-node">
					<a href={node.href} aria-label={`${node.kind}: ${node.title}`}>
						<span class="node-marker" aria-hidden="true"></span>
						<span class="node-copy">
							<span class="node-meta">{node.kind} · <time datetime={node.date}>{node.date.slice(0, 10)}</time></span>
							<strong>{node.title}</strong>
						</span>
					</a>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No public writing or notes yet. The list below will appear when there is something to read.</p>
	{/if}
</section>

<style>
	.constellation { margin-bottom: 4rem; }
	.constellation-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
	.eyebrow, .node-meta { font-family: 'Inter', sans-serif; font-size: .7rem; font-weight: 600; letter-spacing: .11em; text-transform: uppercase; }
	.eyebrow { color: var(--color-primary-500); margin-bottom: .45rem; }
	.intro { margin-top: .35rem; opacity: .75; }
	.controls { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1rem; font-family: 'Inter', sans-serif; font-size: .78rem; }
	.controls a { text-decoration: underline; text-underline-offset: .2em; }
	.motion-toggle { width: 1rem; height: 1rem; accent-color: var(--color-primary-500); }
	.motion-toggle:focus-visible, .controls a:focus-visible, .constellation-node a:focus-visible { outline: 3px solid var(--color-primary-500); outline-offset: 3px; }
	.motion-toggle + label { cursor: pointer; margin-left: -.7rem; }
	.constellation-field { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; padding: 1.25rem; border: 1px solid currentColor; background: color-mix(in srgb, currentColor 3%, transparent); isolation: isolate; }
	.constellation-field::before { content: ''; position: absolute; inset: 1.8rem; border: 1px dashed currentColor; opacity: .2; transform: skewY(-8deg); pointer-events: none; z-index: -1; }
	.constellation-node { min-width: 0; animation: float 6s ease-in-out infinite alternate; }
	.constellation-node:nth-child(even) { animation-delay: -3s; }
	.constellation-node a { display: flex; align-items: flex-start; gap: .8rem; min-height: 6.5rem; padding: 1rem; border: 1px solid currentColor; background: var(--color-surface-50); text-decoration: none; transition: border-color .15s ease, transform .15s ease; }
	:global([data-mode='dark']) .constellation-node a { background: var(--color-surface-950); }
	.constellation-node a:hover { transform: translateY(-2px); border-color: var(--color-primary-500); }
	.node-marker { flex: none; width: .65rem; height: .65rem; margin-top: .25rem; border: 2px solid var(--color-primary-500); border-radius: 50%; box-shadow: 0 0 0 .24rem color-mix(in srgb, var(--color-primary-500) 18%, transparent); }
	.node-copy { display: grid; gap: .4rem; min-width: 0; }
	.node-meta { opacity: .7; }
	.node-copy strong { font-family: 'Inter', sans-serif; font-size: .95rem; line-height: 1.3; }
	.empty { padding: 1.5rem; border: 1px solid currentColor; }
	.constellation:has(.motion-toggle:checked) .constellation-node,
	.constellation:has(.constellation-field:hover) .constellation-node,
	.constellation:has(.constellation-field:focus-within) .constellation-node { animation-play-state: paused; }
	@keyframes float { from { translate: 0 0; } to { translate: 0 -.25rem; } }
	@media (min-width: 850px) {
		.constellation-field { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1rem; min-height: 20rem; }
		.constellation-node { grid-column: span 2; }
		.constellation-node:nth-child(4n + 2) { grid-column: 4 / span 2; }
		.constellation-node:nth-child(4n + 3) { grid-column: 2 / span 2; }
	}
	@media (max-width: 600px) {
		.constellation-field { display: block; padding: .75rem; }
		.constellation-field::before { display: none; }
		.constellation-node + .constellation-node { margin-top: .7rem; }
		.constellation-node { animation: none; }
		.constellation-node a { min-height: 4.5rem; }
		.motion-toggle, .motion-toggle + label { display: none; }
	}
	@media (prefers-reduced-motion: reduce) {
		.constellation-node { animation: none; }
		.constellation-node a { transition: none; }
	}
</style>
