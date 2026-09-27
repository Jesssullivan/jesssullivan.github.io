<script lang="ts">
	import { onMount } from 'svelte';
	import { profileFallback } from './fallback';
	import { loadLiveProfile } from './load';
	import { upstreamHistory } from './history';
	import ProjectMap from './ProjectMap.svelte';
	import ProfileHistory from './ProfileHistory.svelte';
	import './profile.css';
	let { embedded = false }: { embedded?: boolean } = $props();
	let profile = $state(profileFallback),
		source = $state<'saved' | 'live'>('saved'),
		checking = $state(false),
		unavailable = $state(false);
	let controller: AbortController | undefined;
	const upstream = $derived(upstreamHistory(profile.merged_upstream).points);
	const fetched = $derived(
		new Date(profile.fetched_at).toLocaleString('en-US', {
			timeZone: 'UTC',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		}) + ' UTC',
	);
	async function refresh() {
		if (checking) return;
		controller = new AbortController();
		checking = true;
		try {
			const candidate = await loadLiveProfile(fetch, { signal: controller.signal });
			if (Date.parse(candidate.fetched_at) < Date.parse(profile.fetched_at)) throw new Error('Older snapshot');
			profile = candidate;
			source = 'live';
			unavailable = false;
		} catch {
			unavailable = true;
		} finally {
			checking = false;
		}
	}
	onMount(() => {
		void refresh();
		const interval = setInterval(
			() => {
				if (document.visibilityState === 'visible') void refresh();
			},
			60 * 60 * 1000,
		);
		return () => {
			clearInterval(interval);
			controller?.abort();
		};
	});
</script>

<div class="profile-surface explorer" data-profile-source={source}>
	<div class="snapshot-status" role="status">
		<p>
			<span class="source-label">{source === 'live' ? 'Live endpoint' : 'Saved snapshot'}</span> · public evidence
			checked <time datetime={profile.fetched_at}>{fetched}</time>{#if unavailable}<span class="status-note"
					>Live refresh unavailable; this validated snapshot remains visible.</span
				>{/if}
		</p>
		<button onclick={refresh} disabled={checking}>{checking ? 'Checking…' : 'Refresh evidence'}</button>
	</div>
	<ProjectMap {profile} {embedded} />
	{#if embedded}
		<nav class="evidence-links" aria-label="Explore profile evidence">
			<a href="/projects#language-history">Observed language history →</a><a href="/projects#activity"
				>Public activity rhythm →</a
			>
		</nav>
		<section id="upstream" class="profile-panel">
			<h2>Merged upstream work</h2>
			<p class="profile-muted">Latest verified merge by project. Dates show recency, not contribution depth.</p>
			<ul class="embedded-upstream" data-testid="upstream-list">
				{#each upstream as item (item.repo)}<li>
						<a href={item.url} target="_blank" rel="noopener noreferrer">{item.project}</a><span class="profile-muted">
							· {item.relation} · <time datetime={item.merged}>{item.merged}</time></span
						>
					</li>{/each}
			</ul>
			<a href="/projects#upstream">Explore the merge timeline and evidence →</a>
		</section>
	{:else}
		<ProfileHistory {profile} />
	{/if}
	<details class="provenance">
		<summary>Snapshot provenance and coverage</summary>
		<p>
			Public repositories: {profile.coverage.repos}. Upstream merges: {profile.coverage.upstream}. Language history: {profile
				.coverage.languages}. Activity: {profile.coverage.activity}.
		</p>
		<p>
			Missing data is unavailable, not zero. Public activity excludes private work and is not a measure of effort,
			seniority or availability.
		</p>
		{#if profile.coverage_details?.length}<ul>
				{#each profile.coverage_details as detail, index (`${detail.scope}:${detail.from ?? ''}:${index}`)}<li>
						{detail.scope}{detail.from ? ` (${detail.from}${detail.to ? ' to ' + detail.to : ''})` : ''}: {detail.reason}
					</li>{/each}
			</ul>{/if}
		<p>
			Generated <time datetime={profile.generated_at}>{profile.generated_at}</time>. Source revision
			<code>{profile.source_commit}</code>.
		</p>
		<a href="/profile/profile.v1.json" download>Download the validated saved snapshot</a>
		<p class="profile-muted">The download is the site's saved fallback; a successfully refreshed view may be newer.</p>
	</details>
</div>

<style>
	.explorer {
		min-width: 0;
	}
	.snapshot-status {
		display: flex;
		align-items: start;
		gap: 1rem;
		justify-content: space-between;
		padding-block: 1rem;
		border-block: 1px solid var(--profile-rule);
		font-size: 0.88rem;
	}
	.snapshot-status p {
		margin: 0;
	}
	.snapshot-status button {
		white-space: nowrap;
		font-size: 0.85rem;
	}
	.source-label {
		font-weight: 600;
		color: var(--profile-heading);
	}
	.status-note {
		display: block;
		color: var(--profile-muted);
		margin-top: 0.4rem;
	}
	.evidence-links {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.embedded-upstream {
		columns: 2;
		list-style: none;
		padding: 0;
		margin: 1rem 0 1.5rem;
	}
	.embedded-upstream li {
		break-inside: avoid;
		margin-bottom: 0.75rem;
	}
	.embedded-upstream span {
		font-size: 0.85rem;
		display: block;
	}
	.provenance {
		font-size: 0.9rem;
		max-width: 78ch;
	}
	.provenance code {
		overflow-wrap: anywhere;
	}
	.provenance ul {
		max-height: 18rem;
		overflow: auto;
		padding-left: 1.25rem;
	}
	@media (max-width: 600px) {
		.snapshot-status {
			flex-direction: column;
		}
		.snapshot-status p {
			font-size: 0.95rem;
		}
		.embedded-upstream {
			columns: 1;
		}
	}
</style>
