<script lang="ts">
	import type { PageData } from './$types';
	import NoteArticle from '$lib/components/NoteArticle.svelte';

	let { data }: { data: PageData } = $props();
</script>

<!-- Keyed on the path so the article remounts on a note-to-note navigation. -->
{#key data.note.path}
	<NoteArticle note={data.note} newer={data.newer} older={data.older} />
{/key}
