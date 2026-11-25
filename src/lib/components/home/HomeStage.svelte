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
	import ReaderConstellation from '$lib/components/reader/ReaderConstellation.svelte';
	import Picture from './Picture.svelte';
	import type { ReaderCollection } from '$lib/reader/collection';
	import { HERON, type StageScene } from '$lib/home/scenes';
	import { ArrivalBudget, FrameBudget, StageClock, inputStops } from '$lib/home/stageClock';
	import { tipFor } from '$lib/home/stream';

	let {
		scenes,
		archive,
		focusSlug = null,
		arrives = false,
		onstill = () => {},
	}: {
		scenes: StageScene[];
		archive: ReaderCollection['archive'];
		focusSlug?: string | null;
		/** True when the stage is put into a page that has already painted, as the flag does on a production build. */
		arrives?: boolean;
		/** Called once, when the device missed the frame budget and the stage gave up its blur and its drift. */
		onstill?: () => void;
	} = $props();

	let index = $state(0);
	let playing = $state(false);
	/** True while the play waits by itself: a hidden tab, a stage scrolled away or a mouse reading a scene. It goes on by itself. */
	let held = $state(false);
	let reduced = $state(false);
	let still = $state(false);
	let stepped = $state(false);
	let armed = $state<Record<string, boolean>>({});
	let stageEl = $state<HTMLElement | null>(null);
	let scenesEl = $state<HTMLDivElement | null>(null);
	let controlsEl = $state<HTMLDivElement | null>(null);
	let clock: StageClock | null = null;
	/** ?stage-pace=20 runs the holds twenty times faster, for tests. It is read once, when the stage comes up. */
	let pace = 1;
	/** How long a mouse at rest over a scene keeps it waiting. */
	const HOVER_REST_MS = 4000;

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

	// The pause control shows Pause while the play runs or only waits by itself. A press then pauses it for the visitor.
	// Play is the visitor's own word, so it also lifts a stop for the rest of the visit.
	function toggle() {
		if (playing || held) return clock?.pause('visitor');
		stoppedThisVisit = false;
		clock?.resume();
	}

	// A step is the visitor taking over: the play stops, and Play starts it again.
	function step(delta: number) {
		stepped = true;
		stop();
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
		pace = Math.min(200, Math.max(1, Number(new URLSearchParams(window.location.search).get('stage-pace')) || 1));
		let tabHidden = document.hidden;
		let offScreen = false;
		let pointerOver = false;
		clock = new StageClock(
			scenes.map((entry) => entry.hold / pace),
			{ now: () => performance.now(), setTimer: (run, ms) => window.setTimeout(run, ms), clearTimer: (id) => window.clearTimeout(id as number) },
			{
				reduced,
				stopped: stoppedThisVisit,
				onchange: (state) => {
					if (state.index !== index) watchArrival();
					index = state.index;
					playing = state.playing;
					held = state.halt === 'hidden';
					// Once the stage has moved, the scene after the one on show is made ready a whole hold ahead.
					if (state.index > 0 || stepped) arm(state.index);
				},
			},
		);
		clock.start();

		// A hidden tab, a stage scrolled away or a mouse moving over a scene pauses the play. It resumes by itself. A pause the visitor made does not.
		const hide = () => (tabHidden || offScreen || pointerOver ? clock?.pause('hidden') : clock?.resume('hidden'));
		// A mouse that moves over a scene is reading it, a tooltip on a star for one: the scene waits.
		// It goes on when the mouse leaves, or once the mouse has been at rest for four seconds.
		let rest = 0;
		const onLeave = () => {
			window.clearTimeout(rest);
			if (!pointerOver) return;
			pointerOver = false;
			hide();
		};
		const onMove = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			window.clearTimeout(rest);
			rest = window.setTimeout(onLeave, HOVER_REST_MS / pace);
			if (pointerOver) return;
			pointerOver = true;
			hide();
		};
		scenesEl?.addEventListener('pointermove', onMove, { passive: true });
		scenesEl?.addEventListener('pointerleave', onLeave, { passive: true });
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

		// Any press, key, wheel or touch on the stage stops the play for the visit, on its controls as on its scenes.
		// The page still scrolls: nothing is cancelled. A control answers for its own press, as inputStops says.
		const inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'] as const;
		const options = { capture: true, passive: true };
		const onInput = (event: Event) => {
			const target = event.target instanceof Element ? event.target : null;
			const onControl = target?.closest('button')?.parentElement === controlsEl;
			if (inputStops({ type: event.type, key: (event as KeyboardEvent).key, onControl, inScenes: scenesEl?.contains(target) === true })) stop();
		};
		for (const name of inputs) stageEl?.addEventListener(name, onInput, options);

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
			for (const name of inputs) stageEl?.removeEventListener(name, onInput, options);
			scenesEl?.removeEventListener('pointermove', onMove);
			scenesEl?.removeEventListener('pointerleave', onLeave);
			window.clearTimeout(rest);
			cancelAnimationFrame(arrival);
			window.clearTimeout(later);
			if (idle !== undefined) window.cancelIdleCallback?.(idle);
		};
	});

	// The hub can add a scene after the page is up: the clock learns the new holds.
	$effect(() => {
		clock?.setHolds(scenes.map((entry) => entry.hold / pace));
	});

	// A device that missed the frame budget tells the page once, so the stream gives up its blur too.
	$effect(() => {
		if (still) onstill();
	});

	// A scene's arrival watches its own frames for a little over a second. A device that misses
	// the budget gets no more blur and no drift for the visit: scenes then change by a plain fade.
	// The page's own opening is not watched: a browser is busy then for reasons a blur does not cause.
	let arrival = 0;
	function watchArrival() {
		cancelAnimationFrame(arrival);
		if (still || reduced) return;
		const budget = new ArrivalBudget();
		const started = performance.now();
		let last = started;
		arrival = requestAnimationFrame(function watch(now) {
			if (budget.frame(now - last)) {
				still = true;
				return;
			}
			last = now;
			if (now - started < 1200) arrival = requestAnimationFrame(watch);
		});
	}

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
	class:arrives
	class:moving={playing || held}
	id="sky"
	tabindex="-1"
	aria-roledescription="carousel"
	aria-label="Heading"
	bind:this={stageEl}
	data-testid="home-stage"
	data-scene={scene?.id}
	data-playing={playing}
	data-still={still || reduced}
>
	<!-- The controls come first, so a keyboard reaches Pause before anything that moves. -->
	<div class="controls" role="group" aria-label="Heading scenes" bind:this={controlsEl}>
		{#if reduced}
			<button type="button" aria-label="Previous" data-tip="Previous" onclick={() => step(-1)} onkeydown={onControlKey} data-testid="stage-previous">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
			</button>
		{:else}
			<button type="button" aria-label={playing || held ? 'Pause' : 'Play'} data-tip={playing || held ? 'Pause' : 'Play'} onclick={toggle} onkeydown={onControlKey} data-testid="stage-pause">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{#if playing || held}<path d="M9 5v14M15 5v14" />{:else}<path d="M8 5l11 7-11 7z" />{/if}
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
			<div class={`scene ${entry.type}`} class:on={i === index} class:next={i === (index + 1) % scenes.length && armed[entry.id] === true} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${scenes.length}`} inert={i !== index} data-testid={`scene-${entry.type}`}>
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
	}
	/* The stage takes focus only when the link at the end of the stream brings a reader back up. It draws no ring for that. */
	.stage:focus {
		outline: none;
	}
	.scenes {
		position: relative;
		order: 1;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		container-type: size;
		--copy: min(27rem, calc(100cqw - 2 * var(--gutter)));
		/* Where the type ends, a little past its last letter. The feather holds solid up to here. */
		--copy-end: calc(var(--gutter) + var(--copy) + 1.75rem);
	}

	/*
	 * Scenes share one box, so nothing moves when one gives way to the next. The hand-off is one
	 * move: the type on show fades where it stands, the picture dissolves into a soft blur while
	 * the next comes out of one, and the new type rises into place line by line, in focus all the way.
	 * Light (a fade, a blur) takes the soft curve. Anything that travels takes the quick one.
	 */
	.scene {
		position: absolute;
		inset: 0;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.7s var(--ease-soft),
			visibility 0s linear 0.7s;
	}
	.scene.on {
		opacity: 1;
		visibility: visible;
		transition:
			opacity 1s var(--ease-soft),
			visibility 0s;
	}
	/*
	 * The scene next in line is drawn ahead of its turn, unseen, so its picture is already decoded
	 * when the hand-off starts and the two scenes truly cross. It stays inert until then.
	 */
	.scene.next {
		visibility: visible;
		will-change: opacity;
		pointer-events: none;
	}
	/* The blur is on the picture and on the sky, never on type. */
	.plate :global(img) {
		filter: blur(12px);
		transition:
			filter 0.7s var(--ease-soft),
			opacity 0.6s var(--ease-soft);
	}
	.scene.on .plate :global(img) {
		filter: none;
		transition:
			filter 1.4s var(--ease-soft),
			opacity 0.6s var(--ease-soft);
	}
	.scene.sky {
		filter: blur(12px);
		transition:
			opacity 0.7s var(--ease-soft),
			filter 0.7s var(--ease-soft),
			visibility 0s linear 0.7s;
	}
	.scene.sky.on {
		filter: none;
		transition:
			opacity 1s var(--ease-soft),
			filter 1.4s var(--ease-soft),
			visibility 0s;
	}
	/* A line of type leaves first, by fading where it stands. It arrives last, by rising a little, each line just after the one above. */
	.copy > :global(*) {
		opacity: 0;
		transform: translate3d(0, 0.9rem, 0);
		transition:
			opacity 0.25s var(--ease-soft),
			transform 0s linear 0.7s;
	}
	.scene.on .copy > :global(*) {
		opacity: 1;
		transform: none;
		transition:
			opacity 0.7s var(--ease-soft) var(--wait, 0.3s),
			transform 1s var(--ease) var(--wait, 0.3s);
	}
	.copy > :global(:nth-child(2)) {
		--wait: 0.37s;
	}
	.copy > :global(:nth-child(3)) {
		--wait: 0.44s;
	}
	.copy > :global(:nth-child(4)) {
		--wait: 0.51s;
	}
	.copy > :global(:nth-child(5)) {
		--wait: 0.58s;
	}
	.copy > :global(:nth-child(n + 6)) {
		--wait: 0.65s;
	}
	/* The first scene arrives too: out of the same soft blur, once, as the page opens. */
	.scenes {
		animation: open 1.2s var(--ease-soft);
	}
	@keyframes open {
		from {
			filter: blur(12px);
		}
	}
	/* Put into a page that has already painted, the stage fades in as well. */
	.stage.arrives .scenes {
		animation-name: open-late;
	}
	.stage.arrives .controls {
		animation: fade 0.9s var(--ease-soft) 0.2s backwards;
	}
	@keyframes open-late {
		from {
			opacity: 0;
			filter: blur(12px);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	/*
	 * A device that missed the frame budget: a plain fade with no blur and no rise. The scene on
	 * show goes first and the next comes after it, so two scenes' type never lie over each other.
	 */
	.stage.still .scenes {
		animation: none;
	}
	.stage.still .scene {
		transition:
			opacity 0.25s var(--ease-soft),
			visibility 0s linear 0.25s;
	}
	.stage.still .scene.on {
		transition:
			opacity 0.5s var(--ease-soft) 0.2s,
			visibility 0s;
	}
	.stage.still .plate :global(img),
	.stage.still .scene.sky {
		filter: none;
	}
	.stage.still .copy > :global(*) {
		opacity: 1;
		transform: none;
		transition: none;
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

	/*
	 * A photograph. It drifts like a slow camera: a few percent of scale and travel over most of a minute.
	 * A device that missed the frame budget stops the drift where it stands, so nothing jumps.
	 */
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
	.stage.moving:not(.still) .scene.on .plate :global(img) {
		animation-play-state: running;
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
	 * The heron keeps the frame the site's banner has always shown: 672 by 219, as wide as the window and never taller than that.
	 * The file is that same frame cut from the 1200 pixel photograph, so a window wider than 1200 pixels still spreads it.
	 */
	.plate.heron {
		inset: 50% 0 auto;
		height: min(100%, calc(100cqw * 219 / 672));
		translate: 0 -50%;
		/* The bird's head is at the very top of this photograph. The falloff there is a little shorter, so the head keeps its light. */
		-webkit-mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 0.5) 6%, #000 16%, #000 56%, rgb(0 0 0 / 0.7) 72%, rgb(0 0 0 / 0.3) 88%, transparent 100%);
		mask-image: linear-gradient(to bottom, transparent 0, rgb(0 0 0 / 0.5) 6%, #000 16%, #000 56%, rgb(0 0 0 / 0.7) 72%, rgb(0 0 0 / 0.3) 88%, transparent 100%);
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
		transition: text-decoration-color 0.3s var(--ease-soft);
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
		transition:
			transform 0.3s var(--ease),
			color 0.3s var(--ease-soft);
	}
	.controls button:hover svg {
		transform: scale(1.15);
		color: var(--accent);
	}
	.controls button:active svg {
		transform: scale(0.94);
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
			opacity 0.2s var(--ease-soft),
			transform 0.3s var(--ease);
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
			-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 58%, rgb(0 0 0 / 0.6) 76%, rgb(0 0 0 / 0.22) 90%, transparent 100%);
			mask-image: linear-gradient(to bottom, transparent 0, #000 12%, #000 58%, rgb(0 0 0 / 0.6) 76%, rgb(0 0 0 / 0.22) 90%, transparent 100%);
		}
		/* The frame shows a third of the photograph's width here: the part that holds the bird's head, its whole bill, its neck and the near wing. */
		.plate.heron :global(img) {
			object-position: 94% 50%;
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

	/* No motion: no blur, no fade, no rise, no drift. The scenes step by the controls. */
	@media (prefers-reduced-motion: reduce) {
		.scenes,
		.stage.arrives .scenes,
		.stage.arrives .controls {
			animation: none;
		}
		.scene,
		.scene.on,
		.scene.sky,
		.scene.sky.on,
		.plate :global(img),
		.scene.on .plate :global(img),
		.copy > :global(*),
		.scene.on .copy > :global(*) {
			transition: none;
		}
		.plate :global(img),
		.scene.sky {
			filter: none;
		}
		.copy > :global(*) {
			opacity: 1;
			transform: none;
		}
		.plate :global(img) {
			animation: none;
			transform: none;
		}
	}
</style>
