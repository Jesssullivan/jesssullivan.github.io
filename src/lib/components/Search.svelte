<script lang="ts">
	import { onMount } from 'svelte';

	interface PagefindResult { data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string> }> }
	interface Pagefind { init: () => Promise<void>; search: (q: string) => Promise<{ results: PagefindResult[] }> }

	let query = $state('');
	let results = $state.raw<Array<{ url: string; title: string; excerpt: string }>>([]);
	let pagefind: Pagefind | null = null;
	let loaded = $state(false);

	onMount(async () => {
		try {
			const pagefindPath = `${window.location.origin}/pagefind/pagefind.js`;
			const pf: Pagefind = await import(/* @vite-ignore */ pagefindPath);
			await pf.init();
			pagefind = pf;
			loaded = true;
		} catch {
			// Pagefind not available (dev mode or first build)
		}
	});

	async function search() {
		if (!pagefind || !query.trim()) {
			results = [];
			return;
		}
		const res = await pagefind.search(query);
		const items = await Promise.all(res.results.slice(0, 10).map((r) => r.data()));
		results = items.map((item) => ({
			url: item.url,
			title: item.meta?.title || 'Untitled',
			excerpt: item.excerpt
		}));
	}
</script>

{#if loaded}
	<div class="mb-8">
		<div class="relative">
			<input
				type="search"
				placeholder="Search posts..."
				bind:value={query}
				oninput={search}
				class="w-full px-4 py-2 rounded-lg border border-surface-300-700 bg-surface-50-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
			/>
			{#if query && results.length > 0}
				<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-surface-100-900 border border-surface-300-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
					{#each results as result}
						<a href={result.url} class="block px-4 py-3 hover:bg-surface-200-800 transition-colors border-b border-surface-200-800 last:border-0">
							<div class="font-medium text-sm">{result.title}</div>
							<div class="text-xs text-surface-500 mt-1">{@html result.excerpt}</div>
						</a>
					{/each}
				</div>
			{:else if query && results.length === 0}
				<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-surface-100-900 border border-surface-300-700 rounded-lg shadow-lg px-4 py-3 text-sm text-surface-500">
					No results found.
				</div>
			{/if}
		</div>
	</div>
{/if}
