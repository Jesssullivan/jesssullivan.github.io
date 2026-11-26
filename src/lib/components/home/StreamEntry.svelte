<script lang="ts">
	// One item of the home stream, in the form its kind has (TIN-8657, rulings RM48 and RM66).
	// Every kind is drawn here and nowhere else. The kind shows by form: there is no label, card or rule.
	// An item has words and it may have something to see. On a wide screen the two sit on two lines
	// that run down the whole stream: the words on the first, and what there is to see on the second.
	import Picture from './Picture.svelte';
	import { dayOf, setTotal, shows, tipFor, type StreamFilm, type StreamImage, type StreamItem, type StreamSound } from '$lib/home/stream';

	let { item }: { item: StreamItem } = $props();

	const images = $derived(item.media.filter((media): media is StreamImage => media.type === 'image'));
	const sounds = $derived(item.media.filter((media): media is StreamSound => media.type === 'soundcloud'));
	const films = $derived(item.media.filter((media): media is StreamFilm => media.type === 'youtube'));
	// The count shows only when the post holds more photographs than are on screen here.
	const total = $derived(setTotal(item));
	const pic = $derived(shows(item));
	// A recording of its own carries its play control beside its title. One a post holds sits under the post's words.
	const lone = $derived(item.kind === 'recording' && sounds.length > 0);
	const held = $derived(lone ? sounds.slice(1) : sounds);
	// What is to see sets its own width: never wider than its file, and a tall picture never taller than most of the screen.
	const shape = $derived.by(() => {
		const lead = images[0] ?? films[0]?.poster;
		if (!lead) return '';
		// A row of posters is as wide as its posters together, and counts as one wide shape.
		const across = images[0] ? 1 : films.length;
		return `--natural:${lead.width * across}px;--ar:${((lead.width * across) / lead.height).toFixed(4)}`;
	});

	// A player is a frame from another site. It loads only when the visitor asks for it.
	let playing = $state<string[]>([]);
	const play = (src: string) => (playing = [...playing, src]);
	const soundSrc = (sound: StreamSound) =>
		`https://w.soundcloud.com/player/?url=${encodeURIComponent(sound.src)}&color=%231abc9c&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
	const filmSrc = (film: StreamFilm) => `https://www.youtube-nocookie.com/embed/${film.src}?autoplay=1`;
	const nth = (n: number, of: number) => (of > 1 ? `, ${n + 1} of ${of}` : '');
</script>

{#snippet sign()}
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
{/snippet}

{#if item.kind === 'announcement'}
	<p class="announcement"><a href={item.url} data-tip={dayOf(item.date)}>{item.title}</a></p>
{:else}
	<article class={`piece ${item.kind}`} class:pic>
		<div class="say">
			{#if item.kind === 'note'}
				<p class="text">{#if item.title}<strong>{`${item.title}. `}</strong>{/if}{item.summary}</p>
				<a class="when" href={item.url}><time datetime={item.date}>{dayOf(item.date)}</time></a>
			{:else}
				{#if lone}
					<div class="line">
						<button type="button" class="play" aria-label={`Play ${item.title}`} data-tip="Play" disabled={playing.includes(sounds[0].src)} onclick={() => play(sounds[0].src)} data-testid="recording-play">
							{@render sign()}
						</button>
						<h2><a href={item.url} rel="noopener" data-tip={dayOf(item.date)}>{item.title}</a></h2>
					</div>
				{:else}
					<h2><a href={item.url} rel={item.kind === 'video' ? 'noopener' : undefined} data-tip={tipFor(item)}>{item.title}</a></h2>
				{/if}
				{#if item.kind === 'article'}
					<p class="sr-only"><time datetime={item.date}>{dayOf(item.date)}</time>{#if item.minutes}, {item.minutes} min read{/if}</p>
				{/if}
				{#if item.summary}<p class="summary">{item.summary}</p>{/if}
				<!-- A recording the item holds: its play control and its own day, which names it. -->
				{#each held as sound, n (sound.src)}
					<div class="line heard">
						<button type="button" class="play" aria-label={`Play ${sound.title ?? item.title}${nth(n, held.length)}`} data-tip={sound.title ?? 'Play'} disabled={playing.includes(sound.src)} onclick={() => play(sound.src)} data-testid="recording-play">
							{@render sign()}
						</button>
						{#if sound.date}<a class="when" href={sound.url ?? sound.src} rel="noopener"><time datetime={sound.date}>{dayOf(sound.date)}</time></a>{/if}
					</div>
				{/each}
				{#each sounds as sound (sound.src)}
					{#if playing.includes(sound.src)}
						<iframe class="player" title={sound.title ?? item.title} src={soundSrc(sound)} height="166" allow="autoplay" scrolling="no"></iframe>
					{/if}
				{/each}
			{/if}
		</div>
		{#if pic}
			<div class="show" style={shape}>
				{#if images[0]}
					<!-- The title is the link a keyboard reaches. The picture is a second way in for a pointer. -->
					<a class="lead" href={item.url} tabindex="-1" aria-hidden={images[0].alt ? undefined : 'true'}><Picture image={images[0]} /></a>
					{#if images.length > 1}
						<div class="rest" aria-hidden="true">
							{#each images.slice(1) as image (image.src)}
								<a href={item.url} tabindex="-1" style={`--ar:${(image.width / image.height).toFixed(4)}`}><Picture {image} alt="" /></a>
							{/each}
						</div>
					{/if}
					{#if total}<p class="count" data-testid="set-total">{total} photographs</p>{/if}
				{/if}
				{#if films.length}
					<div class="films">
						{#each films as film, n (film.src)}
							<div class="frame">
								{#if playing.includes(film.src)}
									<iframe title={film.title ?? item.title} src={filmSrc(film)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
								{:else}
									<!-- The poster is the play control. Its sign and its day lie straight on it, on a feather of the page's ground. -->
									<button type="button" class="poster" aria-label={`Play ${film.title ?? item.title}${nth(n, films.length)}`} onclick={() => play(film.src)} data-testid="video-play">
										{#if film.poster}<Picture image={film.poster} alt="" />{/if}
										<span class="on">
											<span class="play" data-tip={film.title ?? 'Play'}>{@render sign()}</span>
											{#if film.date && item.kind !== 'video'}<time class="when" datetime={film.date}>{dayOf(film.date)}</time>{/if}
										</span>
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</article>
{/if}

<style>
	h2,
	.announcement {
		font: 700 var(--title, clamp(1.45rem, 2.1vw, 1.9rem)) / 1.18 'Inter', sans-serif;
		letter-spacing: -0.018em;
		text-wrap: balance;
	}
	h2 a,
	.announcement a {
		position: relative;
		display: inline-block;
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
		transition: text-decoration-color 0.3s var(--ease-soft);
	}
	h2 a:hover,
	.announcement a:hover,
	:is(h2, .announcement) a:focus-visible {
		text-decoration-color: var(--accent);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.summary {
		margin-top: 0.5rem;
		max-width: 29em;
		font-size: 1.16rem;
		line-height: 1.5;
		color: var(--quiet);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.recording .summary,
	.piece.pic .summary {
		-webkit-line-clamp: 4;
		line-clamp: 4;
	}

	/* A note: a few lines set plainly, its date small and quiet. */
	.note .text {
		max-width: 25em;
		font-size: 1.35rem;
		line-height: 1.5;
		white-space: pre-line;
	}
	.when {
		position: relative;
		display: inline-block;
		font: 600 0.72rem/1.2 'Inter', sans-serif;
		letter-spacing: 0.04em;
		color: var(--quiet);
	}
	.note .when {
		margin-top: 0.6rem;
	}

	/* An announcement: one strong line. */
	.announcement {
		max-width: 22em;
		font-size: clamp(1.7rem, 2.8vw, 2.9rem);
	}

	/*
	 * What there is to see: a picture, a set of them, a video. Under the words on a narrow screen.
	 * It is never wider than its file, and its lead is never taller than most of the screen, so a tall one is narrower.
	 */
	.show {
		--room: 100%;
		margin-top: 1.1rem;
		width: min(var(--room), var(--natural), calc(72vh * var(--ar)));
		width: min(var(--room), var(--natural), calc(72svh * var(--ar)));
	}
	.lead {
		display: block;
		overflow: hidden;
	}
	.lead :global(img) {
		display: block;
		width: 100%;
		height: auto;
		transition:
			transform 1.2s var(--ease),
			opacity 0.6s var(--ease-soft);
	}
	@media (hover: hover) {
		.lead:hover :global(img),
		.poster:hover :global(img) {
			transform: scale(1.015);
		}
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
	.count {
		margin-top: 0.7rem;
		font: 600 0.72rem/1.3 'Inter', sans-serif;
		letter-spacing: 0.04em;
		color: var(--quiet);
	}

	/* A recording: its title and a play control. The player comes only on a press. */
	.line {
		display: flex;
		align-items: center;
		gap: 0.1rem;
	}
	.line.heard {
		margin-top: 0.35rem;
	}
	/* The play control is the bare sign, in the accent, with room for a thumb around it. */
	.play {
		position: relative;
		flex: none;
		display: grid;
		place-items: center start;
		width: 2.75rem;
		height: 2.75rem;
		color: var(--accent);
		cursor: pointer;
		transition:
			transform 0.3s var(--ease),
			color 0.3s var(--ease-soft);
	}
	button.play:hover:not(:disabled),
	.poster:hover .play {
		transform: scale(1.12);
		color: var(--ink);
	}
	button.play:active:not(:disabled),
	.poster:active .play {
		transform: scale(0.96);
	}
	.play:disabled {
		cursor: default;
		opacity: 0.35;
	}
	.play svg {
		width: 2.6rem;
		height: 2.6rem;
		margin-left: -0.85rem;
		fill: currentColor;
	}
	.recording .summary {
		margin-left: 2.85rem;
	}
	/* Where there is a rail for the month, a recording's play control hangs in it, so its title starts on the line every title starts on. */
	@media (min-width: 901px) {
		.recording .line:not(.heard) {
			margin-left: -2.85rem;
		}
		.recording .summary {
			margin-left: 0;
		}
	}
	.player {
		display: block;
		width: 100%;
		max-width: 38rem;
		margin-top: 1rem;
		border: 0;
		animation: lands 0.8s var(--ease-soft) backwards;
	}
	@keyframes lands {
		from {
			opacity: 0;
			filter: blur(6px);
		}
	}

	/* A video: its poster is its play control. The frame takes the poster's place, so nothing moves. */
	.films {
		display: flex;
		gap: clamp(0.3rem, 0.6vw, 0.5rem);
	}
	.frame {
		position: relative;
		flex: 1;
		min-width: 0;
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
	.poster:focus-visible {
		outline-offset: -4px;
	}
	.frame :global(img),
	.frame iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
		transition:
			transform 1.2s var(--ease),
			opacity 0.6s var(--ease-soft);
	}
	/*
	 * The deep feather, as on the stage: the page's ground lies near solid under the sign and the day,
	 * exactly as far as they reach, and then falls off into the picture for a long way.
	 */
	.on {
		position: absolute;
		left: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 0.1rem;
		padding: 3.4rem 7rem 0.2rem 0.7rem;
		text-align: left;
		white-space: nowrap;
		background: radial-gradient(
			ellipse farthest-side at 0 100%,
			color-mix(in oklch, var(--ground) 95%, transparent) 0,
			color-mix(in oklch, var(--ground) 93%, transparent) 50%,
			color-mix(in oklch, var(--ground) 80%, transparent) 59%,
			color-mix(in oklch, var(--ground) 56%, transparent) 70%,
			color-mix(in oklch, var(--ground) 30%, transparent) 81%,
			color-mix(in oklch, var(--ground) 10%, transparent) 92%,
			transparent 100%
		);
	}
	.on .when {
		color: var(--ink);
		/* A halo of the ground under every letter, as a backstop for the feather. */
		text-shadow:
			0 0 0.375rem var(--ground),
			0 0 1rem var(--ground);
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
			opacity 0.2s var(--ease-soft),
			transform 0.3s var(--ease);
	}
	[data-tip]:focus-visible::after,
	.poster:focus-visible [data-tip]::after {
		opacity: 1;
		transform: none;
	}
	@media (hover: hover) {
		[data-tip]:hover::after,
		.poster:hover [data-tip]::after {
			opacity: 1;
			transform: none;
			transition-delay: 0.3s;
		}
	}

	/*
	 * A wide screen. Two lines run down the stream. The words start on the first. On the second starts
	 * what there is to see, and it runs out to the edge of the screen. A piece with nothing to show
	 * sets its summary on the second line, on the baseline of its title.
	 */
	@media (min-width: 1100px) {
		.piece {
			display: grid;
			grid-template-columns: var(--say) minmax(0, 1fr);
			align-items: start;
		}
		.say {
			grid-column: 1;
			padding-right: var(--between);
		}
		.piece:not(.pic) .say {
			display: contents;
		}
		.piece:not(.pic) :is(h2, .line:not(.heard), .text) {
			grid-column: 1;
			padding-right: var(--between);
		}
		.piece:not(.pic) :is(.summary, .heard, .player, .note .when) {
			grid-column: 2;
			margin-top: 0;
			margin-left: 0;
		}
		/* The summary's first line stands on the baseline of the title's first line: each face's own rise, from its own top. */
		.piece:not(.pic) .summary {
			padding-top: calc(var(--title) * 0.94 - 1.099em);
			-webkit-line-clamp: 3;
			line-clamp: 3;
		}
		.piece.recording:not(.pic) .summary {
			padding-top: 0;
		}
		/* A recording's line is as tall as its play control, so its note is centred on it. */
		.piece.recording:not(.pic) {
			align-items: center;
		}
		.piece:not(.pic) .player {
			grid-row: 2;
			margin-top: 1rem;
		}
		.summary {
			font-size: clamp(1.16rem, 1.05vw, 1.3rem);
		}
		.note .text {
			font-size: clamp(1.35rem, 1.5vw, 1.75rem);
		}
		.show {
			--room: calc(100% + var(--gutter));
			grid-column: 2;
			margin-top: 0;
		}
		.on {
			padding: 5.5rem 13rem 0.55rem 1.1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.player {
			animation: none;
		}
	}
</style>
