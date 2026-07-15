<script lang="ts">
	import type { PostEditorialTier } from '$lib/types';

	// Reader-weight badge for the editorial taxonomy (docs/blog-editorial-taxonomy-2026-07-03.md).
	// Tiers are IA/reader-weight ONLY — never an auth, privacy, or AP-delivery signal.
	// Renders nothing when the tier is undefined ("not classified yet").
	let { tier, class: klass = '' }: { tier?: PostEditorialTier | undefined; class?: string } = $props();

	const TIER_LABELS: Record<PostEditorialTier, string> = {
		noteworthy: 'Noteworthy',
		'less-noteworthy': 'Less noteworthy',
	};

	// noteworthy gets a stronger accent tint; less-noteworthy stays muted/outlined.
	const TIER_PRESETS: Record<PostEditorialTier, string> = {
		noteworthy: 'preset-tonal-primary',
		'less-noteworthy': 'preset-outlined-surface-500',
	};
</script>

{#if tier}
	<span
		class="badge {TIER_PRESETS[tier]} text-xs font-medium {klass}"
		data-tier={tier}
		data-testid="tier-badge"
		aria-label={`Editorial tier: ${TIER_LABELS[tier]}`}
		title={`Editorial tier: ${TIER_LABELS[tier]}`}
	>
		{#if tier === 'noteworthy'}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
				><path
					d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
				/></svg
			>
		{/if}
		{TIER_LABELS[tier]}
	</span>
{/if}
