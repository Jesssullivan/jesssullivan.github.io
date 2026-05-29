<script lang="ts">
	import type { PageData } from './$types';
	import BlogArticle from '$lib/components/BlogArticle.svelte';

	let { data }: { data: PageData } = $props();
</script>

<!--
	SvelteKit reuses this route component across /blog/[slug] param navigations,
	so onMount in the article never re-runs on prev/next. Keying the child on the
	slug remounts the whole article per post — broker fetch, copy buttons, heading
	anchors, and the table of contents all re-run for the new post.
-->
{#key data.brokerSlug}
	<BlogArticle {data} />
{/key}
