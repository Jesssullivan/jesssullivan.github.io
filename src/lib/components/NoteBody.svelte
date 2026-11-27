<script lang="ts">
	import type { NoteCover } from '$lib/notes';
	import { wireNoteMedia } from '$lib/note-media';

	// The body of one note: its cover, then the HTML the hub rendered. The
	// note page and the notes list both show it, so a block looks the same in
	// both. The styles are in app.css under .note-body.
	let { cover, html }: { cover: NoteCover | null; html: string } = $props();

	// Starts the clips and wires the video posters once the body is in the
	// page, and again when the HTML changes.
	function media(node: HTMLElement, _html: string) {
		let undo = wireNoteMedia(node);
		return {
			update() {
				undo();
				undo = wireNoteMedia(node);
			},
			destroy() {
				undo();
			},
		};
	}
</script>

{#if cover}
	{#if cover.image === null}
		<p class="embed-missing">The cover image is missing.</p>
	{:else if cover.decorative}
		<!-- A decorative cover has an empty alt and no figure, so a screen reader skips it. -->
		<div class="note-cover"><img src={cover.image.path} alt="" decoding="async" /></div>
	{:else}
		<figure class="note-cover"><img src={cover.image.path} alt={cover.alt} decoding="async" /></figure>
	{/if}
{/if}
<div class="prose prose-lg max-w-none note-body" use:media={html}>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the hub's rendered HTML, verified by the xoxd_projection module before the build (signature, sha256 and no script, handler or javascript: URL) -->
	{@html html}
</div>

<!--
	The hub renders each block of a note as plain HTML. These rules set that
	markup in the blog's prose type and spacing. They add no card, no box and
	no border. They live here, not in app.css, so a build with no notes ships
	the stylesheet it shipped before notes existed.
-->
<style>
	.note-cover {
		margin: 0 0 1.5em;
	}

	.note-cover img {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.embed-missing,
	.note-body :global(.embed-missing) {
		font-style: italic;
	}

	.note-body :global(figure) {
		margin: 1.5em 0;
	}

	.note-body :global(figure img),
	.note-body :global(figure video) {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0;
	}

	.note-body :global(figcaption) {
		margin-top: 0.5em;
		font-size: 0.875em;
		color: var(--color-surface-600);
	}

	:global([data-mode='dark']) .note-body :global(figcaption) {
		color: var(--color-surface-400);
	}

	.note-body :global(.figure-number) {
		font-weight: 600;
	}

	/* A photo set: one column on a phone, more where there is room. */
	.note-body :global(.embed-photos) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: 1em;
	}

	.note-body :global(.embed-photos .embed-photo) {
		margin: 0;
	}

	.note-body :global(.embed-photos .embed-photo img) {
		width: 100%;
	}

	/* A recording: its title, then the browser's own player at full width. */
	.note-body :global(.embed-recording figcaption) {
		margin: 0 0 0.5em;
		font-size: 1em;
		font-weight: 600;
		color: inherit;
	}

	.note-body :global(.embed-recording audio) {
		display: block;
		width: 100%;
	}

	.note-body :global(.embed-description) {
		margin-top: 0.75em;
	}

	.note-body :global(.embed-description p:last-child) {
		margin-bottom: 0;
	}

	/* A video by reference: the poster and its label are one link. A press
	   swaps the link for the player frame, which keeps the same shape. */
	.note-body :global(.embed-youtube .embed-play) {
		display: block;
	}

	.note-body :global(.embed-youtube .embed-play img),
	.note-body :global(.embed-youtube .embed-player) {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border: 0;
	}

	.note-body :global(.embed-play-label) {
		display: block;
		padding: 0.5em 0;
	}

	.note-body :global(.embed-hint) {
		font-size: 0.875em;
	}

	/* A clip: the video, then a text button a thumb can press. */
	.note-body :global(.clip-toggle) {
		display: block;
		min-height: 2.75rem;
		padding: 0.5em 0;
		background: none;
		border: 0;
		color: var(--color-primary-500);
		font: inherit;
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.note-body :global(.clip-toggle[hidden]) {
		display: none;
	}

	.note-body :global(.math) {
		margin: 1.25em 0;
		overflow-x: auto;
	}
</style>
