<script lang="ts">
	// The interactive half of the constellation (TIN-8628). It loads only when the
	// section nears the viewport, and draws exactly over the first-paint silhouette.
	import { onMount, tick, untrack } from 'svelte';
	import { goto, preloadData } from '$app/navigation';
	import type { Post } from '$lib/posts';
	import { buildSky, nearOf, neighborInDirection, readingOrder, type Direction } from '$lib/reader/projection/scene';
	import { Painter, glowTransform, readPalette, type Rect } from '$lib/reader/projection/paint';
	import { readSession, writeSession } from '$lib/reader/projection/session';
	import { CARD_BLOCKED, FIT, clampView, easeOut, isFit, mixView, nearestIndex, placeCard, placeTip, restoreView, starRadius, storeView, viewForBox, viewToShow, zoomAt, type Keep, type View } from '$lib/reader/projection/view';

	let {
		data,
		posts,
		field,
		view = 'map',
		filter = -1,
		focusSlug = null,
		tallQuery,
		scale = 1,
		zoomed = $bindable(false),
		picked = $bindable(false),
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
		/** Star size multiplier for this panel. The silhouette uses the same one. */
		scale?: number;
		/** True while the map is zoomed in. The shell's controls read it. */
		zoomed?: boolean;
		/** True while a star is pinned. */
		picked?: boolean;
		/** Called at the first frame. True when the canvas fades in over the silhouette. */
		onlive?: (fade: boolean) => void;
	} = $props();

	// Screen distance within which a pointer reaches a star: a 56px target for touch, 32px for a mouse.
	const MOUSE_REACH = 16;
	const TOUCH_REACH = 28;
	/** The sky fades out over this many pixels at its top. The style block repeats it. */
	const FADE = 28;
	const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

	const countText = (count: number) => `${count} ${count === 1 ? 'post' : 'posts'}`;
	/** What a name says about its constellation. The legend counts every post of the category, so a constellation that holds only some of them says so. */
	const holdsText = (members: number, all: number) => (members < all ? `${members} of ${countText(all)}` : countText(members));
	let tall = $state(false);
	const sky = $derived(buildSky(data, posts, tall));
	const order = $derived(sky ? readingOrder(sky) : []);
	const listOrder = $derived(sky ? [...sky.stars].filter((star) => filter < 0 || star.category === filter).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)) : []);
	// Only a constellation with a name has a control on the map.
	const named = $derived(sky ? sky.groups.map((group, g) => ({ group, g, holds: holdsText(group.members.length, sky.stars.filter((star) => star.category === group.category).length) })).filter(({ group }) => group.name !== '') : []);

	let stage = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let glowCanvas = $state<HTMLCanvasElement | null>(null);
	let cardEl = $state<HTMLElement | null>(null);
	let tipEl = $state<HTMLElement | null>(null);
	let namesEl = $state<HTMLDivElement | null>(null);
	let starsEl = $state<HTMLDivElement | null>(null);

	// Three ways to point at a star: the mouse is over it, the keyboard is on it, or it is pinned.
	let selected = $state(-1);
	let hover = $state(-1);
	let focused = $state(-1);
	let keyboard = $state(false);
	let lastStop = $state(-1);
	let dragging = $state(false);
	let assembled = $state(false);
	let fade = $state(false);
	let nameStop = $state(0);
	const cardStar = $derived(sky && selected >= 0 ? (sky.stars[selected] ?? null) : null);
	// The tooltip belongs to the star under the pointer, or to the one the keyboard is on. The pinned star has its card.
	const tipIdx = $derived(hover >= 0 && hover !== selected ? hover : keyboard && focused >= 0 && focused !== selected ? focused : -1);
	const tipStar = $derived(sky && tipIdx >= 0 ? (sky.stars[tipIdx] ?? null) : null);
	const tabStop = $derived(selected >= 0 ? selected : lastStop >= 0 && sky && lastStop < sky.stars.length ? lastStop : (order[0] ?? -1));

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
	let cardAt: [number, number] | null = null;
	let tipSize = { w: 0, h: 0 };
	let preloadTimer = 0;
	let settleTimer = 0;
	let selectedSlug: string | null = null;
	let namedGroup = -1;
	/** Width of each constellation name as drawn, so a name can be kept inside the panel. */
	let nameWidths: number[] = [];
	/** Where each name is this frame, as [x, y, half width], or null when it is out of view. The card keeps off them. */
	let namePlaces: Array<[number, number, number] | null> = [];
	/** How far the map may ride up so its stars come clear of the card docked at the foot of a phone. */
	let lift = 0;
	/** The height the docked card takes at the foot of a phone, with its margin. */
	let dock = 0;

	const dateText = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	const shown = (index: number) => filter < 0 || sky?.stars[index]?.category === filter;
	/** The strip at the foot of the panel that holds the legend and the controls, or the docked card. */
	const strip = () => size.h - (fieldRect.y + fieldRect.h) - 10;
	const foot = () => (tall && selected >= 0 && dock ? dock : strip());
	/** The strip at the top: the fade on a desktop, and the controls on a phone. The map fades out under both strips, so a star never lies under a control or a word. */
	const head = () => (tall ? fieldRect.y - 12 : FADE);

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
		// The card and the tooltip are placed from where the stars are in this frame.
		painter.project({ field: fieldRect, view: current });
		const leader = positionCard();
		positionTip();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		painter.draw(ctx, { size, field: fieldRect, view: current, tall, scale, strips: [head(), foot()], active: selected, hover, focus: keyboard ? focused : -1, leader, filter, group: namedGroup, intro });
		// The glows are already drawn. They only move.
		if (glowCanvas) glowCanvas.style.transform = glowTransform(current);
		// Constellation names ride on the map as real buttons. A name stays whole inside the panel while its place is in view.
		const names = namesEl?.children;
		if (names) {
			for (let i = 0; i < names.length; i += 1) {
				const group = named[i]?.group;
				if (!group) continue;
				const half = (nameWidths[i] ?? 0) / 2;
				const x = (fieldRect.x + group.x * fieldRect.w) * current.k + current.x;
				const y = (fieldRect.y + group.y * fieldRect.h) * current.k + current.y;
				const name = names[i] as HTMLElement;
				const inside = x > -half && x < size.w + half && y > head() + 6 && y < size.h - foot() + 2;
				const at = Math.min(size.w - half - 4, Math.max(half + 4, x));
				namePlaces[i] = inside ? [at, y, half] : null;
				name.style.visibility = inside ? '' : 'hidden';
				name.style.transform = `translate(${at.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
			}
		}
		const fit = isFit(current);
		if (zoomed === fit) zoomed = !fit;
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

	/**
	 * The pinned card: docked at the foot of a phone, and in free space near its star everywhere else.
	 * Returns the point of the card nearest the star when the card had to move away from it.
	 */
	function positionCard(): [number, number] | null {
		if (!cardEl || selected < 0 || !painter || !sky) return null;
		if (tall) {
			cardEl.style.transform = '';
			return null;
		}
		const { xs, ys } = painter;
		const x = xs[selected];
		const y = ys[selected];
		const keep: Keep[] = [];
		// The three nearest posts are in the card and joined to the star: they and their lines stay in view. The other joined posts matter less.
		(sky.near[selected] ?? []).forEach((index, place) => {
			const first = place < 3;
			keep.push([xs[index], ys[index], first ? CARD_BLOCKED : 12], [(x + xs[index]) / 2, (y + ys[index]) / 2, first ? 30 : 6], [x + (xs[index] - x) * 0.8, y + (ys[index] - y) * 0.8, first ? 30 : 6]);
		});
		// Every other star costs something, and a star close by costs more.
		for (let i = 0; i < xs.length; i += 1) {
			if (i !== selected) keep.push([xs[i], ys[i], Math.hypot(xs[i] - x, ys[i] - y) < 90 ? 7 : 4]);
		}
		for (const place of namePlaces) {
			if (place) for (const at of [-0.7, 0, 0.7]) keep.push([place[0] + place[2] * at, place[1], 4]);
		}
		const spot = placeCard(x, y, cardSize, [10, head(), size.w - 10, size.h - foot()], keep, cardAt);
		cardAt = spot.at;
		cardEl.style.transform = `translate(${Math.round(spot.left)}px,${Math.round(spot.top)}px)`;
		const px = Math.min(spot.left + cardSize.w, Math.max(spot.left, x));
		const py = Math.min(spot.top + cardSize.h, Math.max(spot.top, y));
		return Math.hypot(px - x, py - y) > 30 ? [px, py] : null;
	}

	/** The tooltip sits beside its star, never on it, and follows it. Of the spots beside, above and below the star it takes the one that covers the fewest stars, names and titles. */
	function positionTip() {
		if (!tipEl || tipIdx < 0 || !painter || !sky) return;
		const star = sky.stars[tipIdx];
		if (!star) return;
		const { xs, ys } = painter;
		const radius = starRadius(star.size, current.k, scale) + 5;
		// The side the star's title would take comes first, so the tooltip stands in for it.
		const want = star.label && (star.label & 3) === 1 ? -1 : 1;
		const covered = (spot: { left: number; top: number }) => {
			const right = spot.left + tipSize.w;
			const bottom = spot.top + tipSize.h;
			const within = (x: number, y: number, pad: number) => x > spot.left - 3 && x < right + 3 && y > spot.top - pad && y < bottom + pad;
			let count = 0;
			for (let i = 0; i < xs.length; i += 1) if (i !== tipIdx && within(xs[i], ys[i], 3)) count += 1;
			// A name is a line of small capitals: half its height counts as well.
			for (const place of namePlaces) if (place && [-0.7, 0, 0.7].some((at) => within(place[0] + place[2] * at, place[1], 9))) count += 2;
			// The titles of other stars, where the last frame drew them.
			const boxes = painter!.labelBoxes;
			for (let i = 0; i < boxes.length; i += 5) if (boxes[i + 4] !== tipIdx && boxes[i] < right && boxes[i + 2] > spot.left && boxes[i + 1] < bottom && boxes[i + 3] > spot.top) count += 1;
			return count;
		};
		const spot = placeTip(xs[tipIdx], ys[tipIdx], radius, tipSize, size, want, covered);
		tipEl.style.transform = `translate(${Math.round(spot.left)}px,${Math.round(spot.top)}px)`;
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
		current = clampView(next, size, lift);
		schedule();
	}

	function flyTo(target: View, ms = 520) {
		const to = clampView(target, size, lift);
		if (reduced) return setView(to);
		fly = { from: current, to, start: performance.now(), ms };
		schedule();
	}

	const worldOf = (index: number): [number, number] => {
		const star = sky!.stars[index];
		return [fieldRect.x + star.x * fieldRect.w, fieldRect.y + star.y * fieldRect.h];
	};

	/** Bring a star into the part of the map that nothing covers. */
	function reveal(index: number) {
		if (!sky?.stars[index] || !size.w) return;
		const [wx, wy] = worldOf(index);
		const target = viewToShow(current, wx, wy, size, tall ? 36 : 64, foot() + 28, lift);
		if (Math.abs(target.x - current.x) > 0.5 || Math.abs(target.y - current.y) > 0.5) flyTo(target, 320);
	}

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
		nameWidths = Array.from(namesEl?.children ?? [], (name) => (name as HTMLElement).offsetWidth);
		canvas.width = Math.round(size.w * dpr);
		canvas.height = Math.round(size.h * dpr);
		paintGlow();
		if (starsEl) {
			for (const [name, value] of Object.entries({ '--fx': fieldRect.x, '--fy': fieldRect.y, '--fw': fieldRect.w, '--fh': fieldRect.h })) starsEl.style.setProperty(name, `${value}px`);
		}
		current = stored ? clampView(restoreView(stored, size), size, lift) : current;
		// Pointers read the stars' places between frames: they are never left stale.
		painter?.project({ field: fieldRect, view: current });
		schedule();
	}

	/** Draw the glows once, for this size, theme and filter. They are soft, so one pixel per CSS pixel is enough. */
	function paintGlow() {
		if (!painter || !glowCanvas || !size.w) return;
		glowCanvas.width = Math.round(size.w);
		glowCanvas.height = Math.round(size.h);
		const glow = glowCanvas.getContext('2d');
		if (glow) painter.drawGlow(glow, size, fieldRect, scale, filter);
	}

	/** Pin a star, or with -1 let go of the pinned one. */
	function select(index: number, show = false) {
		selected = index;
		picked = index >= 0;
		cardAt = null;
		selectedSlug = sky?.stars[index]?.slug ?? null;
		writeSession({ slug: selectedSlug });
		if (!sky || index < 0) {
			// Nothing is docked any more: the map settles back into its frame.
			lift = 0;
			dock = 0;
			const back = clampView(current, size);
			if (back.y !== current.y) flyTo(back, 240);
			return schedule();
		}
		intend(index, 0);
		if (show && !tall) reveal(index);
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

	const linkOf = (index: number) => starsEl?.querySelector<HTMLAnchorElement>(`[data-star="${index}"]`) ?? null;

	/** Pin a star and put the keyboard on it: a nearby post in the card, or a link that names a post. */
	async function focusStar(index: number) {
		select(index, true);
		await tick();
		linkOf(index)?.focus({ preventScroll: true });
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
	// A click on the card, a name or a star link is not a pick. A drag or a pinch may still start on a name: only the card keeps the gesture.
	const onOverlay = (event: Event) => event.target instanceof Element && event.target.closest('.card, .names, .stars') !== null;
	const onCard = (event: Event) => event.target instanceof Element && event.target.closest('.card') !== null;
	// Two fingers on the map move and zoom it. One finger is left to the page, which scrolls.
	const onTouchMove = (event: TouchEvent) => {
		if (event.touches.length > 1 && event.cancelable) event.preventDefault();
	};

	function onPointerDown(event: PointerEvent) {
		pointerType = event.pointerType || 'mouse';
		// A reader who is touching the map is looking at it.
		inView = true;
		maybeIntro();
		if (onCard(event) || (pointerType === 'mouse' && event.button !== 0)) return;
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
			const zoom = zoomAt(pinch.view, pinch.x, pinch.y, Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, size, lift);
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
		if (event.pointerType === 'mouse') {
			// Over the card or a name the pointer is on that, not on a star.
			const index = onOverlay(event) ? -1 : starAt(event, MOUSE_REACH);
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
		// Select, then open (RM26, RM40): a second click or tap on the pinned star opens it.
		if (event.metaKey || event.ctrlKey) open(index, true);
		else if (index === selected) open(index);
		else select(index);
	}

	function onDoubleClick(event: MouseEvent) {
		if (onOverlay(event) || starAt(event, MOUSE_REACH) >= 0) return;
		const { x, y } = local(event);
		flyTo(zoomAt(current, x, y, 2, size, lift), 260);
	}

	// A plain wheel scrolls the page. Zoom needs Ctrl or Cmd, which is also what a trackpad pinch sends.
	function onWheel(event: WheelEvent) {
		if (!(event.ctrlKey || event.metaKey) || view !== 'map') return;
		event.preventDefault();
		const { x, y } = local(event);
		setView(zoomAt(current, x, y, Math.exp(-Math.max(-50, Math.min(50, event.deltaY)) * 0.012), size, lift));
	}

	/** Zoom about the middle of the map. The shell's zoom buttons call this. */
	export function zoomBy(factor: number) {
		if (size.w) flyTo(zoomAt(current, size.w / 2, (size.h - foot()) / 2, factor, size, lift), 220);
	}

	/** Back to the whole map with nothing pinned. */
	export function reset() {
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
		// The figure is framed in the part of the map above the legend, the controls or the docked card.
		const box = viewForBox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { w: size.w, h: size.h - foot() }, tall ? 44 : 96);
		flyTo(box);
	}

	function onStarKey(event: KeyboardEvent, index: number) {
		if (!sky) return;
		const direction = ARROWS[event.key];
		if (direction) {
			event.preventDefault();
			const next = neighborInDirection(sky, index, direction, fieldRect.w / (fieldRect.h || 1), shown);
			if (next >= 0) linkOf(next)?.focus({ preventScroll: true });
		} else if (event.key === 'Enter') {
			// A link this small is opened by the map, so Enter works the same in every browser.
			event.preventDefault();
			open(index, event.metaKey || event.ctrlKey);
		} else if (event.key === ' ') {
			// Space pins the star, as a click does: its card then offers Open and the nearest posts.
			event.preventDefault();
			select(selected === index ? -1 : index, true);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const target = event.key === 'Home' ? order[0] : order[order.length - 1];
			if (target !== undefined) linkOf(target)?.focus({ preventScroll: true });
		} else if (event.key === 'Escape') {
			event.preventDefault();
			if (selected >= 0) select(-1);
			else keyboard = false;
		} else if (event.key === '+' || event.key === '=') zoomBy(1.6);
		else if (event.key === '-') zoomBy(1 / 1.6);
		else if (event.key === '0') flyTo(FIT);
	}

	function onStarFocus(event: FocusEvent, index: number) {
		focused = index;
		lastStop = index;
		keyboard = (event.currentTarget as Element).matches(':focus-visible');
		// The keyboard moved on: the pin does not follow it.
		if (selected >= 0 && selected !== index) select(-1);
		intend(index, 120);
		reveal(index);
		schedule();
	}

	function onNameKey(event: KeyboardEvent, at: number) {
		const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
		if (!step || !namesEl || named.length === 0) return;
		event.preventDefault();
		nameStop = (at + step + named.length) % named.length;
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
			// The list has taken the place of the map: nothing is zoomed or pinned there.
			zoomed = false;
			live = false;
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
		// Only a new scene or a new stage runs this again: a filter or a star size repaints on its own.
		untrack(measure);
		if (started) {
			// The posts changed under the map: keep the same post selected, not the same index.
			selected = selectedSlug ? (sky.bySlug.get(selectedSlug) ?? -1) : -1;
			picked = selected >= 0;
			if (selected < 0) lift = dock = 0;
			return;
		}
		started = true;
		const session = readSession();
		current = restoreView(session.view, size);
		const wanted = focusSlug ?? session.slug;
		const index = wanted ? sky.bySlug.get(wanted) : undefined;
		if (index !== undefined) {
			selected = index;
			picked = true;
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

	// The card changed: measure it, then place it. On a phone it docks in the strip at the foot, which the stars keep clear of at rest.
	// Zoomed in, the map moves so the picked star stays in view above it.
	$effect(() => {
		void cardStar;
		if (!cardEl) return;
		cardSize = { w: cardEl.offsetWidth, h: cardEl.offsetHeight };
		if (tall && selected >= 0) {
			dock = cardSize.h + 16;
			// A card taller than the strip lets the map ride up by the difference, and only when the star needs it.
			lift = Math.max(0, dock - strip());
			reveal(selected);
		} else lift = dock = 0;
		// Placed before it is painted, from where the stars were in the last frame.
		positionCard();
		schedule();
	});

	// The tooltip changed: measure it and put it beside its star before it is painted.
	$effect(() => {
		void tipStar;
		if (!tipEl) return;
		tipSize = { w: tipEl.offsetWidth, h: tipEl.offsetHeight };
		if (painter) positionTip();
	});

	// A new size, theme or filter repaints the glows. The filter dims the glows of the other categories.
	$effect(() => {
		void filter;
		void scale;
		paintGlow();
	});

	// A filter, a hover, a focus or a pin changes what is bright.
	$effect(() => {
		void filter;
		void selected;
		void hover;
		void focused;
		void keyboard;
		void scale;
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
			aria-describedby="constellation-about"
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
			<div class="veil">
				<canvas class="glow" bind:this={glowCanvas} aria-hidden="true"></canvas>
				<canvas bind:this={canvas} aria-hidden="true"></canvas>
			</div>
			<div class="stars" bind:this={starsEl}>
				{#each sky.stars as star (star.slug)}
					<a
						href={star.href}
						data-star={star.index}
						data-slug={star.slug}
						style={`--x:${star.x};--y:${star.y}`}
						tabindex={star.index === tabStop ? 0 : -1}
						aria-label={`${star.title}. ${dateText(star.date)}, ${sky.categories[star.category].label}`}
						aria-current={star.index === selected ? 'true' : undefined}
						onfocus={(event) => onStarFocus(event, star.index)}
						onblur={() => {
							focused = -1;
							keyboard = false;
						}}
						onkeydown={(event) => onStarKey(event, star.index)}
					></a>
				{/each}
			</div>
			{#if cardStar}
				{@const near = nearOf(sky, cardStar.index).slice(0, 3)}
				<article class="card" bind:this={cardEl} data-testid="constellation-card">
					<h3>{cardStar.title}</h3>
					<p class="meta"><time datetime={cardStar.date}>{dateText(cardStar.date)}</time> · {sky.categories[cardStar.category].label}</p>
					{#if cardStar.description}<p class="summary">{cardStar.description}</p>{/if}
					<a class="open" href={cardStar.href} aria-label={`Open post: ${cardStar.title}`} data-testid="constellation-open">Open</a>
					{#if near.length > 0}
						<ul class="nearby" aria-label="Nearby posts">
							{#each near as other (other.slug)}
								<li><button type="button" style={`--dot:var(--star-${other.category % 8})`} onclick={() => void focusStar(other.index)}>{other.title}</button></li>
							{/each}
						</ul>
					{/if}
				</article>
			{/if}
			{#if tipStar}
				<!-- The star's accessible name carries the same words, so a screen reader is told once. -->
				<div class="tip" role="tooltip" bind:this={tipEl} data-testid="constellation-tip">
					<strong>{tipStar.title}</strong>
					<span>{dateText(tipStar.date)} · {sky.categories[tipStar.category].label}</span>
				</div>
			{/if}
			<div class="names veil" bind:this={namesEl} role="toolbar" aria-label="Go to a constellation" aria-orientation="horizontal">
				{#each named as { group, g, holds }, at (group.name)}
					<button
						type="button"
						tabindex={at === nameStop ? 0 : -1}
						aria-label={`${group.name}, ${holds}`}
						data-tip={holds}
						style={`--name:var(--star-${group.category % 8})`}
						onclick={(event) => onNameClick(event, g)}
						onpointerenter={() => nameGroup(g)}
						onpointerleave={() => nameGroup(-1)}
						onfocus={() => {
							nameStop = at;
							nameGroup(g);
						}}
						onblur={() => nameGroup(-1)}
						onkeydown={(event) => onNameKey(event, at)}>{group.name}</button
					>
				{/each}
			</div>
			{#if sky.unplaced.length > 0}
				<p class="unplaced">{sky.unplaced.length} newer {sky.unplaced.length === 1 ? 'post is' : 'posts are'} not on the map yet. Latest has {sky.unplaced.length === 1 ? 'it' : 'them'}.</p>
			{/if}
		</div>
	{:else}
		<ol class="list veil" aria-label="Posts on the map, newest first, each with its nearest posts" data-testid="constellation-list">
			{#each listOrder as star (star.slug)}
				<li>
					<a href={star.href}>{star.title}</a>
					<span class="meta kind" style={`--dot:var(--star-${star.category % 8})`}><time datetime={star.date}>{dateText(star.date)}</time> · {sky.categories[star.category].label}</span>
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
	/* The sky has no edge: what the map draws fades out at the top, over the same distance as FADE, and above the strip at the foot.
	   So a star that is moved under the legend or a control is not there to be read through. */
	.veil { --veil: linear-gradient(to bottom, transparent var(--veil-a, 0px), currentColor var(--veil-b, 28px), currentColor calc(100% - var(--veil-c, 4.25rem)), transparent calc(100% - var(--veil-d, 2.5rem))); -webkit-mask-image: var(--veil); mask-image: var(--veil); }
	div.veil { position: absolute; inset: 0; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
	/* The glows: drawn once, then moved by the compositor. They arrive with the names. */
	.glow { transform-origin: 0 0; will-change: transform; opacity: 0; transition: opacity .4s ease .4s; }
	.assembled .glow { opacity: 1; }

	/* Real links under the stars: one roving tab stop, placed where the canvas draws each star. */
	.stars { position: absolute; inset: 0; transform-origin: 0 0; pointer-events: none; --k: 1; }
	.stars a { position: absolute; left: calc(var(--fx, 0px) + var(--fw, 0px) * var(--x)); top: calc(var(--fy, 0px) + var(--fh, 0px) * var(--y)); width: calc(24px / var(--k)); height: calc(24px / var(--k)); translate: -50% -50%; border-radius: 50%; outline: none; }

	.names { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .35s ease .45s; }
	.assembled .names { opacity: 1; }
	.names button { position: absolute; left: 0; top: 0; padding: .3rem .45rem; pointer-events: auto; font: 600 .66rem/1 'Inter', system-ui, sans-serif; letter-spacing: .15em; text-transform: uppercase; white-space: nowrap; color: color-mix(in oklab, var(--name, var(--sky-ink)) 55%, var(--sky-ink)); text-shadow: 0 0 .3em var(--sky-paper), 0 0 .6em var(--sky-paper); cursor: pointer; transition: color .15s ease, background-color .15s ease; }
	/* A name takes the colour of its stars, drawn half way to the ink, so it reads as the legend's word and stays above 4.5 to 1 on the paper and on a glow. */
	.names button:focus-visible { color: var(--sky-ink); background: var(--sky-paper); }
	/* How many posts the constellation holds, under its name. */
	.names button::after { content: attr(data-tip); position: absolute; left: 50%; top: calc(100% + .1rem); translate: -50% 0; display: none; padding: .3rem .45rem; font: 600 .68rem/1 'Inter', system-ui, sans-serif; letter-spacing: 0; text-transform: none; text-shadow: none; color: var(--sky-paper); background: var(--sky-ink); pointer-events: none; }
	.names button:focus-visible::after { display: block; }
	/* Only a pointer that can hover: a tapped name does not keep the look. */
	@media (hover: hover) {
		.names button:hover { color: var(--sky-ink); background: color-mix(in srgb, var(--sky-paper) 70%, transparent); }
		.names button:hover::after { display: block; }
	}
	.names button:focus-visible, .card :is(a, button):focus-visible, .list a:focus-visible { outline: 2px solid var(--sky-accent); outline-offset: 2px; }

	/* The tooltip: the title, then the date and the category. It is there at once, with no fade. */
	.tip { position: absolute; left: 0; top: 0; z-index: 4; max-width: min(17rem, calc(100% - 1rem)); padding: .4rem .55rem .42rem; color: var(--sky-paper); background: var(--sky-ink); font-family: 'Inter', system-ui, sans-serif; pointer-events: none; }
	.tip strong { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: .78rem; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
	.tip span { display: block; margin-top: .18rem; font-size: .68rem; font-weight: 600; line-height: 1.2; white-space: nowrap; color: color-mix(in oklab, var(--sky-paper) 84%, var(--sky-ink)); }

	/* The pinned card is small: the title, the date and the category, one line about the post, Open, then up to three nearby posts. */
	.card { position: absolute; left: 0; top: 0; z-index: 2; width: min(15rem, calc(100% - 1.5rem)); padding: .65rem .75rem .6rem; color: var(--sky-ink); background: var(--sky-card); border: 1px solid var(--sky-line); box-shadow: 0 14px 32px -16px var(--sky-shade); user-select: text; -webkit-user-select: text; overflow-wrap: anywhere; }
	/* Inter at 600 and 700 only, the weights the home page already loads. Prose stays in the body face. */
	.card h3, .card .meta, .card .open, .card .nearby, .list .meta, .list > li > a { font-family: 'Inter', system-ui, sans-serif; font-weight: 600; }
	.card h3 { margin: 0; font-size: .88rem; font-weight: 700; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.card .meta, .list .meta { font-size: .68rem; line-height: 1.2; color: var(--sky-soft); }
	.card .meta { margin-top: .22rem; }
	.card .summary { margin-top: .3rem; font-size: .84rem; line-height: 1.28; color: var(--sky-soft); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.card .open { display: inline-flex; align-items: center; margin-top: .5rem; min-height: 1.75rem; padding: 0 .75rem; font-size: .74rem; font-weight: 700; text-decoration: none; color: var(--sky-paper); background: var(--sky-ink); }
	.card .nearby { margin-top: .5rem; padding-top: .4rem; border-top: 1px solid var(--sky-line); display: grid; grid-template-columns: minmax(0, 1fr); font-size: .72rem; }
	.card .nearby button { display: block; width: 100%; padding: .16rem 0; text-align: left; line-height: 1.3; color: inherit; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	/* Each nearby post is a star: it shows its colour. */
	.card .nearby button::before, .kind::before { content: ''; display: inline-block; width: .45rem; height: .45rem; margin-right: .4rem; border-radius: 50%; background: var(--dot); vertical-align: .05em; }
	.card .nearby button:hover { text-decoration: underline; text-underline-offset: .2em; }

	/* The list: the same posts and neighbours as the map, in the page's own column. */
	.list { --veil-c: 28px; --veil-d: 0px; position: absolute; inset: 0 0 3.5rem; margin: 0; padding: 3.25rem max(1rem, calc(100% - var(--edge, 1rem) - 46rem)) 2rem calc(var(--edge, 1rem) + 1.6rem); overflow-y: auto; display: grid; align-content: start; gap: .8rem; list-style: decimal; color: var(--sky-ink); font-size: .9rem; line-height: 1.35; overflow-wrap: anywhere; }
	.list { scrollbar-width: thin; scrollbar-color: var(--sky-line) transparent; }
	.list li::marker { font-size: .7rem; color: var(--sky-soft); }
	.list a { text-decoration: underline; text-decoration-color: var(--sky-line); text-underline-offset: .2em; }
	.list > li > a { font-size: .88rem; }
	.list .meta { display: block; margin-top: .15rem; }
	.list .near { display: block; margin-top: .15rem; font-size: .88rem; color: var(--sky-soft); }
	.empty { position: absolute; inset: 0; display: grid; place-items: center; padding: 1.5rem; text-align: center; color: var(--sky-ink); }

	.unplaced { position: absolute; left: var(--edge, 1rem); bottom: 3.6rem; max-width: calc(100% - 2 * var(--edge, 1rem)); font-size: .82rem; line-height: 1.3; color: var(--sky-soft); }
	.stage.fade canvas { animation: sky-in .25s ease both; }
	.stage.fade .glow { transition: none; }
	@keyframes sky-in { from { opacity: 0; } }

	/* The same width as TALL_QUERY in ReaderConstellation.svelte. */
	@media (max-width: 880px) {
		/* The controls lie along the top and the legend, in two rows, along the foot. */
		.veil { --veil-a: 2rem; --veil-b: 3.5rem; --veil-c: 5.25rem; --veil-d: 3.75rem; }
		.list { --veil-c: 28px; --veil-d: 0px; }
		.names button { font-size: .58rem; letter-spacing: .12em; padding: .3rem .3rem; }
		/* The pinned post docks as a slim bar in the strip at the foot, where the legend was: the title, the date and the category, and Open. */
		.card { left: .5rem; right: .5rem; top: auto; bottom: .5rem; width: auto; padding: .5rem .5rem .5rem .75rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: .75rem; align-items: center; }
		.card h3, .card .meta { grid-column: 1; }
		.card .summary { display: none; }
		.card .open { grid-column: 2; grid-row: 1 / span 2; margin: 0; min-height: 2.75rem; padding: 0 1rem; font-size: .8rem; }
		/* The nearest posts are joined to the star on the map, and a tap on one picks it. The bar stays one row. */
		.card .nearby { display: none; }
		.unplaced { left: 1rem; right: 1rem; bottom: 6rem; max-width: none; }
		.list { inset: 0 0 4.75rem; padding: 3.5rem 1rem 1.5rem 2.6rem; }
	}
	/* A narrow phone, where the legend takes three rows. The same width as in ReaderConstellation.svelte. */
	@media (max-width: 350px) {
		.veil { --veil-c: 7.25rem; --veil-d: 5.75rem; }
		.list { --veil-c: 28px; --veil-d: 0px; inset: 0 0 6.75rem; }
		.unplaced { bottom: 8rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.names, .names button, .glow { transition: none; }
		.stage.fade canvas { animation: none; }
	}
</style>
