<script lang="ts">
	// The interactive half of the constellation (TIN-8628). It loads only when the
	// section nears the viewport, and draws exactly over the first-paint silhouette.
	import { onMount, tick } from 'svelte';
	import { goto, preloadData } from '$app/navigation';
	import type { Post } from '$lib/posts';
	import { buildSky, nearOf, neighborInDirection, readingOrder, type Direction } from '$lib/reader/projection/scene';
	import { Painter, glowTransform, readPalette, type Rect } from '$lib/reader/projection/paint';
	import { readSession, writeSession } from '$lib/reader/projection/session';
	import { FIT, clampView, easeOut, isFit, mixView, nearestIndex, placeCard, restoreView, storeView, viewForBox, viewToShow, zoomAt, type View } from '$lib/reader/projection/view';

	let {
		data,
		posts,
		field,
		view = 'map',
		filter = -1,
		focusSlug = null,
		tallQuery,
		tallScale,
		onlive = () => {},
	}: {
		data: unknown;
		posts: readonly Post[];
		/** The box the silhouette fills. The canvas maps stars onto the same box. */
		field: HTMLElement | null;
		view?: 'map' | 'list';
		filter?: number;
		focusSlug?: string | null;
		tallQuery: string;
		tallScale: number;
		/** Called at the first frame. True when the canvas fades in over the silhouette. */
		onlive?: (fade: boolean) => void;
	} = $props();

	// Screen distance within which a pointer reaches a star: a 56px target for touch, 32px for a mouse.
	const MOUSE_REACH = 16;
	const TOUCH_REACH = 28;
	const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

	let tall = $state(false);
	const sky = $derived(buildSky(data, posts, tall));
	const order = $derived(sky ? readingOrder(sky) : []);
	const listOrder = $derived(sky ? [...sky.stars].filter((star) => filter < 0 || star.category === filter).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)) : []);

	let stage = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let glowCanvas = $state<HTMLCanvasElement | null>(null);
	let cardEl = $state<HTMLElement | null>(null);
	let namesEl = $state<HTMLDivElement | null>(null);
	let starsEl = $state<HTMLDivElement | null>(null);

	let selected = $state(-1);
	let hover = $state(-1);
	let keyboard = $state(false);
	let zoomed = $state(false);
	let dragging = $state(false);
	let assembled = $state(false);
	let fade = $state(false);
	let nameStop = $state(0);
	const cardIdx = $derived(selected >= 0 ? selected : hover);
	const cardStar = $derived(sky && cardIdx >= 0 ? (sky.stars[cardIdx] ?? null) : null);
	const tabStop = $derived(selected >= 0 ? selected : (order[0] ?? -1));

	// Per-frame state stays out of the reactive graph: a frame is one canvas draw and a few transforms.
	let current: View = FIT;
	let size = { w: 0, h: 0 };
	let fieldRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
	let dpr = 1;
	let painter: Painter | null = null;
	let frameId = 0;
	let intro = 0;
	let introStart = 0;
	let fly: { from: View; to: View; start: number; ms: number } | null = null;
	let reduced = false;
	let live = false;
	let inView = false;
	let cardSize = { w: 0, h: 0 };
	let preloadTimer = 0;
	let settleTimer = 0;
	let selectedSlug: string | null = null;
	let namedGroup = -1;
	/** Width of each constellation name as drawn, so a name can be kept inside the panel. */
	let nameWidths: number[] = [];
	/** Height of the strip at the foot of a phone panel that holds the picked post. */
	let dock = 0;

	const dateText = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	const shown = (index: number) => filter < 0 || sky?.stars[index]?.category === filter;

	function schedule() {
		if (!frameId) frameId = requestAnimationFrame(frame);
	}

	function frame(now: number) {
		frameId = 0;
		const ctx = canvas?.getContext('2d');
		if (!ctx || !painter || !sky || !size.w) return;
		if (fly) {
			const t = Math.min(1, (now - fly.start) / fly.ms);
			current = t >= 1 ? fly.to : mixView(fly.from, fly.to, easeOut(t), size);
			if (t >= 1) fly = null;
			else schedule();
		}
		if (introStart) {
			intro = Math.min(1, (now - introStart) / 900);
			if (intro >= 1) introStart = 0;
			else schedule();
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		painter.draw(ctx, { size, field: fieldRect, view: current, tall, scale: tall ? tallScale : 1, strips: tall ? [fieldRect.y - 12, dock - 12] : [0, 0], active: cardIdx, hover, ring: keyboard && selected >= 0, filter, group: namedGroup, intro });
		// The glows are already drawn. They only move.
		if (glowCanvas) glowCanvas.style.transform = glowTransform(current);
		// Constellation names ride on the map as real buttons. A name stays whole inside the panel while its place is in view.
		const names = namesEl?.children;
		if (names) {
			for (let g = 0; g < names.length; g += 1) {
				const group = sky.groups[g];
				const half = (nameWidths[g] ?? 0) / 2;
				const x = (fieldRect.x + group.x * fieldRect.w) * current.k + current.x;
				const y = (fieldRect.y + group.y * fieldRect.h) * current.k + current.y;
				const name = names[g] as HTMLElement;
				name.style.visibility = x > -half && x < size.w + half && y > 12 && y < size.h - 12 ? '' : 'hidden';
				name.style.transform = `translate(${Math.min(size.w - half - 4, Math.max(half + 4, x)).toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
			}
		}
		positionCard();
		if (zoomed === isFit(current)) zoomed = !zoomed;
		// The link layer and the session follow once the view has been still for a moment: no style or layout work rides on a frame.
		if (!fly && !introStart) {
			clearTimeout(settleTimer);
			settleTimer = window.setTimeout(settle, 150);
		}
		if (!live) {
			live = true;
			onlive(fade);
		}
	}

	function positionCard() {
		if (!cardEl || cardIdx < 0 || !painter) return;
		const x = painter.xs[cardIdx];
		const y = painter.ys[cardIdx];
		// On a phone the card has its own strip under the map and never moves.
		if (tall) cardEl.style.transform = '';
		else {
			// Keep the card off the lines to the nearest posts.
			const near = sky?.near[cardIdx] ?? [];
			const avoid = near.length ? { x: near.reduce((sum, i) => sum + painter!.xs[i], 0) / near.length, y: near.reduce((sum, i) => sum + painter!.ys[i], 0) / near.length } : null;
			// The strip under the field holds the zoom controls: the card stays above it.
			const { left, top } = placeCard(x, y, cardSize, { w: size.w, h: fieldRect.y + fieldRect.h }, avoid);
			cardEl.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
		}
	}

	/** Once motion stops: move the link layer under the stars and remember the view. */
	function settle() {
		if (starsEl) {
			starsEl.style.transform = `translate(${current.x}px,${current.y}px) scale(${current.k})`;
			starsEl.style.setProperty('--k', String(current.k));
		}
		if (size.w) writeSession({ view: storeView(current, size) });
	}

	function setView(next: View) {
		fly = null;
		current = clampView(next, size);
		schedule();
	}

	function flyTo(target: View, ms = 520) {
		const to = clampView(target, size);
		if (reduced) return setView(to);
		fly = { from: current, to, start: performance.now(), ms };
		schedule();
	}

	const worldOf = (index: number): [number, number] => {
		const star = sky!.stars[index];
		return [fieldRect.x + star.x * fieldRect.w, fieldRect.y + star.y * fieldRect.h];
	};

	function measure() {
		if (!stage || !canvas || !field) return;
		const box = stage.getBoundingClientRect();
		const inner = field.getBoundingClientRect();
		if (!box.width || !box.height) return;
		const stored = size.w ? storeView(current, size) : null;
		size = { w: box.width, h: box.height };
		fieldRect = { x: inner.left - box.left, y: inner.top - box.top, w: inner.width, h: inner.height };
		// Two device pixels per CSS pixel is sharp on every screen, and a 3x phone then draws less than half the pixels each frame.
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		dock = tall ? size.h - (fieldRect.y + fieldRect.h) : 0;
		nameWidths = Array.from(namesEl?.children ?? [], (name) => (name as HTMLElement).offsetWidth);
		canvas.width = Math.round(size.w * dpr);
		canvas.height = Math.round(size.h * dpr);
		paintGlow();
		if (starsEl) {
			for (const [name, value] of Object.entries({ '--fx': fieldRect.x, '--fy': fieldRect.y, '--fw': fieldRect.w, '--fh': fieldRect.h })) starsEl.style.setProperty(name, `${value}px`);
		}
		current = stored ? restoreView(stored, size) : current;
		schedule();
	}

	/** Draw the glows once, for this size, theme and filter. They are soft, so one pixel per CSS pixel is enough. */
	function paintGlow() {
		if (!painter || !glowCanvas || !size.w) return;
		glowCanvas.width = Math.round(size.w);
		glowCanvas.height = Math.round(size.h);
		const glow = glowCanvas.getContext('2d');
		if (glow) painter.drawGlow(glow, size, fieldRect, tall ? tallScale : 1, filter);
	}

	function select(index: number, show = false) {
		selected = index;
		hover = -1;
		selectedSlug = sky?.stars[index]?.slug ?? null;
		writeSession({ slug: selectedSlug });
		if (!sky || index < 0) return schedule();
		intend(index, 0);
		if (show) {
			const [wx, wy] = worldOf(index);
			const target = viewToShow(current, wx, wy, size, tall ? 40 : 72, dock + 24);
			if (target.x !== current.x || target.y !== current.y) flyTo(target, 360);
		}
		schedule();
	}

	/** Focus intent: load the post's code and data ahead of the click, as a hovered link does. */
	function intend(index: number, wait: number) {
		clearTimeout(preloadTimer);
		const href = sky?.stars[index]?.href;
		if (href) preloadTimer = window.setTimeout(() => void preloadData(href).catch(() => {}), wait);
	}

	function open(index: number, newTab = false) {
		const star = sky?.stars[index];
		if (!star) return;
		if (newTab) window.open(star.href, '_blank', 'noopener');
		else void goto(star.href);
	}

	async function focusStar(index: number) {
		select(index, true);
		await tick();
		starsEl?.querySelector<HTMLAnchorElement>(`[data-star="${index}"]`)?.focus({ preventScroll: true });
	}

	// Pointers. Selection is by the nearest star, never by a hit area.
	let pointerType = 'mouse';
	// Pointers that are down, by id. Plain per-gesture state, never rendered.
	const pointers: Record<number, { x: number; y: number }> = {};
	const down = () => Object.values(pointers);
	let drag: { x: number; y: number; view: View; moved: boolean } | null = null;
	let pinch: { distance: number; x: number; y: number; view: View } | null = null;
	let suppressClick = false;

	const local = (event: { clientX: number; clientY: number }) => {
		const box = stage!.getBoundingClientRect();
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	};
	const starAt = (event: { clientX: number; clientY: number }, reach: number) => {
		if (!painter || !stage) return -1;
		const { x, y } = local(event);
		return nearestIndex(painter.xs, painter.ys, x, y, reach, shown);
	};
	// A click on the card, a name or a control is not a pick. A drag or a pinch may still start on a name: only the card and the controls keep the gesture.
	const onOverlay = (event: Event) => event.target instanceof Element && event.target.closest('.card, .names, .zoom, .stars') !== null;
	const onControl = (event: Event) => event.target instanceof Element && event.target.closest('.card, .zoom') !== null;
	// Two fingers on the map move and zoom it. One finger is left to the page, which scrolls.
	const onTouchMove = (event: TouchEvent) => {
		if (event.touches.length > 1 && event.cancelable) event.preventDefault();
	};

	function onPointerDown(event: PointerEvent) {
		pointerType = event.pointerType || 'mouse';
		// A reader who is touching the map is looking at it.
		inView = true;
		maybeIntro();
		if (onControl(event) || (pointerType === 'mouse' && event.button !== 0)) return;
		suppressClick = false;
		pointers[event.pointerId] = local(event);
		const held = down();
		if (held.length === 2) {
			const [a, b] = held;
			pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, view: current };
			drag = null;
			suppressClick = true;
		} else if (held.length === 1) {
			drag = { ...local(event), view: current, moved: false };
		}
	}

	function onPointerMove(event: PointerEvent) {
		const tracked = event.pointerId in pointers;
		if (tracked) pointers[event.pointerId] = local(event);
		const held = down();
		if (pinch && held.length === 2) {
			const [a, b] = held;
			const zoom = zoomAt(pinch.view, pinch.x, pinch.y, Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, size);
			return setView({ k: zoom.k, x: zoom.x + (a.x + b.x) / 2 - pinch.x, y: zoom.y + (a.y + b.y) / 2 - pinch.y });
		}
		if (drag && tracked) {
			const { x, y } = local(event);
			if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 5) return;
			if (!drag.moved) {
				drag.moved = true;
				suppressClick = true;
				// At rest there is nothing to pan. A touch that moves up or down never gets here: the browser scrolls the page with it.
				if (isFit(current)) return;
				dragging = true;
				stage?.setPointerCapture(event.pointerId);
			}
			if (dragging) setView({ k: drag.view.k, x: drag.view.x + x - drag.x, y: drag.view.y + y - drag.y });
			return;
		}
		if (event.pointerType === 'mouse' && !onOverlay(event)) {
			const index = starAt(event, MOUSE_REACH);
			if (index !== hover) {
				hover = index;
				if (index >= 0) intend(index, 80);
				schedule();
			}
		}
	}

	function onPointerUp(event: PointerEvent) {
		delete pointers[event.pointerId];
		const held = down();
		if (held.length < 2) pinch = null;
		if (held.length === 0) {
			drag = null;
			dragging = false;
		} else {
			// One finger left after a pinch: carry on as a pan from here.
			const [rest] = held;
			drag = { ...rest, view: current, moved: true };
			dragging = !isFit(current);
		}
	}

	function onClick(event: MouseEvent) {
		if (suppressClick || onOverlay(event)) return;
		const index = starAt(event, pointerType === 'mouse' ? MOUSE_REACH : TOUCH_REACH);
		if (index < 0) return select(-1);
		// Select, then open (RM26): a second click or tap on the selected star opens it.
		if (event.metaKey || event.ctrlKey) open(index, true);
		else if (index === selected) open(index);
		else select(index);
	}

	function onDoubleClick(event: MouseEvent) {
		if (onOverlay(event) || starAt(event, MOUSE_REACH) >= 0) return;
		const { x, y } = local(event);
		flyTo(zoomAt(current, x, y, 2, size), 260);
	}

	// A plain wheel scrolls the page. Zoom needs Ctrl or Cmd, which is also what a trackpad pinch sends.
	function onWheel(event: WheelEvent) {
		if (!(event.ctrlKey || event.metaKey) || view !== 'map') return;
		event.preventDefault();
		const { x, y } = local(event);
		setView(zoomAt(current, x, y, Math.exp(-Math.max(-50, Math.min(50, event.deltaY)) * 0.012), size));
	}

	const zoomBy = (factor: number) => flyTo(zoomAt(current, size.w / 2, size.h / 2, factor, size), 220);

	function reset() {
		select(-1);
		flyTo(FIT);
	}

	function nameGroup(g: number) {
		namedGroup = g;
		schedule();
	}

	// A name can sit close to a star. A pointer that is on a star means the star.
	function onNameClick(event: MouseEvent, g: number) {
		// The end of a drag or a pinch that began on the name is not a click on it.
		if (event.detail > 0 && suppressClick) return;
		const index = event.detail > 0 ? starAt(event, pointerType === 'mouse' ? 10 : 14) : -1;
		if (index < 0) return flyToGroup(g);
		if (index === selected) open(index, event.metaKey || event.ctrlKey);
		else select(index);
	}

	function flyToGroup(g: number) {
		if (!sky) return;
		const points = sky.groups[g].members.map(worldOf);
		if (!points.length) return;
		const xs = points.map((p) => p[0]);
		const ys = points.map((p) => p[1]);
		// On a phone the figure is framed in the part of the panel above the picked post.
		flyTo(viewForBox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { w: size.w, h: size.h - dock }, tall ? 44 : 110));
	}

	function onStarKey(event: KeyboardEvent, index: number) {
		if (!sky) return;
		const direction = ARROWS[event.key];
		if (direction) {
			event.preventDefault();
			const next = neighborInDirection(sky, index, direction, fieldRect.w / (fieldRect.h || 1), shown);
			if (next >= 0) void focusStar(next);
		} else if (event.key === 'Enter') {
			// A link this small is opened by the map, so Enter works the same in every browser.
			event.preventDefault();
			open(index, event.metaKey || event.ctrlKey);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const target = event.key === 'Home' ? order[0] : order[order.length - 1];
			if (target !== undefined) void focusStar(target);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			select(-1);
		} else if (event.key === '+' || event.key === '=') zoomBy(1.6);
		else if (event.key === '-') zoomBy(1 / 1.6);
		else if (event.key === '0') flyTo(FIT);
	}

	function onNameKey(event: KeyboardEvent, g: number) {
		const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
		if (!step || !sky || !namesEl) return;
		event.preventDefault();
		nameStop = (g + step + sky.groups.length) % sky.groups.length;
		(namesEl.children[nameStop] as HTMLElement | undefined)?.focus();
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const media = window.matchMedia(tallQuery);
		tall = media.matches;
		const onMedia = () => (tall = media.matches);
		media.addEventListener('change', onMedia);
		void document.fonts?.load("600 12px 'Inter'").then(measure);
		return () => {
			media.removeEventListener('change', onMedia);
			cancelAnimationFrame(frameId);
			clearTimeout(preloadTimer);
			clearTimeout(settleTimer);
		};
	});

	// The stage exists only in the map view, so its observers follow it.
	$effect(() => {
		const el = stage;
		if (!el) return;
		const resize = new ResizeObserver(measure);
		resize.observe(el);
		el.addEventListener('wheel', onWheel, { passive: false });
		el.addEventListener('touchmove', onTouchMove, { passive: false });
		// A theme or mode switch changes the tokens: read them again and repaint.
		const themes = new MutationObserver(() => {
			const palette = sky && readPalette(el, sky.categories.length);
			if (painter && palette) painter.setPalette(palette);
			paintGlow();
			schedule();
		});
		themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
		const seen = new IntersectionObserver(
			(entries) => {
				// Several changes can arrive at once. Only the latest one is true now.
				inView = entries[entries.length - 1].isIntersecting;
				maybeIntro();
			},
			{ threshold: 0.3 },
		);
		seen.observe(el);
		return () => {
			resize.disconnect();
			themes.disconnect();
			seen.disconnect();
			el.removeEventListener('wheel', onWheel);
			el.removeEventListener('touchmove', onTouchMove);
		};
	});

	// The sky assembles once per session, the first time it is on screen. Until then it stays as the silhouette.
	function maybeIntro() {
		if (!started || !inView || intro > 0 || introStart) return;
		writeSession({ seen: true });
		introStart = performance.now();
		assembled = true;
		schedule();
	}

	// A new scene (first load, a phone turned, posts arriving): rebuild the painter and restore the session.
	let started = false;
	$effect(() => {
		if (!sky || !stage || view !== 'map') return;
		if (painter) painter.setSky(sky);
		else {
			// A browser that cannot give the colours keeps the silhouette as the map.
			const palette = readPalette(stage, sky.categories.length);
			if (!palette) return;
			painter = new Painter(sky, palette);
		}
		measure();
		if (started) {
			// The posts changed under the map: keep the same post selected, not the same index.
			selected = selectedSlug ? (sky.bySlug.get(selectedSlug) ?? -1) : -1;
			return;
		}
		started = true;
		const session = readSession();
		current = restoreView(session.view, size);
		const wanted = focusSlug ?? session.slug;
		const index = wanted ? sky.bySlug.get(wanted) : undefined;
		if (index !== undefined) {
			selected = index;
			selectedSlug = sky.stars[index].slug;
		}
		if (session.seen || reduced || !isFit(current)) {
			// Seen before, or no motion wanted: the finished sky, faded in over the silhouette.
			intro = 1;
			assembled = true;
			fade = !reduced;
		} else maybeIntro();
		schedule();
	});

	// ?focus=<slug> opens the map on that post once.
	let appliedFocus: string | null = null;
	$effect(() => {
		if (!sky || !focusSlug || appliedFocus === focusSlug || view !== 'map') return;
		const index = sky.bySlug.get(focusSlug);
		if (index === undefined) return;
		appliedFocus = focusSlug;
		void focusStar(index);
	});

	// The card changed: measure it, then place it in the same frame.
	$effect(() => {
		void cardStar;
		void selected;
		if (!cardEl) return;
		cardSize = { w: cardEl.offsetWidth, h: cardEl.offsetHeight };
		positionCard();
	});

	// The filter dims the glows of the other categories.
	$effect(() => {
		void filter;
		paintGlow();
	});

	// A filter, a hover or a selection changes what is bright.
	$effect(() => {
		void filter;
		void selected;
		void hover;
		void keyboard;
		schedule();
	});
</script>

{#if sky && sky.stars.length > 0}
	{#if view === 'map'}
		<!-- Pointers pick the nearest star (TIN-8628). Keyboard users get one roving tab stop on the star links. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<div
			bind:this={stage}
			class="stage"
			class:zoomed
			class:dragging
			class:assembled
			class:fade
			class:pointing={hover >= 0}
			role="group"
			aria-label="Map of posts"
			aria-describedby="constellation-lede"
			data-testid="constellation-map"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onpointerleave={() => {
				if (hover >= 0) hover = -1;
			}}
			onclick={onClick}
			ondblclick={onDoubleClick}
		>
			<canvas class="glow" bind:this={glowCanvas} aria-hidden="true"></canvas>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
			<div class="stars" bind:this={starsEl}>
				{#each sky.stars as star (star.slug)}
					<a
						href={star.href}
						data-star={star.index}
						data-slug={star.slug}
						style={`--x:${star.x};--y:${star.y}`}
						tabindex={star.index === tabStop ? 0 : -1}
						aria-label={`${star.title}. ${sky.categories[star.category].label}, ${dateText(star.date)}`}
						aria-current={star.index === selected ? 'true' : undefined}
						onfocus={(event) => {
							keyboard = event.currentTarget.matches(':focus-visible');
							if (selected !== star.index) select(star.index, true);
						}}
						onblur={() => (keyboard = false)}
						onkeydown={(event) => onStarKey(event, star.index)}
					></a>
				{/each}
			</div>
			{#if cardStar}
				{@const category = sky.categories[cardStar.category]}
				{@const near = nearOf(sky, cardStar.index).slice(0, 3)}
				<article class="card" class:pinned={selected === cardStar.index} bind:this={cardEl} data-testid="constellation-card">
					<p class="meta">
						<span class="chip" style={`--chip:var(--star-${cardStar.category % 8})`}>{category.label}</span>
						<time datetime={cardStar.date}>{dateText(cardStar.date)}</time>
					</p>
					<h3>{cardStar.title}</h3>
					{#if cardStar.description}<p class="summary">{cardStar.description}</p>{/if}
					{#if selected === cardStar.index}
						<a class="open" href={cardStar.href} aria-label={`Open post: ${cardStar.title}`} data-testid="constellation-open">Open <span aria-hidden="true">→</span></a>
						{#if near.length > 0}
							<div class="nearby">
								<span id="constellation-nearby">Nearby</span>
								<ul aria-labelledby="constellation-nearby">
									{#each near as other (other.slug)}
										<li><button type="button" onclick={() => void focusStar(other.index)}>{other.title}</button></li>
									{/each}
								</ul>
							</div>
						{/if}
					{/if}
				</article>
			{/if}
			<div class="names" bind:this={namesEl} role="toolbar" aria-label="Constellations" aria-orientation="horizontal">
				{#each sky.groups as group, g (group.name)}
					<button type="button" tabindex={g === nameStop ? 0 : -1} aria-label={`Go to ${group.name}`} onclick={(event) => onNameClick(event, g)}
						onpointerenter={() => nameGroup(g)}
						onpointerleave={() => nameGroup(-1)}
						onfocus={() => {
							nameStop = g;
							nameGroup(g);
						}}
						onblur={() => nameGroup(-1)}
						onkeydown={(event) => onNameKey(event, g)}>{group.name}</button
					>
				{/each}
			</div>
			{#if sky.unplaced.length > 0}
				<p class="unplaced">{sky.unplaced.length} newer {sky.unplaced.length === 1 ? 'post is' : 'posts are'} not on the map yet. Latest has {sky.unplaced.length === 1 ? 'it' : 'them'}.</p>
			{:else if !cardStar}
				<p class="hint">Tap a star to see its post here.</p>
			{/if}
			<div class="zoom" role="group" aria-label="Zoom">
				<button type="button" aria-label="Zoom in" onclick={() => zoomBy(1.6)}>+</button>
				<button type="button" aria-label="Zoom out" disabled={!zoomed} onclick={() => zoomBy(1 / 1.6)}>−</button>
				<button type="button" class="reset" disabled={!zoomed && selected < 0} onclick={reset}>Reset</button>
			</div>
		</div>
	{:else}
		<ol class="list" aria-label="Posts on the map, newest first, each with its nearest posts" data-testid="constellation-list">
			{#each listOrder as star (star.slug)}
				<li>
					<a href={star.href}>{star.title}</a>
					<span class="meta"><span class="chip" style={`--chip:var(--star-${star.category % 8})`}>{sky.categories[star.category].label}</span><time datetime={star.date}>{dateText(star.date)}</time></span>
					{#if nearOf(sky, star.index).length > 0}
						<span class="near">Nearby: {#each nearOf(sky, star.index) as other, i (other.slug)}{i > 0 ? ', ' : ''}<a href={other.href}>{other.title}</a>{/each}</span>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
{:else if sky}
	<p class="empty">No public post is on the map yet. The Latest and Archive lists below have every public post.</p>
{/if}

<style>
	/* One finger scrolls the page, at rest and zoomed in. The map takes a sideways drag and two fingers. */
	.stage { position: absolute; inset: 0; overflow: hidden; touch-action: pan-y; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
	.stage.zoomed { cursor: grab; }
	.stage.dragging { cursor: grabbing; }
	.stage.pointing { cursor: pointer; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
	/* The glows: drawn once, then moved by the compositor. They arrive with the names. */
	.glow { transform-origin: 0 0; will-change: transform; opacity: 0; transition: opacity .4s ease .4s; }
	.assembled .glow { opacity: 1; }

	/* Real links under the stars: one roving tab stop, placed where the canvas draws each star. */
	.stars { position: absolute; inset: 0; transform-origin: 0 0; pointer-events: none; --k: 1; }
	.stars a { position: absolute; left: calc(var(--fx, 0px) + var(--fw, 0px) * var(--x)); top: calc(var(--fy, 0px) + var(--fh, 0px) * var(--y)); width: calc(24px / var(--k)); height: calc(24px / var(--k)); translate: -50% -50%; border-radius: 50%; outline: none; }

	.names { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .35s ease .45s; }
	.assembled .names { opacity: 1; }
	.names button { position: absolute; left: 0; top: 0; padding: .3rem .45rem; pointer-events: auto; font: 600 .66rem/1 'Inter', system-ui, sans-serif; letter-spacing: .15em; text-transform: uppercase; white-space: nowrap; color: color-mix(in oklab, var(--sky-ink) 92%, var(--sky-paper)); text-shadow: 0 0 .3em var(--sky-paper), 0 0 .6em var(--sky-paper); cursor: pointer; transition: color .15s ease, background-color .15s ease; }
	/* A name can sit on a glow, which lightens the night behind it: near full ink and a halo of paper keep it above 4.5 to 1. */
	.names button:focus-visible { color: var(--sky-ink); background: var(--sky-paper); }
	/* Only a pointer that can hover: a tapped name does not keep the look. */
	@media (hover: hover) {
		.names button:hover { color: var(--sky-ink); background: color-mix(in srgb, var(--sky-paper) 70%, transparent); }
	}
	.names button:focus-visible, .zoom button:focus-visible, .card :is(a, button):focus-visible, .list a:focus-visible { outline: 2px solid var(--sky-accent); outline-offset: 2px; }

	.zoom { position: absolute; right: .75rem; bottom: .75rem; z-index: 1; display: flex; gap: .35rem; font: 600 .78rem/1 'Inter', system-ui, sans-serif; }
	/* Solid, so a star that passes under a control does not show through it. */
	.zoom button { min-width: 2.25rem; height: 2.25rem; padding: 0 .6rem; color: var(--sky-ink); background: var(--sky-paper); border: 1px solid var(--sky-line); cursor: pointer; }
	.zoom button:hover:not(:disabled) { border-color: var(--sky-soft); }
	.zoom button:disabled { color: color-mix(in srgb, var(--sky-ink) 38%, var(--sky-paper)); cursor: default; }

	/* A compact card beside the star: the category, the date, the title, one line about it, Open, then the nearest posts. */
	.card { position: absolute; left: 0; top: 0; z-index: 2; width: min(16.5rem, calc(100% - 1.5rem)); padding: .7rem .85rem .75rem; color: var(--sky-ink); background: var(--sky-card); border: 1px solid var(--sky-line); box-shadow: 0 18px 40px -18px var(--sky-shade); pointer-events: none; user-select: text; -webkit-user-select: text; overflow-wrap: anywhere; }
	/* Inter at 600 and 700 only, the weights the home page already loads. Prose stays in the body face. */
	.card .meta, .card h3, .card .open, .card .nearby, .list .meta, .list > li > a, .hint { font-family: 'Inter', system-ui, sans-serif; font-weight: 600; }
	.card.pinned { pointer-events: auto; }
	.card .meta, .list .meta { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .6rem; font-size: .7rem; line-height: 1.2; color: var(--sky-soft); }
	.chip { display: inline-flex; align-items: center; gap: .35rem; font-size: .7rem; font-weight: 600; letter-spacing: .04em; color: var(--sky-ink); }
	.chip::before { content: ''; width: .55rem; height: .55rem; border-radius: 50%; background: var(--chip); }
	.card h3 { margin: .35rem 0 0; font-size: .95rem; font-weight: 700; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.card .summary { margin-top: .2rem; font-size: .88rem; line-height: 1.3; color: var(--sky-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card .open { display: inline-flex; align-items: center; gap: .3rem; margin-top: .55rem; min-height: 2rem; padding: 0 .8rem; font-size: .8rem; font-weight: 700; text-decoration: none; color: var(--sky-paper); background: var(--sky-ink); }
	.card .nearby { margin-top: .6rem; padding-top: .5rem; border-top: 1px solid var(--sky-line); font-size: .74rem; }
	.card .nearby > span { flex: none; font-size: .62rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; color: var(--sky-soft); }
	.card .nearby ul { margin-top: .2rem; display: grid; grid-template-columns: minmax(0, 1fr); }
	.card .nearby button { display: block; width: 100%; padding: .16rem 0; text-align: left; line-height: 1.3; color: inherit; text-decoration: underline; text-decoration-color: var(--sky-line); text-underline-offset: .2em; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card .nearby button:hover { text-decoration-color: currentColor; }

	.list { position: absolute; inset: 0; margin: 0; padding: 2.75rem 1.25rem 1.25rem 3rem; overflow-y: auto; display: grid; align-content: start; gap: .8rem; list-style: decimal; color: var(--sky-ink); font-size: .9rem; line-height: 1.35; overflow-wrap: anywhere; }
	.list li::marker { font-size: .7rem; color: var(--sky-soft); }
	.list a { text-decoration: underline; text-decoration-color: var(--sky-line); text-underline-offset: .2em; }
	.list > li > a { font-size: .88rem; }
	.list .meta { margin-top: .15rem; }
	.list .near { display: block; margin-top: .15rem; font-size: .88rem; color: var(--sky-soft); }
	.empty { position: absolute; inset: 0; display: grid; place-items: center; padding: 1.5rem; text-align: center; color: var(--sky-ink); }

	.unplaced { position: absolute; left: 1rem; bottom: .9rem; max-width: calc(100% - 13rem); font-size: .82rem; line-height: 1.3; color: var(--sky-soft); }
	.hint { display: none; }
	.stage.fade canvas { animation: sky-in .25s ease both; }
	.stage.fade .glow { transition: none; }
	@keyframes sky-in { from { opacity: 0; } }

	/* The same width as TALL_QUERY in ReaderConstellation.svelte. */
	@media (max-width: 720px) {
		.names button { font-size: .58rem; letter-spacing: .12em; padding: .3rem .3rem; }
		/* Controls above the map, the picked post in its own strip below it: the card covers no star at rest. */
		.zoom { left: .5rem; right: auto; top: .4rem; bottom: auto; }
		.zoom button { min-width: 2.75rem; height: 2.75rem; }
		.card { left: .5rem; right: .5rem; top: auto; bottom: .5rem; width: auto; padding: .6rem .75rem .65rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: .75rem; align-items: center; }
		.card .meta, .card .nearby { grid-column: 1 / -1; }
		.card h3 { margin: .25rem 0 0; }
		.card .summary { display: none; }
		.card .open { margin-top: .25rem; min-height: 2.75rem; padding: 0 1rem; }
		.card .nearby { margin-top: .5rem; padding-top: .45rem; display: flex; align-items: center; gap: .6rem; min-width: 0; }
		/* The nearest posts sit in one row that scrolls sideways and fades out where more follows. */
		.card .nearby ul { margin: 0; display: flex; gap: .4rem; min-width: 0; overflow-x: auto; scrollbar-width: none; mask-image: linear-gradient(to right, currentColor calc(100% - 1.5rem), transparent); }
		.card .nearby li { flex: none; max-width: 11rem; }
		.card .nearby button { min-height: 2.75rem; padding: 0 .65rem; text-decoration: none; border: 1px solid var(--sky-line); }
		.unplaced, .hint { position: absolute; left: .9rem; right: .9rem; bottom: 4.4rem; max-width: none; text-align: center; }
		.hint { display: block; font-size: .7rem; letter-spacing: .04em; color: var(--sky-soft); }
		.list { padding: 3.5rem 1rem 1rem 2.5rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.names, .names button, .glow { transition: none; }
		.stage.fade canvas { animation: none; }
	}
</style>
