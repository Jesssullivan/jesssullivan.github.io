<script lang="ts">
	import type { Post } from '$lib/types';
	import type { Snippet } from 'svelte';
	import { useTooltip, Tooltip, Portal } from '@skeletonlabs/skeleton-svelte';

	// Hover/focus preview card for a post link (TIN-2903 M1.3 presence work).
	// DOM-anchored floating surface → Skeleton Tooltip anatomy, per the two
	// ruled tooltip patterns in docs/in-house-reference.md (the canvas star
	// tooltip keeps direct @floating-ui/dom; DOM triggers use Skeleton). The
	// trigger element is supplied by the parent via the `trigger` snippet and
	// receives the zag trigger attributes, so the post link itself is the
	// trigger — keyboard focus opens the preview (zag handles Escape/blur).
	let {
		post,
		id,
		trigger,
	}: {
		post: Post;
		id: string;
		trigger: Snippet<[Record<string, unknown>]>;
	} = $props();

	const tooltip = useTooltip({
		id,
		openDelay: 280,
		closeDelay: 90,
		positioning: { placement: 'top-start' },
	});

	// Honest preview: no card when there is nothing beyond the visible title.
	const previewTags = $derived((post.tags ?? []).filter((t) => t.trim().length > 0).slice(0, 4));
	const hasPreview = $derived(Boolean(post.description) || previewTags.length > 0);
</script>

{#if hasPreview}
	<Tooltip.Provider value={tooltip}>
		<Tooltip.Trigger>
			{#snippet element(attributes)}
				{@render trigger(attributes)}
			{/snippet}
		</Tooltip.Trigger>
		<Portal>
			<Tooltip.Positioner class="z-50">
				<Tooltip.Content
					class="max-w-xs rounded-md border border-surface-300-700 bg-surface-50-950 p-3 shadow-xl space-y-2"
				>
					{#if post.description}
						<p class="text-sm text-surface-700-300 leading-snug preview-clamp">{post.description}</p>
					{/if}
					<p class="font-mono text-[0.65rem] uppercase tracking-wider text-surface-500 flex flex-wrap gap-x-2 gap-y-0.5">
						{#if post.category}<span>{post.category}</span>{/if}
						{#if post.reading_time}<span>{post.reading_time} min</span>{/if}
						{#each previewTags as tag (tag)}<span>#{tag}</span>{/each}
					</p>
				</Tooltip.Content>
			</Tooltip.Positioner>
		</Portal>
	</Tooltip.Provider>
{:else}
	{@render trigger({})}
{/if}

<style>
	.preview-clamp {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
