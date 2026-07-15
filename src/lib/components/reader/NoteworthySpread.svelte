<script lang="ts">
	import type { Post } from '$lib/types';
	import TierBadge from '$lib/components/TierBadge.svelte';

	// Register 01 — the noteworthy spread: one lead + a grid of secondaries.
	// Every entry here already carries an explicit `noteworthy` tier (the caller
	// passes only the noteworthy partition); TierBadge renders the tier verbatim.
	let { posts }: { posts: Post[] } = $props();

	const lead = $derived(posts[0]);
	const secondaries = $derived(posts.slice(1));

	function fmtDate(iso: string): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

{#if lead}
	<section aria-labelledby="reader-reg-01" class="space-y-5">
		<h2 id="reader-reg-01" class="reader-kicker">
			01 · Noteworthy <span class="reader-count">{posts.length} {posts.length === 1 ? 'entry' : 'entries'}</span>
		</h2>

		<article class="space-y-2">
			<TierBadge tier={lead.editorial_tier} />
			<h3 class="font-heading text-2xl sm:text-3xl font-bold leading-tight">
				<a href="/blog/{lead.slug}" class="hover:text-primary-500 transition-colors">{lead.title}</a>
			</h3>
			{#if lead.description}
				<p class="text-surface-700-300 max-w-prose">{lead.description}</p>
			{/if}
			<p class="reader-meta">
				{fmtDate(lead.date)}{#if lead.category}
					· <span class="text-primary-500">{lead.category}</span>{/if}
			</p>
		</article>

		{#if secondaries.length > 0}
			<div class="grid gap-5 sm:grid-cols-2">
				{#each secondaries as post (post.slug)}
					<article class="space-y-1">
						<TierBadge tier={post.editorial_tier} />
						<h4 class="font-heading text-lg font-semibold leading-snug">
							<a href="/blog/{post.slug}" class="hover:text-primary-500 transition-colors">{post.title}</a>
						</h4>
						{#if post.description}
							<p class="text-sm text-surface-700-300">{post.description}</p>
						{/if}
						<p class="reader-meta">
							{fmtDate(post.date)}{#if post.category}
								· <span class="text-primary-500">{post.category}</span>{/if}
						</p>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.reader-kicker {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	.reader-count {
		letter-spacing: 0;
		text-transform: none;
		opacity: 0.7;
		font-weight: 400;
	}
	.reader-meta {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		opacity: 0.7;
	}
</style>
