<script lang="ts">
	import { onMount } from 'svelte';
	import { loadFlexSearch, searchFlexSearch, type SearchResult } from '$lib/search';

	let query = $state('');
	let results = $state.raw<SearchResult[]>([]);
	let activeIndex = $state(-1);
	let ready = $state(false);
	let showDropdown = $state(false);
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		loadFlexSearch().then((ok) => {
			ready = ok;
		});
		return () => clearTimeout(debounceTimer);
	});

	function doSearch() {
		if (!query.trim()) {
			results = [];
			showDropdown = false;
			return;
		}
		results = searchFlexSearch(query, 8);
		showDropdown = true;
		activeIndex = -1;
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(doSearch, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault();
			window.location.href = `/blog/${results[activeIndex].slug}`;
		} else if (e.key === 'Escape') {
			showDropdown = false;
			inputEl?.blur();
		}
	}

	function highlightMatch(text: string, q: string): string {
		if (!q.trim() || !text) return text ?? '';
		const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
	}
</script>

{#if ready}
	<div class="mb-8">
		<div class="relative">
			<input
				bind:this={inputEl}
				type="search"
				placeholder="Search posts..."
				bind:value={query}
				oninput={handleInput}
				onfocus={() => { if (results.length) showDropdown = true; }}
				onblur={() => setTimeout(() => { showDropdown = false; }, 200)}
				onkeydown={handleKeydown}
				role="combobox"
				aria-expanded={showDropdown}
				aria-autocomplete="list"
				aria-controls="search-results"
				class="w-full px-4 py-2 rounded-lg border border-surface-300-700 bg-surface-50-950 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
			/>
			{#if showDropdown && query && results.length > 0}
				<ul
					id="search-results"
					role="listbox"
					class="absolute z-10 top-full left-0 right-0 mt-1 glass rounded-lg shadow-lg max-h-80 overflow-y-auto"
				>
					{#each results as result, i}
						<li role="option" aria-selected={i === activeIndex}>
							<a
								href="/blog/{result.slug}"
								class="block px-4 py-3 hover:bg-surface-200-800 transition-colors border-b border-surface-200-800 last:border-0 {i === activeIndex ? 'bg-surface-200-800' : ''}"
							>
								<div class="font-medium text-sm">{@html highlightMatch(result.title, query)}</div>
								{#if result.description}
									<div class="text-xs text-surface-500 mt-1 line-clamp-2">
										{@html highlightMatch(result.description, query)}
									</div>
								{/if}
								{#if result.tags}
									<div class="text-xs text-surface-400 mt-1">{result.tags}</div>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{:else if showDropdown && query && results.length === 0}
				<div
					class="absolute z-10 top-full left-0 right-0 mt-1 glass rounded-lg shadow-lg px-4 py-3 text-sm text-surface-500"
				>
					No results found.
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="mb-8">
		<p class="text-xs text-surface-500 italic" data-testid="search-unavailable">Search loading...</p>
	</div>
{/if}
