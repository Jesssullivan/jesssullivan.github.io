<script lang="ts">
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
			label: 'Tech / FOSS',
			badges: [
				{ label: 'Chapel', color: 'preset-outlined-surface-500', url: 'https://chapel-lang.org/' },
				{ label: 'Rocky Linux', color: 'preset-outlined-surface-500', url: 'https://rockylinux.org/' },
				{ label: 'Apache Solr', color: 'preset-outlined-surface-500', url: 'https://solr.apache.org/' },
				{ label: 'Skeleton UI', color: 'preset-outlined-surface-500', url: 'https://skeleton.dev/' },
				{ label: 'SearXNG', color: 'preset-outlined-surface-500', url: 'https://github.com/searxng/searxng' },
				{ label: 'KeePassXC', color: 'preset-outlined-surface-500', url: 'https://keepassxc.org/' },
				{ label: 'Futhark', color: 'preset-outlined-surface-500', url: 'https://futhark-lang.org/' },
				{ label: 'xCaddy', color: 'preset-outlined-surface-500', url: 'https://github.com/caddyserver/xcaddy' },
				{ label: 'qutebrowser', color: 'preset-outlined-surface-500', url: 'https://github.com/qutebrowser/qutebrowser' },
				{ label: 'pytest', color: 'preset-outlined-surface-500', url: 'https://github.com/pytest-dev/pytest' },
				{ label: 'Klipper', color: 'preset-outlined-surface-500', url: 'https://github.com/Klipper3d/klipper' },
				{ label: 'Budgie Desktop', color: 'preset-outlined-surface-500', url: 'https://buddiesofbudgie.org/' },
				{ label: 'Tails', color: 'preset-outlined-surface-500', url: 'https://tails.net/' },
			]
		},
		{
			label: 'Sponsoring',
			badges: [
				{ label: 'The-Compiler', color: 'preset-outlined-primary-500', url: 'https://github.com/The-Compiler' },
				{ label: 'Xe Iaso', color: 'preset-outlined-primary-500', url: 'https://github.com/Xe' },
				{ label: 'Skeleton Labs', color: 'preset-outlined-primary-500', url: 'https://github.com/skeletonlabs' },
				{ label: 'purpl3F0x', color: 'preset-outlined-primary-500', url: 'https://github.com/purpl3F0x' },
				{ label: 'EFF', color: 'preset-outlined-primary-500', url: 'https://www.eff.org/' },
				{ label: 'Erin in the Morning', color: 'preset-outlined-primary-500', url: 'https://www.erininthemorning.com/' },
				{ label: 'The Onion', color: 'preset-outlined-primary-500', url: 'https://theonion.com/' },
			]
		},
		{
			label: 'Ventures',
			badges: [
				{ label: 'xoxd.ai', color: 'preset-outlined-primary-500', url: 'https://xoxd.ai' },
				{ label: 'tinyland.dev', color: 'preset-outlined-primary-500', url: 'https://tinyland.dev' },
			]
		},
	];
</script>

<div class="tag-cloud">
	{#each categories as cat}
		{#if !compact}
			<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-400 mt-3 mb-1.5 first:mt-0">
				{cat.label}
			</h4>
		{/if}
		<div class="flex flex-wrap gap-1.5 {compact ? 'mb-2' : 'mb-1'}">
			{#each cat.badges as badge}
				{#if badge.url}
					<a
						href={badge.url}
						target="_blank"
						rel="noopener"
						class="badge {badge.color} text-xs hover:preset-filled-primary-500 transition-colors"
					>{badge.label}</a>
				{:else}
					<span class="badge {badge.color} text-xs">{badge.label}</span>
				{/if}
			{/each}
		</div>
	{/each}
</div>
