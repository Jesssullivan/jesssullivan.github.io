<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadPagefind,
		executeSearch,
		debounce,
		type Pagefind,
		type SearchItem
	} from '$lib/pagefind';

	let query = $state('');
	let results = $state.raw<SearchItem[]>([]);
	let pagefind: Pagefind | null = null;
	let loaded = $state(false);
	let errorMsg = $state('');

	const debouncedSearch = debounce(doSearch, 200);

	onMount(() => {
		loadPagefind().then((state) => {
			pagefind = state.instance;
			loaded = state.available;
			errorMsg = state.error;
		});
		return () => debouncedSearch.cancel();
	});

	async function doSearch() {
		if (!pagefind || !query.trim()) {
			results = [];
			return;
		}
		results = await executeSearch(pagefind, query, 10);
	}
</script>

{#if loaded}
	<div class="mb-8">
		<div class="relative">
			<input
				type="search"
				placeholder="Search posts..."
				bind:value={query}
				oninput={() => debouncedSearch.call()}
				class="w-full px-4 py-2 rounded-lg border border-surface-300-700 bg-surface-50-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
			/>
			{#if query && results.length > 0}
				<div
					class="absolute z-10 top-full left-0 right-0 mt-1 glass rounded-lg shadow-lg max-h-80 overflow-y-auto"
				>
					{#each results as result}
						<a
							href={result.url}
							class="block px-4 py-3 hover:bg-surface-200-800 transition-colors border-b border-surface-200-800 last:border-0"
						>
							<div class="font-medium text-sm">{result.title}</div>
							<!-- pagefind excerpts contain only <mark> tags for highlighting -->
							<div class="text-xs text-surface-500 mt-1">{@html result.excerpt}</div>
						</a>
					{/each}
				</div>
			{:else if query && results.length === 0}
				<div
					class="absolute z-10 top-full left-0 right-0 mt-1 glass rounded-lg shadow-lg px-4 py-3 text-sm text-surface-500"
				>
					No results found.
				</div>
			{/if}
		</div>
	</div>
{:else if errorMsg}
	<div class="mb-8">
		<p class="text-xs text-surface-500 italic" data-testid="search-unavailable">{errorMsg}</p>
	</div>
{/if}
