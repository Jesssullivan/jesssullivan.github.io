<script lang="ts">
	import type { Note } from '$lib/notes';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import ProfileSidebar from '$lib/components/ProfileSidebar.svelte';
	import TableOfContents from '$lib/components/TableOfContents.svelte';

	type Neighbor = { path: string; title: string } | null;

	let { note, newer, older }: { note: Note; newer: Neighbor; older: Neighbor } = $props();

	let documentRoot = $state<HTMLElement | null>(null);

	// The JSON-LD tag is built from split literals, as in BlogArticle, so the
	// Svelte compiler does not read the element in the markup.
	let jsonLdScript = $derived(
		'<' +
			'script type="application/ld+json">' +
			JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'BlogPosting',
				headline: note.title,
				datePublished: note.date,
				dateModified: note.updated ?? note.date,
				author: { '@type': 'Person', name: 'Jess Sullivan', url: 'https://github.com/Jesssullivan' },
				publisher: { '@type': 'Person', name: 'Jess Sullivan' },
				url: note.url,
				mainEntityOfPage: { '@type': 'WebPage', '@id': note.url },
				...(note.summary ? { description: note.summary } : {}),
				...(note.tags.length ? { keywords: note.tags.join(', ') } : {}),
			}).replace(/</g, '\\u003c') +
			'</' +
			'script>',
	);

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC',
		});
	}
</script>

<svelte:head>
	<title>{note.title} | transscendsurvival.org</title>
	{#if note.summary}
		<meta name="description" content={note.summary} />
		<meta property="og:description" content={note.summary} />
		<meta name="twitter:description" content={note.summary} />
	{/if}
	<meta property="og:title" content={note.title} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={note.url} />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta property="article:published_time" content={note.date} />
	<meta property="article:author" content="Jess Sullivan" />
	{#each note.tags as tag (tag)}
		<meta property="article:tag" content={tag} />
	{/each}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={note.title} />
	<link rel="canonical" href={note.url} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- self-constructed JSON-LD with < escaped -->
	{@html jsonLdScript}
</svelte:head>

<article class="container mx-auto px-4 py-12 max-w-5xl" data-testid="note-article">
	<div class="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
		<div class="min-w-0">
			<header class="mb-8">
				<Breadcrumbs
					crumbs={[
						{ label: 'Home', href: '/' },
						{ label: 'Notes', href: '/notes' },
						{ label: note.title, href: note.path },
					]}
				/>
				<h1 class="text-3xl font-bold mt-2">{note.title}</h1>
				<div class="flex items-center gap-3 mt-3 text-sm text-surface-500">
					<time datetime={note.date}>{formatDate(note.date)}</time>
					{#if note.updated}
						<span>&middot;</span>
						<span>Updated <time datetime={note.updated}>{formatDate(note.updated)}</time></span>
					{/if}
				</div>
				{#if note.tags.length}
					<ul class="flex flex-wrap gap-2 mt-3" aria-label="Tags">
						{#each note.tags as tag (tag)}
							<li class="badge preset-outlined-surface-500 text-xs">{tag}</li>
						{/each}
					</ul>
				{/if}
			</header>

			<div
				bind:this={documentRoot}
				class="prose prose-lg max-w-none overflow-x-hidden"
				data-document-root
				data-pagefind-body
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- the hub's rendered HTML, verified by the xoxd_projection module before the build (signature, sha256 and no script, handler or javascript: URL) -->
				{@html note.html}
			</div>

			{#if newer || older}
				<nav
					class="flex justify-between items-start mt-8 pt-6 border-t border-surface-300-700 gap-4"
					aria-label="More notes"
				>
					{#if older}
						<a href={older.path} class="text-sm text-primary-500 hover:underline max-w-[45%]">&larr; {older.title}</a>
					{:else}
						<span></span>
					{/if}
					{#if newer}
						<a href={newer.path} class="text-sm text-primary-500 hover:underline text-right max-w-[45%]"
							>{newer.title} &rarr;</a
						>
					{:else}
						<span></span>
					{/if}
				</nav>
			{/if}
		</div>

		<div class="hidden lg:block">
			<div class="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto space-y-6 sidebar-scroll glass p-4">
				<TableOfContents {documentRoot} />
				<hr class="border-surface-300-700" />
				<ProfileSidebar />
			</div>
		</div>
	</div>
</article>
