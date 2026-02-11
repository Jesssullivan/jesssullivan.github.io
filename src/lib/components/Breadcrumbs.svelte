<script lang="ts">
	interface Crumb {
		label: string;
		href: string;
	}

	let { crumbs }: { crumbs: Crumb[] } = $props();
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		"itemListElement": crumbs.map((c, i) => ({
			"@type": "ListItem",
			"position": i + 1,
			"name": c.label,
			"item": c.href.startsWith('/') ? `https://transscendsurvival.org${c.href}` : c.href
		}))
	})}</script>`}
</svelte:head>

<nav aria-label="Breadcrumb" class="text-sm text-surface-500 mb-4">
	<ol class="flex items-center gap-1 flex-wrap">
		{#each crumbs as crumb, i}
			{#if i > 0}
				<li aria-hidden="true" class="text-surface-400">/</li>
			{/if}
			{#if i === crumbs.length - 1}
				<li class="text-surface-300 truncate max-w-[300px]" aria-current="page">{crumb.label}</li>
			{:else}
				<li><a href={crumb.href} class="text-primary-500 hover:underline">{crumb.label}</a></li>
			{/if}
		{/each}
	</ol>
</nav>
