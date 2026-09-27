<script lang="ts">
	// Shared approved facts import; Vite public assets require the ?raw loader.
	// static/profile is synced from spear_resumes; never hand-edit its data.
	import { profile } from '$lib/data/profile';
	const merged_upstream = profile.merged_upstream;

	interface TagBadge {
		label: string;
		color: string;
		url?: string;
	}

	interface TagCategory {
		label: string;
		badges: TagBadge[];
	}

	let { compact = false }: { compact?: boolean } = $props();

	const categories: TagCategory[] = [
		{
			// R69: merged upstream work from the profile facts (spear_resumes
			// facts.json merged_upstream), one chip per project, in facts order,
			// each linking its merged PR. No hand-written project list here.
			label: 'Merged upstream',
			badges: merged_upstream.map((u) => ({
				label: u.project,
				color: 'preset-outlined-surface-500',
				url: u.url,
			})),
		},
		{
			label: 'Sponsoring',
			badges: [
				{ label: 'The-Compiler', color: 'preset-outlined-primary-500', url: 'https://github.com/The-Compiler' },
				{ label: 'Xe Iaso', color: 'preset-outlined-primary-500', url: 'https://github.com/Xe' },
				{ label: 'Skeleton Labs', color: 'preset-outlined-primary-500', url: 'https://github.com/skeletonlabs' },
				{ label: 'purpl3F0x', color: 'preset-outlined-primary-500', url: 'https://github.com/purpl3F0x' },
				{ label: 'EFF', color: 'preset-outlined-primary-500', url: 'https://www.eff.org/' },
				{
					label: 'Erin in the Morning',
					color: 'preset-outlined-primary-500',
					url: 'https://www.erininthemorning.com/',
				},
				{ label: 'The Onion', color: 'preset-outlined-primary-500', url: 'https://theonion.com/' },
			],
		},
		{
			label: 'Ventures',
			badges: [{ label: 'xoxd.ai', color: 'preset-outlined-primary-500', url: 'https://xoxd.ai' }],
		},
	];
</script>

<div class="tag-cloud">
	{#each categories as cat (cat.label)}
		{#if !compact}
			<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-400 mt-3 mb-1.5 first:mt-0">
				{cat.label}
			</h4>
		{/if}
		<div class="flex flex-wrap gap-1.5 {compact ? 'mb-2' : 'mb-1'}">
			{#each cat.badges as badge (badge.label)}
				{#if badge.url}
					<a
						href={badge.url}
						target="_blank"
						rel="noopener"
						aria-label={`Visit ${badge.label}`}
						class="badge {badge.color} text-xs hover:preset-filled-primary-500 transition-colors">{badge.label}</a
					>
				{:else}
					<span class="badge {badge.color} text-xs">{badge.label}</span>
				{/if}
			{/each}
		</div>
	{/each}
</div>
