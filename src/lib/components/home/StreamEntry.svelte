<script lang="ts">
	// One item of the home stream, in the form its kind has (TIN-8657, rulings RM48, RM66 and RM70).
	// Every kind is drawn here and nowhere else. The kind shows by form: there is no label, card or rule.
	// An item has words and it may have something to see. On a wide screen two lines run down the whole
	// stream. Every title starts on the first. A picture starts on one of the two, by its own shape:
	// a wide photograph on the first, with its title lying on it, and any other picture on the second, beside its words.
	import Picture from './Picture.svelte';
	import { formOf, leadOf, rowOf } from '$lib/home/forms';
	import { dayOf, setTotal, shows, tipFor, type StreamFilm, type StreamImage, type StreamItem, type StreamSound } from '$lib/home/stream';

	let { item }: { item: StreamItem } = $props();

	const images = $derived(item.media.filter((media): media is StreamImage => media.type === 'image'));
	const sounds = $derived(item.media.filter((media): media is StreamSound => media.type === 'soundcloud'));
	const films = $derived(item.media.filter((media): media is StreamFilm => media.type === 'youtube'));
	// The count shows only when the post holds more photographs than are on screen here.
	const total = $derived(setTotal(item));
	const pic = $derived(shows(item));
	const form = $derived(formOf(item));
	// One picture leads. The others stand in a row under it, at one height. Small pictures have no lead: they are all the row.
	const lead = $derived(form === 'small' ? undefined : leadOf(images));
	const others = $derived(images.filter((image) => image !== lead));
	const row = $derived(rowOf(others));
	// A recording of its own carries its play control beside its title. One a post holds sits under the post's words.
	const lone = $derived(item.kind === 'recording' && sounds.length > 0);
	const held = $derived(lone ? sounds.slice(1) : sounds);
	// What is to see sets its own width: never wider than its file, and a tall picture never taller than most of the screen.
	const shape = $derived.by(() => {
		const first = lead ?? films[0]?.poster;
		if (!first) return undefined;
		// A row of posters is as wide as its posters together, and counts as one wide shape.
		const across = lead ? 1 : films.length;
		return `--natural:${first.width * across}px;--ar:${((first.width * across) / first.height).toFixed(4)}`;
	});
	const ratio = (image: StreamImage) => (image.width / image.height).toFixed(4);
	// How wide each picture is drawn, as the browser reads it, so it asks for the size of file the layout needs.
	const LINE_ONE = '(100vw - 7vw - 9.5rem)';
	const leadSizes = $derived.by(() => {
		if (!lead) return undefined;
		const own = `${lead.width}px, calc(${form === 'plate' ? 80 : 72}vh * ${ratio(lead)})`;
		const room = form === 'plate' ? `calc${LINE_ONE}` : `calc(${LINE_ONE} - 37vw)`;
		return `(min-width: 1100px) min(${room}, ${own}), (min-width: 901px) min(calc(100vw - 14vw - 9.5rem), ${own}), min(92vw, ${own})`;
	});
	const rowSizes = (image: StreamImage) => `min(calc(17rem * ${ratio(image)}), ${image.width}px, ${Math.ceil((100 * image.width) / image.height / (row?.sum ?? 1))}vw)`;

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
	<article class={`piece ${item.kind} ${form}`} class:pic style={shape}>
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
			<div class="show">
				{#if lead}
					<!-- The title is the link a keyboard reaches. The picture is a second way in for a pointer. -->
					<a class="lead" href={item.url} tabindex="-1" aria-hidden={lead.alt ? undefined : 'true'}><Picture image={lead} sizes={leadSizes} /></a>
				{/if}
				{#if row}
					<div class="rest" aria-hidden="true" style={`--sum:${row.sum.toFixed(4)};--cap:${row.cap}px;--gaps:${others.length - 1}`}>
						{#each others as image (image.src)}
							<a href={item.url} tabindex="-1" style={`--ar:${ratio(image)}`}><Picture {image} alt="" sizes={rowSizes(image)} /></a>
						{/each}
					</div>
				{/if}
				{#if total}<p class="count" data-testid="set-total">{total} photographs</p>{/if}
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
	/* An excerpt is cut at a sentence end where the stream is built, so it is short. The clamp is only a floor under that. */
	@media (min-width: 1100px) {
		.summary {
			-webkit-line-clamp: 5;
			line-clamp: 5;
		}
	}
	.recording .summary,
	.piece.pic .summary {
		-webkit-line-clamp: 5;
		line-clamp: 5;
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
	/* The frame cuts what moves inside it, and is not itself a thing that scrolls: the drift below reads the screen. */
	.lead {
		display: block;
		overflow: hidden;
		overflow: clip;
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
	/*
	 * The others share one row at one height, each as wide as its shape asks. The row is as wide as the lead
	 * when its files allow it, and no picture in it is drawn larger than its file or taller than a hand of rems.
	 */
	.rest {
		--gap: clamp(0.3rem, 0.6vw, 0.5rem);
		container-type: inline-size;
		display: flex;
		gap: var(--gap);
		margin-top: var(--gap);
	}
	.rest a {
		flex: none;
		height: min(var(--cap), 17rem, calc((100cqw - var(--gaps) * var(--gap)) / var(--sum)));
		aspect-ratio: var(--ar);
		overflow: hidden;
	}
	.rest :global(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Small pictures have no lead. They stand in a row at their own size, and the row may break. */
	.small .show {
		width: auto;
		max-width: var(--room);
	}
	.small .rest {
		flex-wrap: wrap;
		margin-top: 0;
	}
	.small .rest a {
		height: min(var(--cap), 11rem);
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
		/* How far the ground holds before it falls off. On a small poster it holds further, so the day's last letter is on it. */
		--hold: 64%;
		--fall: calc(100% - var(--hold));
		background: radial-gradient(
			ellipse farthest-side at 0 100%,
			color-mix(in oklch, var(--ground) 95%, transparent) 0,
			color-mix(in oklch, var(--ground) 93%, transparent) var(--hold),
			color-mix(in oklch, var(--ground) 80%, transparent) calc(var(--hold) + var(--fall) * 0.18),
			color-mix(in oklch, var(--ground) 56%, transparent) calc(var(--hold) + var(--fall) * 0.4),
			color-mix(in oklch, var(--ground) 30%, transparent) calc(var(--hold) + var(--fall) * 0.62),
			color-mix(in oklch, var(--ground) 10%, transparent) calc(var(--hold) + var(--fall) * 0.84),
			transparent 100%
		);
	}
	/* With no day beside it, the sign alone needs less ground under it. */
	.on:not(:has(.when)) {
		padding: 3rem 4rem 0.2rem 0.7rem;
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
		/* The tooltip is for the eye. With empty alternative text it stays out of the name a screen reader gives the link. */
		content: attr(data-tip) / '';
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

		/*
		 * A plate: a wide photograph. It starts on the first line, where every title starts, and runs toward the
		 * right edge of the screen: as wide as its file allows, and never taller than most of the screen.
		 * Its title lies on it, at its foot. The row of its other pictures and its excerpt follow under it.
		 */
		.piece.plate {
			grid-template-columns: minmax(0, 1fr);
			width: min(calc(100% + var(--gutter)), var(--natural), calc(80vh * var(--ar)));
			width: min(calc(100% + var(--gutter)), var(--natural), calc(80svh * var(--ar)));
		}
		.plate :is(.say, .show) {
			display: contents;
		}
		.plate :is(.lead, h2) {
			grid-area: 1 / 1;
		}
		.plate :is(.rest, .count, .summary, .heard, .player) {
			grid-column: 1;
		}
		.plate .count {
			order: 1;
		}
		.plate .summary {
			order: 2;
			margin-top: 1.1rem;
		}
		.plate :is(.heard, .player) {
			order: 3;
		}
		/*
		 * The deep feather, as on the stage. Behind the title lies the page's own ground, near solid and exactly
		 * as far as the title reaches, and then it falls off into the photograph for a long way, up and across.
		 */
		.plate h2 {
			--fall-x: clamp(7rem, 13vw, 14rem);
			--fall-y: clamp(4.5rem, 7vw, 7rem);
			position: relative;
			z-index: 1;
			align-self: end;
			justify-self: start;
			isolation: isolate;
			max-width: min(100%, calc(27ch + var(--fall-x)));
			padding: var(--fall-y) var(--fall-x) clamp(1.1rem, 1.6vw, 1.75rem) clamp(1.25rem, 1.8vw, 2rem);
			font-size: var(--plate-title);
			/* A halo of the ground under every letter, as a backstop for the feather. */
			text-shadow:
				0 0 0.375rem var(--ground),
				0 0 1rem var(--ground);
			pointer-events: none;
		}
		.plate h2 a {
			pointer-events: auto;
		}
		.plate h2::before {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -1;
			background: color-mix(in oklch, var(--ground) 94%, transparent);
			--x: calc(100% - var(--fall-x));
			--y: calc(100% - var(--fall-y));
			--across: linear-gradient(to right, #000 var(--x), rgb(0 0 0 / 0.86) calc(var(--x) + var(--fall-x) * 0.12), rgb(0 0 0 / 0.6) calc(var(--x) + var(--fall-x) * 0.3), rgb(0 0 0 / 0.34) calc(var(--x) + var(--fall-x) * 0.52), rgb(0 0 0 / 0.14) calc(var(--x) + var(--fall-x) * 0.74), rgb(0 0 0 / 0.04) calc(var(--x) + var(--fall-x) * 0.9), transparent 100%);
			--up: linear-gradient(to top, #000 var(--y), rgb(0 0 0 / 0.86) calc(var(--y) + var(--fall-y) * 0.12), rgb(0 0 0 / 0.6) calc(var(--y) + var(--fall-y) * 0.3), rgb(0 0 0 / 0.34) calc(var(--y) + var(--fall-y) * 0.52), rgb(0 0 0 / 0.14) calc(var(--y) + var(--fall-y) * 0.74), rgb(0 0 0 / 0.04) calc(var(--y) + var(--fall-y) * 0.9), transparent 100%);
			-webkit-mask-image: var(--across), var(--up);
			-webkit-mask-composite: source-in;
			mask-image: var(--across), var(--up);
			mask-composite: intersect;
		}
		.on {
			--hold: 50%;
			padding: 5.5rem 13rem 0.55rem 1.1rem;
		}
		.on:not(:has(.when)) {
			padding: 4.5rem 6.5rem 0.55rem 1.1rem;
		}
	}

	/*
	 * Depth by motion: a plate's photograph is a little larger than its frame, and it travels a few percent
	 * inside it as it crosses the screen. The browser reads the scroll for it, so no script runs.
	 * A browser that cannot do this shows the photograph still.
	 */
	@supports (animation-timeline: view()) {
		@media (min-width: 1100px) and (prefers-reduced-motion: no-preference) {
			.plate .lead :global(img) {
				scale: 1.07;
				animation: passes linear both;
				animation-timeline: view();
				transition:
					scale 1.2s var(--ease),
					opacity 0.6s var(--ease-soft);
			}
			.plate .lead:hover :global(img) {
				transform: none;
				scale: 1.085;
			}
			/* A device that missed the stage's frame budget gets the photograph still. */
			:global(.home.calm) .plate .lead :global(img) {
				scale: none;
				animation: none;
			}
		}
	}
	@keyframes passes {
		from {
			translate: 0 -2.6%;
		}
		to {
			translate: 0 2.6%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.player {
			animation: none;
		}
	}
</style>
