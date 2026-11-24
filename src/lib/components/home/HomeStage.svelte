<script lang="ts" module>
	// Input on the stage stops the play for the visit. A reload is a new first load and plays again.
	let stoppedThisVisit = false;
</script>

<script lang="ts">
	// The heading stage (TIN-8657, ruling RM47): one full-bleed stage that moves by itself
	// between the sky of posts, the heron heading and items placed in the heading.
	// Only the first scene is in the first paint. The others arrive when the browser is
	// idle or one hold before they show.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';
	import Picture from './Picture.svelte';
	import type { ReaderCollection } from '$lib/reader/collection';
	import { HERON, type StageScene } from '$lib/home/scenes';
	import { FrameBudget, StageClock } from '$lib/home/stageClock';
	import { tipFor } from '$lib/home/stream';

	let {
		scenes,
		archive,
		focusSlug = null,
	}: {
		scenes: StageScene[];
		archive: ReaderCollection['archive'];
		focusSlug?: string | null;
	} = $props();

	let index = $state(0);
	let playing = $state(false);
	let reduced = $state(false);
	let still = $state(false);
	let stepped = $state(false);
	let armed = $state<Record<string, boolean>>({});
	let stageEl = $state<HTMLElement | null>(null);
	let scenesEl = $state<HTMLDivElement | null>(null);
	let clock: StageClock | null = null;

	const scene = $derived(scenes[Math.min(index, scenes.length - 1)]);
	const hold = $derived(scene?.hold ?? 0);

	/** Show the first scene. The link at the end of the stream calls this. */
	export function showFirst() {
		clock?.go(0);
	}

	// A scene is loaded once it is on show or next in line.
	function arm(at: number) {
		for (const target of [scenes[at], scenes[(at + 1) % scenes.length]]) {
			if (target && !armed[target.id]) armed[target.id] = true;
		}
	}

	function stop() {
		stoppedThisVisit = true;
		clock?.stop();
	}

	function step(delta: number) {
		stepped = true;
		clock?.step(delta);
	}

	// Arrow keys step the scenes while a control has focus.
	function onControlKey(event: KeyboardEvent) {
		const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!delta) return;
		event.preventDefault();
		step(delta);
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		// ?stage-pace=20 runs the holds twenty times faster, for tests.
		const pace = Math.min(200, Math.max(1, Number(new URLSearchParams(page.url.search).get('stage-pace')) || 1));
		let tabHidden = document.hidden;
		let offScreen = false;
		clock = new StageClock(
			scenes.map((entry) => entry.hold / pace),
			{ now: () => performance.now(), setTimer: (run, ms) => window.setTimeout(run, ms), clearTimer: (id) => window.clearTimeout(id as number) },
			{
				reduced,
				stopped: stoppedThisVisit,
				onchange: (state) => {
					index = state.index;
					playing = state.playing;
					// Once the stage has moved, the scene after the one on show is made ready a whole hold ahead.
					if (state.index > 0 || stepped) arm(state.index);
				},
			},
		);
		clock.start();

		// A hidden tab or a stage scrolled away pauses the play. It resumes by itself. A pause the visitor made does not.
		const hide = () => (tabHidden || offScreen ? clock?.pause('hidden') : clock?.resume('hidden'));
		const onVisibility = () => {
			tabHidden = document.hidden;
			hide();
		};
		document.addEventListener('visibilitychange', onVisibility);
		const seen = new IntersectionObserver(
			(entries) => {
				// With only its foot on screen the stage counts as scrolled away.
				offScreen = entries[entries.length - 1].intersectionRatio < 0.25;
				hide();
			},
			{ threshold: [0, 0.25] },
		);
		if (stageEl) seen.observe(stageEl);

		// Any press, key, wheel or touch on the scenes stops the play for the visit. The page still scrolls: nothing is cancelled.
		const inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'] as const;
		const options = { capture: true, passive: true };
		for (const name of inputs) scenesEl?.addEventListener(name, stop, options);

		// The first paint pays for the first scene only. The second is made ready a little later, when the browser is idle.
		let idle: number | undefined;
		const later = window.setTimeout(() => {
			if (window.requestIdleCallback) idle = window.requestIdleCallback(() => arm(0), { timeout: 3000 });
			else arm(0);
		}, 2000);
		return () => {
			clock?.destroy();
			clock = null;
			document.removeEventListener('visibilitychange', onVisibility);
			seen.disconnect();
			for (const name of inputs) scenesEl?.removeEventListener(name, stop, options);
			window.clearTimeout(later);
			if (idle !== undefined) window.cancelIdleCallback?.(idle);
		};
	});

	// The hub can add a scene after the page is up: the clock learns the new holds.
	$effect(() => {
		const pace = Math.min(200, Math.max(1, Number(new URLSearchParams(page.url.search).get('stage-pace')) || 1));
		clock?.setHolds(scenes.map((entry) => entry.hold / pace));
	});

	// The slow drift watches its own frames. Ten slow ones in a row and the photographs stay still.
	$effect(() => {
		if (!playing || still || scene?.type === 'sky') return;
		const budget = new FrameBudget();
		const started = performance.now();
		let last = started;
		let id = requestAnimationFrame(function watch(now) {
			if (budget.frame(now - last)) {
				still = true;
				return;
			}
			last = now;
			// A device that kept up for six seconds is left alone.
			if (now - started < 6000) id = requestAnimationFrame(watch);
		});
		return () => cancelAnimationFrame(id);
	});
</script>

<section
	class="stage"
	class:still={still || reduced}
	id="sky"
	aria-roledescription="carousel"
	aria-label="Heading"
	bind:this={stageEl}
	data-testid="home-stage"
	data-scene={scene?.id}
	data-playing={playing}
>
	<!-- The controls come first, so a keyboard reaches Pause before anything that moves. -->
	<div class="controls" role="group" aria-label="Heading scenes">
		{#if reduced}
			<button type="button" aria-label="Previous" data-tip="Previous" onclick={() => step(-1)} onkeydown={onControlKey} data-testid="stage-previous">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
			</button>
		{:else}
			<button type="button" aria-label={playing ? 'Pause' : 'Play'} data-tip={playing ? 'Pause' : 'Play'} onclick={() => clock?.toggle()} onkeydown={onControlKey} data-testid="stage-pause">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{#if playing}<path d="M9 5v14M15 5v14" />{:else}<path d="M8 5l11 7-11 7z" />{/if}
				</svg>
			</button>
		{/if}
		<button type="button" aria-label="Next" data-tip="Next" onclick={() => step(1)} onkeydown={onControlKey} data-testid="stage-next">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
		</button>
		{#if !reduced}
			<span class="progress" aria-hidden="true">
				{#key index}<i class:run={playing} style={`animation-duration:${hold}ms`}></i>{/key}
			</span>
		{/if}
	</div>

	<div class="scenes" bind:this={scenesEl} aria-live={stepped && !playing ? 'polite' : 'off'}>
		{#each scenes as entry, i (entry.id)}
			<div class={`scene ${entry.type}`} class:on={i === index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${scenes.length}`} inert={i !== index} data-testid={`scene-${entry.type}`}>
				{#if entry.type === 'sky'}
					<ReaderConstellation {archive} {focusSlug} />
				{:else if i === index || armed[entry.id]}
					{#if entry.type === 'heron'}
						<div class="plate heron"><Picture image={HERON.image} lazy={false} /></div>
						<div class="copy">
							<p class="heron-title">{HERON.title}</p>
							<span class="rule" aria-hidden="true"></span>
							{#each HERON.definitions as definition (definition.term)}
								<p class="definition"><strong>{definition.term}</strong> {definition.text}</p>
							{/each}
							<p class="heron-name">{HERON.name}</p>
						</div>
					{:else}
						<div class="plate side" style={`--natural:${entry.image.width}px`}><Picture image={entry.image} lazy={false} alt="" /></div>
						<div class="copy">
							<p class="placed-title"><a href={entry.item.url} data-tip={tipFor(entry.item)}>{entry.item.title}</a></p>
							{#if entry.item.summary}<p class="placed-summary">{entry.item.summary}</p>{/if}
						</div>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</section>

<style>
	/* The stage is as wide as the window and has no box: its ground is the page's own. */
	.stage {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: clamp(30rem, calc(100vh - 7.5rem), 64rem);
		height: clamp(30rem, calc(100svh - 7.5rem), 64rem);
		color: var(--ink);
		--ease: cubic-bezier(0.16, 1, 0.3, 1);
	}
	.scenes {
		position: relative;
		order: 1;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Scenes share one box, so nothing moves when one gives way to the next. A scene arrives out of a short soft blur. */
	.scene {
		position: absolute;
		inset: 0;
		opacity: 0;
		visibility: hidden;
		filter: blur(10px);
		transition:
			opacity 0.7s ease,
			filter 0.9s var(--ease),
			visibility 0s linear 0.7s;
	}
	.scene.on {
		opacity: 1;
		visibility: visible;
		filter: none;
		transition:
			opacity 0.9s ease,
			filter 1.1s var(--ease),
			visibility 0s;
	}

	/*
	 * The sky is the first scene. It is used as its own branch ships it, full bleed with its legend and
	 * controls laid over it. The stage gives it the room, and lines its legend and controls up with the page's edge.
	 */
	.scene.sky :global(.constellation) {
		height: 100%;
		--edge: var(--gutter) !important;
	}
	.scene.sky :global(.constellation .sky) {
		height: 100%;
	}

	/* A photograph. It drifts like a slow camera: a few percent of scale and travel over most of a minute. */
	.scenes {
		container-type: size;
		--copy: min(27rem, calc(100cqw - 2 * var(--gutter)));
		/* Where the type ends, a little past its last letter. The feather holds solid up to here. */
		--copy-end: calc(var(--gutter) + var(--copy) + 1.75rem);
	}
	.plate {
		position: absolute;
		inset: 0;
		overflow: hidden;
		--plate-left: 0px;
		/* The photograph dissolves into the page at its head and its foot, so the stage and the stream are one ground with no edge between them. */
		-webkit-mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 0.35) 7%, #000 20%, #000 56%, rgb(0 0 0 / 0.7) 72%, rgb(0 0 0 / 0.3) 88%, transparent 100%);
		mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 0.35) 7%, #000 20%, #000 56%, rgb(0 0 0 / 0.7) 72%, rgb(0 0 0 / 0.3) 88%, transparent 100%);
	}
	.plate :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 62% 40%;
		transform: scale(1.03);
		animation: drift 46s ease-in-out infinite alternate;
		animation-play-state: paused;
	}
	.stage[data-playing='true'] .scene.on .plate :global(img) {
		animation-play-state: running;
	}
	.stage.still .plate :global(img) {
		animation: none;
		transform: none;
	}
	@keyframes drift {
		from {
			transform: scale(1.03) translate3d(-0.6%, 0.5%, 0);
		}
		to {
			transform: scale(1.075) translate3d(1.5%, -0.9%, 0);
		}
	}
	/*
	 * Type sits straight on the photograph. Behind it, the deep feather: a band of the page's
	 * own ground exactly as wide as the text, near solid, then a long falloff into the picture.
	 * It is mixed from the ground token, so it re-tints with every theme and mode. It is drawn
	 * on the photograph only, so the bare page beside it stays one flat colour.
	 */
	.plate::after {
		content: '';
		position: absolute;
		inset: 0;
		--f: calc(var(--copy-end) - var(--plate-left));
		background: linear-gradient(
			to right,
			color-mix(in oklch, var(--ground) 96%, transparent) 0,
			color-mix(in oklch, var(--ground) 96%, transparent) var(--f),
			color-mix(in oklch, var(--ground) 86%, transparent) calc(var(--f) + 2.5rem),
			color-mix(in oklch, var(--ground) 68%, transparent) calc(var(--f) + 6rem),
			color-mix(in oklch, var(--ground) 45%, transparent) calc(var(--f) + 11rem),
			color-mix(in oklch, var(--ground) 22%, transparent) calc(var(--f) + 18rem),
			color-mix(in oklch, var(--ground) 7%, transparent) calc(var(--f) + 25rem),
			transparent calc(var(--f) + 30rem)
		);
		pointer-events: none;
	}
	/*
	 * A placed photograph stands at the far side from the type and is never drawn much past its own
	 * width: the site keeps images at 1200 pixels at most. Its near edge dissolves into the page too.
	 */
	.plate.side {
		--plate-w: min(100cqw, max(58cqw, 34rem), calc(var(--natural) * 1.2));
		--plate-left: calc(100cqw - var(--plate-w));
		inset: 0 0 0 auto;
		width: var(--plate-w);
		-webkit-mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0 / 0.5) 14%, #000 34%), linear-gradient(to bottom, transparent 0, #000 5rem, #000 calc(100% - 11rem), rgb(0 0 0 / 0.5) calc(100% - 5rem), transparent 100%);
		-webkit-mask-composite: source-in;
		mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0 / 0.5) 14%, #000 34%), linear-gradient(to bottom, transparent 0, #000 5rem, #000 calc(100% - 11rem), rgb(0 0 0 / 0.5) calc(100% - 5rem), transparent 100%);
		mask-composite: intersect;
	}
	/*
	 * The heron file is 672 by 219 pixels and the repository holds no larger original.
	 * It is drawn as wide as the window, the size the site has always drawn it, and never taller than that.
	 */
	.plate.heron {
		inset: 50% 0 auto;
		height: min(100%, calc(100cqw * 219 / 672));
		translate: 0 -50%;
	}
	.plate.heron :global(img) {
		object-position: 50% 50%;
	}

	.copy {
		position: absolute;
		left: var(--gutter);
		top: 50%;
		width: var(--copy);
		transform: translateY(-50%);
		isolation: isolate;
		/* A halo of the ground under every letter, as a backstop for the feather. */
		text-shadow:
			0 0 0.375rem var(--ground),
			0 0 1rem var(--ground);
	}

	.heron-title {
		font: 700 clamp(1.9rem, 3.6vw, 3.25rem) / 1.12 'Raleway', sans-serif;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	/* Her rainbow stays as the one thin rule of the heading. As text it could not hold contrast on a light ground. */
	.rule {
		display: block;
		width: 6.25rem;
		height: 2px;
		margin: 1.25rem 0;
		background: linear-gradient(90deg, #ff6b6b, #ffa500, #ffd700, #4ecdc4, #45b7d1, #96c, #ff6b9d);
	}
	.definition {
		margin-top: 0.6rem;
		font: 400 1rem/1.5 'Raleway', sans-serif;
	}
	.definition strong {
		font-weight: 700;
	}
	.heron-name {
		margin-top: 1.4rem;
		font: 700 0.95rem/1.2 'Raleway', sans-serif;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.placed-title {
		font: 700 clamp(1.7rem, 3vw, 2.75rem) / 1.12 'Inter', sans-serif;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.placed-title a {
		position: relative;
		display: inline-block;
		text-decoration: underline transparent;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
		transition: text-decoration-color 0.2s ease;
	}
	.placed-title a:hover,
	.placed-title a:focus-visible {
		text-decoration-color: var(--accent);
	}
	.placed-summary {
		margin-top: 0.9rem;
		font-size: 1.2rem;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* One thin line, pause and next, on the page's ground under the scenes, at the far end from the type. */
	.controls {
		order: 2;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		height: 2.75rem;
		padding-inline: calc(var(--gutter) - 0.8rem);
	}
	.controls button {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		color: var(--ink);
		cursor: pointer;
	}
	.controls svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.2s var(--ease);
	}
	.controls button:hover svg {
		transform: scale(1.15);
	}
	.controls button:focus-visible,
	.placed-title a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.progress {
		order: -1;
		width: clamp(4rem, 12vw, 9rem);
		height: 2px;
		margin-right: 0.6rem;
		background: color-mix(in oklch, var(--ink) 16%, transparent);
		overflow: hidden;
	}
	.progress i {
		display: block;
		height: 100%;
		background: var(--accent);
		transform-origin: 0 50%;
		transform: scaleX(0);
		animation: fill linear both paused;
	}
	.progress i.run {
		animation-play-state: running;
	}
	@keyframes fill {
		to {
			transform: scaleX(1);
		}
	}

	/* A tooltip: the name of an icon control, or the day and reading time of a title. */
	[data-tip]::after {
		content: attr(data-tip);
		position: absolute;
		left: 0;
		bottom: calc(100% + 0.35rem);
		z-index: 5;
		padding: 0.3rem 0.5rem;
		font: 600 0.72rem/1 'Inter', sans-serif;
		letter-spacing: 0.02em;
		white-space: nowrap;
		text-shadow: none;
		color: var(--ground);
		background: var(--ink);
		opacity: 0;
		transform: translateY(0.25rem);
		pointer-events: none;
		transition:
			opacity 0.15s ease,
			transform 0.2s var(--ease);
	}
	.controls [data-tip]::after {
		left: auto;
		right: 0;
	}
	[data-tip]:focus-visible::after {
		opacity: 1;
		transform: none;
	}
	@media (hover: hover) {
		[data-tip]:hover::after {
			opacity: 1;
			transform: none;
			transition-delay: 0.25s;
		}
	}

	/* A phone: the photograph above, the type below it on the same feather, turned to fall off upward. */
	@media (max-width: 720px) {
		.scenes {
			--copy: calc(100cqw - 2 * var(--gutter));
		}
		.plate,
		.plate.side {
			inset: 0 0 auto;
			width: auto;
			height: 64%;
			-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 58%, rgb(0 0 0 / 0.6) 76%, rgb(0 0 0 / 0.22) 90%, transparent 100%);
			-webkit-mask-composite: source-over;
			mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 58%, rgb(0 0 0 / 0.6) 76%, rgb(0 0 0 / 0.22) 90%, transparent 100%);
			mask-composite: add;
		}
		.plate::after {
			content: none;
		}
		/* A placed photograph runs down to the type, however few lines the type has. */
		.plate.side {
			height: 78%;
		}
		.plate.heron {
			inset: 0 0 auto;
			height: 58%;
			translate: none;
		}
		.plate.heron :global(img) {
			object-position: 82% 50%;
		}
		.copy {
			top: auto;
			bottom: 0.5rem;
			transform: none;
			--falloff: 13rem;
		}
		/* The band holds solid from the first line of type down, and falls off upward into the picture. */
		.copy::before {
			content: '';
			position: absolute;
			z-index: -1;
			top: calc(-1 * (1rem + var(--falloff)));
			bottom: 0;
			left: -100vw;
			right: -100vw;
			--f: calc(100% - var(--falloff));
			background: linear-gradient(
				to top,
				color-mix(in oklch, var(--ground) 96%, transparent) 0,
				color-mix(in oklch, var(--ground) 96%, transparent) var(--f),
				color-mix(in oklch, var(--ground) 84%, transparent) calc(var(--f) + 1.5rem),
				color-mix(in oklch, var(--ground) 62%, transparent) calc(var(--f) + 4rem),
				color-mix(in oklch, var(--ground) 36%, transparent) calc(var(--f) + 7rem),
				color-mix(in oklch, var(--ground) 12%, transparent) calc(var(--f) + 10.5rem),
				transparent
			);
			pointer-events: none;
		}
		.heron-title {
			font-size: clamp(1.5rem, 7.4vw, 2rem);
			letter-spacing: 0.1em;
		}
		.rule {
			margin: 0.9rem 0;
		}
		.definition {
			font-size: 0.9rem;
			line-height: 1.45;
			margin-top: 0.45rem;
		}
		.heron-name {
			margin-top: 1rem;
		}
		.placed-summary {
			font-size: 1.08rem;
			-webkit-line-clamp: 3;
			line-clamp: 3;
		}
	}

	/* No motion: no blur, no fade, no drift. The scenes step by the controls. */
	@media (prefers-reduced-motion: reduce) {
		.scene,
		.scene.on {
			filter: none;
			transition: none;
		}
		.plate :global(img) {
			animation: none;
			transform: none;
		}
	}
</style>
