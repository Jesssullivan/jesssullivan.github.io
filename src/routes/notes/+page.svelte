<script lang="ts">
	import type { PageData } from './$types';
	import NoteBody from '$lib/components/NoteBody.svelte';
	import ProfileSidebar from '$lib/components/ProfileSidebar.svelte';
	import { NOTES_PER_PAGE } from '$lib/notes';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	// The same paging as the /blog list: the prerendered page is page 1 and
	// ?page=N picks a later page in the browser.
	let totalPages = $derived(Math.ceil(data.notes.length / NOTES_PER_PAGE));
	let pageParam = $derived(browser ? parseInt($page.url.searchParams.get('page') || '1') : 1);
	let currentPage = $derived(Math.max(0, Math.min(pageParam - 1, totalPages - 1)));
	let pageNotes = $derived(data.notes.slice(currentPage * NOTES_PER_PAGE, (currentPage + 1) * NOTES_PER_PAGE));

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC',
		});
	}
</script>

<svelte:head>
	<title>Notes | transscendsurvival.org</title>
	<meta name="description" content="Notes by Jess Sullivan." />
	<meta property="og:title" content="Notes | transscendsurvival.org" />
	<meta property="og:description" content="Notes by Jess Sullivan." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/notes" />
	<meta name="twitter:card" content="summary" />
	<link rel="canonical" href="https://transscendsurvival.org/notes" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-5xl">
	<div class="flex flex-wrap items-baseline justify-between gap-3 mb-8">
		<h1 class="font-heading text-3xl font-bold">Notes</h1>
		<p class="text-sm text-surface-500">{data.notes.length} {data.notes.length === 1 ? 'note' : 'notes'}</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
		<div class="min-w-0">
			<!-- Each note is shown whole, in the type and spacing of a post, with no card around it. -->
			<ol class="space-y-14" data-testid="notes-list">
				{#each pageNotes as note (note.path)}
					<li>
						<article class="min-w-0" data-testid="notes-list-item">
							<header class="mb-4">
								<time class="text-sm text-surface-500" datetime={note.date}>{formatDate(note.date)}</time>
								<h2 class="text-2xl font-semibold mt-1">
									<a href={note.path} class="hover:text-primary-500 transition-colors">{note.title}</a>
								</h2>
							</header>
							<NoteBody cover={note.cover} html={note.html} />
							{#if note.tags.length}
								<ul class="flex flex-wrap gap-2 mt-3" aria-label="Tags">
									{#each note.tags as tag (tag)}
										<li class="badge preset-outlined-surface-500 text-xs">{tag}</li>
									{/each}
								</ul>
							{/if}
						</article>
					</li>
				{/each}
			</ol>

			{#if totalPages > 1}
				<nav class="flex items-center justify-center gap-2 mt-8" aria-label="Pages">
					{#if currentPage > 0}
						<a href="/notes?page={currentPage}" class="btn btn-sm preset-outlined-surface-500">&larr; Newer</a>
					{:else}
						<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">&larr; Newer</span>
					{/if}
					<span class="text-sm text-surface-500">Page {currentPage + 1} of {totalPages}</span>
					{#if currentPage < totalPages - 1}
						<a href="/notes?page={currentPage + 2}" class="btn btn-sm preset-outlined-surface-500">Older &rarr;</a>
					{:else}
						<span class="btn btn-sm preset-outlined-surface-500 opacity-50 pointer-events-none">Older &rarr;</span>
					{/if}
				</nav>
			{/if}
		</div>

		<div class="hidden lg:block">
			<div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto space-y-8 sidebar-scroll glass p-4">
				<ProfileSidebar />
			</div>
		</div>
	</div>
</div>
