<script lang="ts">
	// One item of the home stream, in the form its kind has (TIN-8657, ruling RM48).
	// Every kind is drawn here and nowhere else. The kind shows by form: there is no label, card or rule.
	import Picture from './Picture.svelte';
	import { dayOf, tipFor, type StreamFilm, type StreamImage, type StreamItem, type StreamSound } from '$lib/home/stream';

	let {
		item,
		follows = false,
	}: {
		item: StreamItem;
		/** True when this item comes straight after the writing it belongs to, whose title is just above. */
		follows?: boolean;
	} = $props();

	const images = $derived(item.media.filter((media): media is StreamImage => media.type === 'image'));
	const sound = $derived(item.media.find((media): media is StreamSound => media.type === 'soundcloud'));
	const film = $derived(item.media.find((media): media is StreamFilm => media.type === 'youtube'));
	const count = $derived(images.length + (item.more ?? 0));
	const outside = $derived(/^https?:/.test(item.url));

	// A player is a frame from another site. It loads only when the visitor asks for it.
	let playing = $state(false);
	const soundSrc = $derived(
		sound ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(sound.src)}&color=%231abc9c&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false` : '',
	);
	const filmSrc = $derived(film ? `https://www.youtube-nocookie.com/embed/${film.src}?autoplay=1` : '');
</script>

{#if item.kind === 'note'}
	<div class="note">
		<p class="text">{#if item.title}<strong>{item.title}.</strong>{' '}{/if}{item.summary}</p>
		{#if images[0]}<div class="own"><Picture image={images[0]} /></div>{/if}
		<a class="when" href={item.url}><time datetime={item.date}>{dayOf(item.date)}</time></a>
	</div>
{:else if item.kind === 'article'}
	<article class="article">
		<h2><a href={item.url} data-tip={tipFor(item)}>{item.title}</a></h2>
		<p class="sr-only"><time datetime={item.date}>{dayOf(item.date)}</time>{#if item.minutes}, {item.minutes} min read{/if}</p>
		{#if item.summary}<p class="summary">{item.summary}</p>{/if}
		{#if images[0]}<a class="own" href={item.url} tabindex="-1" aria-hidden="true"><Picture image={images[0]} alt="" /></a>{/if}
	</article>
{:else if item.kind === 'announcement'}
	<p class="announcement"><a href={item.url} data-tip={dayOf(item.date)}>{item.title}</a></p>
{:else if item.kind === 'photos' && images[0]}
	<figure class="photos" class:portrait={images[0].height > images[0].width} style={`--ar:${(images[0].width / images[0].height).toFixed(4)}`}>
		<a class="lead" href={item.url} aria-label={item.title}><Picture image={images[0]} /></a>
		{#if images.length > 1}
			<div class="rest" aria-hidden="true">
				{#each images.slice(1) as image (image.src)}
					<a href={item.url} tabindex="-1" style={`--ar:${(image.width / image.height).toFixed(4)}`}><Picture {image} alt="" /></a>
				{/each}
			</div>
		{/if}
		{#if !follows || count > 1}
			<figcaption>
				{#if !follows}<a href={item.url} data-tip={dayOf(item.date)}>{item.title}</a>{/if}
				{#if count > 1}<span>{count} photographs</span>{/if}
			</figcaption>
		{/if}
	</figure>
{:else if item.kind === 'recording' && sound}
	<div class="recording">
		<div class="line">
			<button type="button" class="play" aria-label={`Play ${item.title}`} data-tip="Play" disabled={playing} onclick={() => (playing = true)} data-testid="recording-play">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
			</button>
			<h2><a href={item.url} rel="noopener" data-tip={dayOf(item.date)}>{item.title}</a></h2>
		</div>
		{#if item.summary}<p class="summary">{item.summary}</p>{/if}
		{#if playing}
			<iframe class="player" title={item.title} src={soundSrc} height="166" allow="autoplay" scrolling="no"></iframe>
		{/if}
	</div>
{:else if item.kind === 'video' && film}
	<div class="video">
		<div class="frame">
			{#if playing}
				<iframe title={item.title} src={filmSrc} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
			{:else}
				<!-- The poster is a second way to press play. The named control is the one under it. -->
				<button type="button" class="poster" tabindex="-1" aria-hidden="true" onclick={() => (playing = true)}>
					{#if film.poster}<Picture image={film.poster} alt="" />{/if}
				</button>
			{/if}
		</div>
		<div class="line">
			<button type="button" class="play" aria-label={`Play ${item.title}`} data-tip="Play" disabled={playing} onclick={() => (playing = true)} data-testid="video-play">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
			</button>
			<h2><a href={item.url} rel="noopener" data-tip={dayOf(item.date)}>{item.title}</a></h2>
		</div>
	</div>
{/if}

<style>
	h2,
	.announcement {
		font: 700 clamp(1.45rem, 2.1vw, 1.9rem) / 1.18 'Inter', sans-serif;
		letter-spacing: -0.018em;
		text-wrap: balance;
	}
	h2 a,
	.announcement a,
	figcaption a {
		position: relative;
		display: inline-block;
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
		transition: text-decoration-color 0.2s ease;
	}
	h2 a:hover,
	.announcement a:hover,
	figcaption a:hover,
	:is(h2, .announcement, figcaption) a:focus-visible {
		text-decoration-color: var(--accent);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.summary {
		margin-top: 0.5rem;
		max-width: 34rem;
		font-size: 1.16rem;
		line-height: 1.5;
		color: var(--quiet);
	}
	.article .summary {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* A note: a few lines set plainly, its date small and quiet. */
	.note .text {
		max-width: 34rem;
		font-size: 1.35rem;
		line-height: 1.5;
		white-space: pre-line;
	}
	.when {
		display: inline-block;
		margin-top: 0.6rem;
		font: 600 0.72rem/1.2 'Inter', sans-serif;
		letter-spacing: 0.04em;
		color: var(--quiet);
	}

	/* An image that is the item's own, at the width of the column. */
	.own {
		display: block;
		margin-top: 1.1rem;
		max-width: 38rem;
	}
	.own :global(img) {
		width: 100%;
		height: auto;
		max-height: 26rem;
		object-fit: cover;
	}

	/* An announcement: one strong line. */
	.announcement {
		font-size: clamp(1.7rem, 2.8vw, 2.4rem);
	}

	/* Photographs run wide, past the column on both sides. */
	.photos {
		margin: 0;
	}
	.lead {
		display: block;
		overflow: hidden;
	}
	.lead :global(img) {
		display: block;
		width: 100%;
		height: auto;
		transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@media (hover: hover) {
		.lead:hover :global(img) {
			transform: scale(1.015);
		}
	}
	/* No photograph is taller than most of the screen. A tall one is narrower, and sits at the start of the column. */
	.photos .lead,
	.photos .rest,
	.photos figcaption {
		max-width: min(100%, calc(78vh * var(--ar)));
		max-width: min(100%, calc(78svh * var(--ar)));
	}
	/* The others in the set share one row at one height, each as wide as its shape asks. */
	.rest {
		display: flex;
		gap: clamp(0.3rem, 0.6vw, 0.5rem);
		margin-top: clamp(0.3rem, 0.6vw, 0.5rem);
	}
	.rest a {
		flex: var(--ar) 1 0%;
		min-width: 0;
		overflow: hidden;
	}
	.rest :global(img) {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: var(--ar);
		object-fit: cover;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.9rem;
		margin-top: 0.7rem;
		font: 600 0.95rem/1.3 'Inter', sans-serif;
	}
	figcaption span {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--quiet);
	}

	/* A recording: its title and a play control. The player comes only on a press. */
	.line {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	/* The play control is the bare sign, in the page's ink, with room for a thumb around it. */
	.play {
		position: relative;
		flex: none;
		display: grid;
		place-items: center start;
		width: 2.75rem;
		height: 2.75rem;
		color: var(--ink);
		cursor: pointer;
		transition:
			transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
			color 0.2s ease;
	}
	.play:hover:not(:disabled) {
		transform: scale(1.12);
		color: var(--accent);
	}
	.play:disabled {
		cursor: default;
		opacity: 0.35;
	}
	.play svg {
		width: 1.9rem;
		height: 1.9rem;
		margin-left: -0.45rem;
		fill: currentColor;
	}
	.recording .summary {
		margin-left: 3.1rem;
	}
	.player {
		display: block;
		width: 100%;
		max-width: 38rem;
		margin-top: 1rem;
		border: 0;
	}

	/* A video: its poster and a play control. The frame takes the poster's place, so nothing moves. */
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: color-mix(in oklch, var(--ink) 8%, var(--ground));
	}
	.poster {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.frame :global(img),
	.frame iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
		transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@media (hover: hover) {
		.poster:hover :global(img) {
			transform: scale(1.015);
		}
	}
	.video .line {
		margin-top: 0.9rem;
	}

	/* A tooltip: the day and the reading time of a title, or the name of a control. */
	[data-tip]::after {
		content: attr(data-tip);
		position: absolute;
		left: 0;
		bottom: calc(100% + 0.3rem);
		z-index: 5;
		padding: 0.3rem 0.5rem;
		font: 600 0.72rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: var(--ground);
		background: var(--ink);
		opacity: 0;
		transform: translateY(0.25rem);
		pointer-events: none;
		transition:
			opacity 0.15s ease,
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	[data-tip]:focus-visible::after {
		opacity: 1;
		transform: none;
	}
	@media (hover: hover) {
		[data-tip]:hover::after {
			opacity: 1;
			transform: none;
			transition-delay: 0.3s;
		}
	}
</style>
