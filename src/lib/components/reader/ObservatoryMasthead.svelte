<script lang="ts">
	import { onMount } from 'svelte';
	import type { Post } from '$lib/types';
	import type { PublicPulseItem } from '@blog/pulse-core/schema';
	import { partitionLedger } from '$lib/reader/ledger';

	// The oscillating "/" masthead. State A is the site's existing heron hero
	// (identity, SSR-rendered, accessible). State B is a decorative night-sky
	// constellation whose MOTION LANGUAGE — golden-angle layout, radial-gradient
	// plumage stars, faint time-rings, tag lines, twinkle, goldfinch pulse comets,
	// slow drift — is carried over from the recovered 2026-07-03 reader IA study's
	// planetarium view (docs/design/reader-ia-study-2026-07-03.html), adapted from
	// that study's interactive full-height canvas to this decorative crossfade band.
	// State B is aria-hidden; the labelled, keyboard-native view of the same nodes
	// lives in the ConstellationSection elsewhere on the page.
	let { posts = [], pulseItems = [] }: { posts?: Post[]; pulseItems?: PublicPulseItem[] } = $props();

	// Reactive UI state. The heron identity stays the SSR/no-JS state, but the
	// constellation crossfades in at hydration (operator ruling 2026-07-15:
	// visible on load, not gated behind a dwell interval) — except under
	// reduced motion, where visitors stay on the static heron.
	let showB = $state(false); // false = heron (A), true = constellation (B)
	let paused = $state(false);
	let reduced = $state(false);
	let scrollFade = $state(1);

	let rootEl: HTMLElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();

	// Non-reactive per-instance animation state.
	let hovered = false;
	let inView = true;
	let docVisible = true;
	let dwellTimer: ReturnType<typeof setInterval> | null = null;
	let cometTimer: ReturnType<typeof setInterval> | null = null;
	let raf = 0;
	let ctx: CanvasRenderingContext2D | null = null;
	let W = 0;
	let H = 0;
	let dpr = 1;
	let cx = 0;
	let cy = 0;
	let maxRx = 0;
	let maxRy = 0;
	let drift = 0;
	let lastT = 0;

	interface Star {
		cardinal: boolean;
		distR: number;
		ang: number;
		base: number;
		bright: number;
		tw: number;
		x: number;
		y: number;
	}
	interface Comet {
		wx: number;
		wy: number;
		vx: number;
		vy: number;
		life: number;
		dur: number;
	}
	let stars: Star[] = [];
	let links: [number, number][] = [];
	let comets: Comet[] = [];

	const DWELL_MS = 14000;

	function buildModel() {
		stars = [];
		links = [];
		// Noteworthy nearest the centre (bright cardinal cores), the rest further
		// out (dim heron stars) — the study's plumage-by-tier encoding.
		const { noteworthy, lessNoteworthy, unclassified } = partitionLedger(posts);
		const timeline = [
			...noteworthy.map((p) => ({ post: p, cardinal: true })),
			...lessNoteworthy.map((p) => ({ post: p, cardinal: false })),
			...unclassified.map((p) => ({ post: p, cardinal: false })),
		];
		const GA = Math.PI * (3 - Math.sqrt(5));
		timeline.forEach((item, i) => {
			const ageRatio = i / (timeline.length - 1 + 0.0001);
			const distR = (item.cardinal ? 0.16 : 0.3) + ageRatio * 0.66;
			stars.push({
				cardinal: item.cardinal,
				distR: Math.min(distR, 0.98),
				ang: i * GA + (item.cardinal ? 0.4 : 0),
				base: item.cardinal ? 3.2 : 1.6,
				bright: item.cardinal ? 1 : 0.55,
				tw: Math.random() * Math.PI * 2,
				x: 0,
				y: 0,
			});
		});
		// Tag lines: link consecutive stars that share a post's first tag.
		const byTag: Record<string, number[]> = {};
		timeline.forEach((item, i) => {
			const tag = item.post.tags.find((t) => t.trim().length > 0);
			if (!tag) return;
			(byTag[tag.toLowerCase()] ||= []).push(i);
		});
		for (const arr of Object.values(byTag)) {
			for (let i = 1; i < arr.length; i++) links.push([arr[i - 1], arr[i]]);
		}
	}

	function layout() {
		cx = W / 2;
		cy = H / 2;
		// Fill the band on both axes: an ellipse matched to the band's own
		// aspect, instead of the earlier hard y*0.5 squish against one radius.
		maxRx = W * 0.42;
		maxRy = H * 0.42;
		for (const s of stars) {
			const a = s.ang + drift;
			s.x = cx + Math.cos(a) * s.distR * maxRx;
			s.y = cy + Math.sin(a) * s.distR * maxRy;
		}
	}

	function resize() {
		if (!canvasEl || !ctx) return;
		const rect = canvasEl.getBoundingClientRect();
		if (rect.width < 2) return;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = rect.width;
		H = rect.height;
		canvasEl.width = Math.round(W * dpr);
		canvasEl.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		layout();
		if (!raf) drawFrame(performance.now()); // keep a crisp static frame when the loop is idle
	}

	function spawnComet() {
		if (comets.length > 6 || pulseItems.length === 0) return;
		const edge = Math.random() * Math.PI * 2;
		const target = edge + Math.PI + (Math.random() - 0.5) * 1.2;
		const aspect = maxRx > 0 ? maxRy / maxRx : 1;
		comets.push({
			wx: cx + Math.cos(edge) * maxRx * 1.2,
			wy: cy + Math.sin(edge) * maxRy * 1.2,
			vx: Math.cos(target) * (1.3 + Math.random()),
			vy: Math.sin(target) * (1.3 + Math.random()) * aspect,
			life: 0,
			dur: 4200 + Math.random() * 2600,
		});
	}

	function drawFrame(now: number) {
		if (!ctx) return;
		const dt = lastT ? now - lastT : 16;
		lastT = now;
		const running = shouldRun();
		if (running) {
			drift += dt * 0.00002; // slow living-sky rotation
			layout();
		}

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRx * 1.6);
		g.addColorStop(0, 'rgba(24,40,48,0.45)');
		g.addColorStop(1, 'rgba(6,10,13,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);

		// Faint heron time-rings (centre = now, edge = older).
		ctx.strokeStyle = 'rgba(124,160,176,0.07)';
		ctx.lineWidth = 1;
		for (let rr = 0.33; rr <= 1.0; rr += 0.335) {
			ctx.beginPath();
			ctx.ellipse(cx, cy, maxRx * rr, maxRy * rr, 0, 0, Math.PI * 2);
			ctx.stroke();
		}

		// Tag (constellation) lines.
		ctx.strokeStyle = 'rgba(124,160,176,0.10)';
		ctx.lineWidth = 1;
		for (const [ai, bi] of links) {
			const a = stars[ai];
			const b = stars[bi];
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
		}

		// Goldfinch pulse comets.
		if (running) {
			for (let i = comets.length - 1; i >= 0; i--) {
				const c = comets[i];
				c.life += dt;
				const prog = c.life / c.dur;
				if (prog >= 1) {
					comets.splice(i, 1);
					continue;
				}
				c.wx += c.vx * dt * 0.06;
				c.wy += c.vy * dt * 0.06;
				const tx = c.wx - c.vx * 7;
				const ty = c.wy - c.vy * 7;
				const alpha = Math.sin(Math.min(prog, 1) * Math.PI);
				const grad = ctx.createLinearGradient(tx, ty, c.wx, c.wy);
				grad.addColorStop(0, 'rgba(201,162,39,0)');
				grad.addColorStop(1, `rgba(201,162,39,${(0.55 * alpha).toFixed(3)})`);
				ctx.strokeStyle = grad;
				ctx.lineWidth = 1.6;
				ctx.beginPath();
				ctx.moveTo(tx, ty);
				ctx.lineTo(c.wx, c.wy);
				ctx.stroke();
				ctx.fillStyle = `rgba(244,228,160,${alpha.toFixed(3)})`;
				ctx.beginPath();
				ctx.arc(c.wx, c.wy, 1.9, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// Stars: radial-gradient glow + plumage core, with a gentle twinkle.
		for (const s of stars) {
			const twinkle = running ? 0.82 + 0.18 * Math.sin(now * 0.002 + s.tw) : 1;
			const r = s.base * twinkle;
			const glowR = r * (s.cardinal ? 6 : 3.4);
			const gg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
			if (s.cardinal) gg.addColorStop(0, `rgba(200,74,56,${(0.55 * s.bright * twinkle).toFixed(3)})`);
			else gg.addColorStop(0, `rgba(124,160,176,${(0.34 * twinkle).toFixed(3)})`);
			gg.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = gg;
			ctx.beginPath();
			ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = s.cardinal ? '#F6E7CF' : '#D3DEE1';
			ctx.beginPath();
			ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = s.cardinal ? '#C24A38' : '#4E6E7D';
			ctx.beginPath();
			ctx.arc(s.x, s.y, r * 0.55, 0, Math.PI * 2);
			ctx.fill();
		}

		if (running) raf = requestAnimationFrame(drawFrame);
		else raf = 0;
	}

	// The loop only spends frames when the constellation can actually be seen:
	// its layer showing, the masthead in the viewport, and the tab visible.
	function shouldRun() {
		return !paused && !reduced && showB && inView && docVisible;
	}

	function syncLoop() {
		if (!ctx) return;
		if (shouldRun()) {
			if (raf) return;
			lastT = 0;
			if (comets.length === 0) for (let i = 0; i < 3; i++) spawnComet();
			raf = requestAnimationFrame(drawFrame);
			if (!cometTimer) cometTimer = setInterval(spawnComet, 2600);
		} else {
			stopLoop();
			// Paused-but-visible keeps a crisp static frame on the canvas.
			if (showB && inView && docVisible) drawFrame(performance.now());
		}
	}

	function stopLoop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		if (cometTimer) clearInterval(cometTimer);
		cometTimer = null;
	}

	function armDwell() {
		if (dwellTimer) clearInterval(dwellTimer);
		dwellTimer = null;
		if (reduced) return;
		dwellTimer = setInterval(() => {
			if (!paused && !hovered) {
				showB = !showB;
				syncLoop();
			}
		}, DWELL_MS);
	}

	function toggleState() {
		showB = !showB;
		armDwell(); // reset dwell so the manual choice is honoured for a full interval
		syncLoop();
	}

	function togglePause() {
		paused = !paused;
		syncLoop();
	}

	onMount(() => {
		if (!canvasEl) return;
		ctx = canvasEl.getContext('2d');
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) paused = true; // motion is off; the play button reflects it
		else showB = true; // constellation crossfades in on load (heron stays the no-JS state)

		buildModel();
		resize();
		syncLoop();
		armDwell();

		let ro: ResizeObserver | undefined;
		if (window.ResizeObserver) {
			ro = new ResizeObserver(() => resize());
			ro.observe(canvasEl);
		}

		// Frames are only spent while the masthead can actually be seen.
		let io: IntersectionObserver | undefined;
		if (window.IntersectionObserver && rootEl) {
			io = new IntersectionObserver((entries) => {
				inView = entries[0]?.isIntersecting ?? true;
				syncLoop();
			});
			io.observe(rootEl);
		}
		const onVisibility = () => {
			docVisible = !document.hidden;
			syncLoop();
		};
		document.addEventListener('visibilitychange', onVisibility);

		// Scroll-fade: same behaviour as the site hero — fade the whole masthead
		// out over its own height as the reader scrolls into the ledger.
		const naturalHeight = rootEl?.offsetHeight ?? 0;
		const onScroll = () => {
			if (!naturalHeight) return;
			scrollFade = Math.max(0, 1 - window.scrollY / naturalHeight);
		};
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			stopLoop();
			if (dwellTimer) clearInterval(dwellTimer);
			ro?.disconnect();
			io?.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('scroll', onScroll);
		};
	});
</script>

<section
	class="observatory-masthead"
	class:reduced
	bind:this={rootEl}
	style:opacity={scrollFade}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	onfocusin={() => (hovered = true)}
	onfocusout={() => (hovered = false)}
	aria-label="Trans Scend Survival"
>
	<div class="mast-ctl">
		<button
			type="button"
			aria-pressed={showB}
			aria-label={showB ? 'Show heron header' : 'Show constellation'}
			onclick={toggleState}
		>
			{showB ? '◐ heron' : '◑ constellation'}
		</button>
		<button
			type="button"
			aria-pressed={paused}
			aria-label={paused ? 'Resume masthead oscillation' : 'Pause masthead oscillation'}
			onclick={togglePause}
		>
			{reduced ? '▶ motion off' : paused ? '▶ play' : '⏸ pause'}
		</button>
	</div>

	<!-- State A: the existing heron hero, verbatim identity + assets. -->
	<div class="mast-layer" class:on={!showB}>
		<picture>
			<source srcset="/images/header.webp" type="image/webp" />
			<img
				src="/images/header.png"
				alt="Great Blue Heron"
				class="hero-banner-img"
				width="672"
				height="219"
				fetchpriority="high"
				decoding="sync"
			/>
		</picture>
		<div class="hero-banner-overlay">
			<p class="hero-banner-title text-3xl sm:text-4xl lg:text-5xl xl:text-6xl" role="banner">Trans Scend Survival</p>
			<div class="hero-banner-separator" aria-hidden="true"></div>
			<p class="hero-banner-description">
				<span class="hero-banner-description-word"
					><strong>Trans:</strong> Latin prefix implying &ldquo;across&rdquo; or &ldquo;Beyond&rdquo;, often used in gender
					nonconforming situations</span
				>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"
					><strong>Scend:</strong> Archaic word describing a strong &ldquo;surge&rdquo; or &ldquo;wave&rdquo;, originating
					with 15th century english sailors</span
				>
				<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
				<span class="hero-banner-description-word"
					><strong>Survival:</strong> 15th century english compound word describing an existence only worth transcending</span
				>
			</p>
			<p class="hero-banner-subtitle text-base sm:text-lg lg:text-xl">Jess Sullivan</p>
		</div>
	</div>

	<!-- State B: decorative constellation night render (aria-hidden). -->
	<div class="mast-layer mast-constellation" class:on={showB} aria-hidden="true">
		<canvas bind:this={canvasEl}></canvas>
		<span class="mast-honesty">deterministic layout from current category &amp; tag metadata — not an embedding</span>
	</div>
</section>

<style>
	.observatory-masthead {
		position: relative;
		overflow: hidden;
		min-height: clamp(360px, 48vh, 640px);
		background: #0e1316;
	}
	/* Inside the fixed-height band the heron must cover, not size the layer. */
	.mast-layer picture {
		display: block;
		height: 100%;
	}
	.mast-layer .hero-banner-img {
		height: 100%;
	}
	.mast-layer {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 1.4s ease;
	}
	.mast-layer.on {
		opacity: 1;
	}
	.observatory-masthead.reduced .mast-layer {
		transition: none;
	}
	.mast-constellation {
		background: radial-gradient(80% 120% at 50% 45%, rgba(24, 40, 48, 0.55), #060a0d);
	}
	.mast-constellation canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.mast-honesty {
		position: absolute;
		right: 14px;
		bottom: 10px;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.6rem;
		color: rgba(114, 124, 119, 0.9);
	}
	.mast-ctl {
		position: absolute;
		right: 12px;
		top: 12px;
		z-index: 3;
		display: flex;
		gap: 6px;
	}
	.mast-ctl button {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.62rem;
		background: rgba(20, 26, 30, 0.8);
		color: #a6ada2;
		border: 1px solid #39474f;
		border-radius: 4px;
		padding: 4px 9px;
		cursor: pointer;
	}
	.mast-ctl button:hover {
		color: #e7e1d2;
	}
	.mast-ctl button:focus-visible {
		outline: 2px solid #c9a227;
		outline-offset: 2px;
	}
</style>
