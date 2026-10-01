<script lang="ts" module>
	export interface MapSelection {
		id: string;
		label: string;
	}
</script>

<script lang="ts">
	// Interactive project similarity map (R76, R80). Server render: the
	// producer's themed SVG plus a full data table, so the page is complete
	// without JavaScript or data. After mount, once the page's profile load
	// succeeds (live host, else the static copy), the SVG is swapped for the
	// interactive layers in the same box: a WebGL2 glow/edge canvas (Canvas 2D
	// fallback), an SVG overlay of focusable markers, a tooltip and legend.
	// The d3 engine is dynamically imported, so none of it ships in the layout.
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import ThemedImage from '$lib/components/ThemedImage.svelte';
	import MapLegend from './MapLegend.svelte';
	import MapTooltip from './MapTooltip.svelte';
	import { shapeFor, shapePath } from './shapes';
	import { formatDay, projectRows, type ProfileView } from '$lib/profile/view';
	import type { ProfileStatus } from '$lib/profile/profileState.svelte';
	import type { AssemblyFrame, Direction, Scene } from './mapScene';
	import type { MapLayer } from './glLayer';
	import type { MapTokens } from './themeTokens';
	import type { ZoomBehavior } from 'd3-zoom';
	import type { Selection } from 'd3-selection';

	type Mods = {
		scene: typeof import('./mapScene');
		gl: typeof import('./glLayer');
		canvas: typeof import('./canvasLayer');
		tokens: typeof import('./themeTokens');
		zoom: typeof import('d3-zoom');
		selection: typeof import('d3-selection');
	};

	let {
		view,
		status,
		source = 'prerender',
		mode = 'embed',
		svg,
		focusId = null,
		onselect,
		tableHeading = 'All public projects',
	}: {
		view: ProfileView;
		status: ProfileStatus;
		source?: string;
		mode?: 'embed' | 'full';
		svg: {
			light: string;
			dark: string;
			width: number;
			height: number;
			/** Phone-width producer chart (embed only), served under max-width: 600px. */
			compact?: { light: string; dark: string; width: number; height: number };
		};
		focusId?: string | null;
		onselect?: (selection: MapSelection | null) => void;
		tableHeading?: string;
	} = $props();

	const uid = $props.id();
	const tooltipId = `${uid}-tooltip`;
	const tableId = `${uid}-table`;
	const titleId = `${uid}-title`;

	let rows = $derived(projectRows(view));
	let categoryIndex = $derived(new Map(view.categories.map((c, i) => [c.id, i])));

	let figureEl: HTMLElement | undefined = $state();
	let stageEl: HTMLDivElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();

	let phase = $state<'static' | 'loading' | 'interactive' | 'failed'>('static');
	let layerKind = $state<'webgl2' | 'canvas2d' | 'none'>('none');
	let size = $state({ width: 0, height: 0 });
	let scene = $state.raw<Scene | null>(null);
	let frame = $state.raw<AssemblyFrame | null>(null);
	let transform = $state({ k: 1, x: 0, y: 0 });
	let hovered = $state(-1);
	let focusIdx = $state(-1);
	let showActive = $state(false);
	let legendHover = $state<string | null>(null);
	let query = $state('');
	let reducedMotion = $state(false);
	let inView = $state(false);
	let assembled = $state(false);
	let tokenVersion = $state(0);
	const hidden = new SvelteSet<string>();

	let mods = null as Mods | null;
	let layer = null as MapLayer | null;
	let tokens = null as MapTokens | null;
	let zoomBehavior = null as ZoomBehavior<HTMLDivElement, unknown> | null;
	let stageSel = null as Selection<HTMLDivElement, unknown, null, undefined> | null;
	let zoomAnim = 0;
	let assemblyStart = -1;
	let raf = 0;
	/** True while drawNow keeps scheduling itself (exposed as data-animating for tests). */
	let frameLoop = $state(false);
	let lastPointer = $state('mouse');
	let disposers: (() => void)[] = [];

	let highlight = $derived(hovered >= 0 ? hovered : showActive ? focusIdx : -1);
	let neighborSet = $derived(scene && highlight >= 0 ? new Set(scene.adjacency[highlight]) : new Set<number>());
	let matches = $derived(scene && mods && query.trim() ? mods.scene.matchNodes(scene, query) : new Set<number>());
	let searching = $derived(query.trim().length > 0);

	function isVisible(i: number): boolean {
		return !!scene && !hidden.has(scene.nodes[i].category);
	}

	function nodeState(i: number): string {
		if (!scene) return 'idle';
		if (hidden.has(scene.nodes[i].category)) return 'hidden';
		if (i === highlight) return 'near';
		if (neighborSet.has(i)) return 'neighbor';
		if (searching && matches.has(i)) return 'match';
		if (highlight >= 0 || searching) return 'dim';
		return 'idle';
	}

	function screen(i: number): [number, number] {
		const pos = frame?.positions;
		const x = pos ? pos[i * 2] : (scene?.nodes[i].x ?? 0);
		const y = pos ? pos[i * 2 + 1] : (scene?.nodes[i].y ?? 0);
		return [x * transform.k + transform.x, y * transform.k + transform.y];
	}

	function truncate(label: string, max = 40): string {
		return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
	}

	let labelSet = $derived.by((): ReadonlySet<number> => {
		if (!scene || !assembled) return new Set<number>();
		const picked: number[] = [];
		if (highlight >= 0) picked.push(highlight, ...neighborSet);
		if (searching) picked.push(...matches);
		if (transform.k >= 2.6) picked.push(...scene.nodes.map((n) => n.index));
		return new Set(picked.filter(isVisible));
	});

	/**
	 * Label boxes in screen space, highlight first, then neighbours, matches
	 * and (zoomed in) the rest. Each box is kept inside the stage (8 px
	 * margin both sides, so a phone never clips the start of a label) and a
	 * label that would overlap one already placed is skipped; the tooltip and
	 * table still carry it.
	 */
	let placedLabels = $derived.by(() => {
		if (!scene || labelSet.size === 0) return [];
		const placed: { i: number; x: number; y: number; text: string; strong: boolean }[] = [];
		const boxes: [number, number, number, number][] = [];
		const order = [...labelSet].sort((a, b) => Number(b === highlight) - Number(a === highlight));
		const margin = 8;
		for (const i of order) {
			const [nx, ny] = screen(i);
			const strong = i === highlight;
			const text = truncate(scene.nodes[i].label);
			const w = text.length * (strong ? 7 : 6.4);
			const h = strong ? 15 : 14;
			// Right of the marker when it fits, else left of it, then clamped.
			let left = nx + 10 + w > size.width - margin ? nx - 10 - w : nx + 10;
			left = Math.max(margin, Math.min(size.width - margin - w, left));
			const top = ny + 4 - h + 3;
			const box: [number, number, number, number] = [left, top, left + w, top + h];
			if (!strong && boxes.some(([a, b, c, d]) => box[0] < c && box[2] > a && box[1] < d && box[3] > b)) continue;
			boxes.push(box);
			placed.push({ i, x: left, y: ny + 4, text, strong });
		}
		return placed;
	});

	let hullPath = $derived.by(() => {
		if (!scene || !legendHover) return '';
		const cat = scene.categories.find((c) => c.id === legendHover);
		if (!cat?.hull) return '';
		return `M${cat.hull.map(([x, y]) => `${x * transform.k + transform.x} ${y * transform.k + transform.y}`).join('L')}Z`;
	});
	let hullIndex = $derived(legendHover ? (categoryIndex.get(legendHover) ?? 0) : 0);

	let tooltipNode = $derived(scene && highlight >= 0 && assembled ? scene.nodes[highlight] : null);
	let tooltipPos = $derived(tooltipNode ? screen(tooltipNode.index) : [0, 0]);
	let similarLabels = $derived(
		scene && highlight >= 0
			? scene.adjacency[highlight].filter(isVisible).map((i) => truncate(scene!.nodes[i].label, 48))
			: [],
	);
	let selectedNode = $derived(scene && showActive && focusIdx >= 0 ? scene.nodes[focusIdx] : null);

	let announcement = $derived.by(() => {
		if (phase !== 'interactive') return '';
		if (searching) return matches.size > 0 ? 'Matching projects highlighted on the map.' : 'No matching projects.';
		return '';
	});

	// ----------------------------------------------------------------- layers

	function layerAlpha(): Float32Array {
		const base = frame?.alpha;
		const n = scene?.nodes.length ?? 0;
		const out = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			let a = base ? base[i] : 1;
			if (!isVisible(i)) a = 0;
			else if (searching && !matches.has(i) && i !== highlight) a *= 0.25;
			out[i] = a;
		}
		return out;
	}

	function drawNow(now: number) {
		raf = 0;
		if (!scene || !mods) {
			frameLoop = false;
			return;
		}
		let animating = false;
		if (assemblyStart >= 0 && !assembled) {
			const f = mods.scene.assemblyFrame(scene, now - assemblyStart);
			frame = f;
			if (f.done) {
				frame = mods.scene.restingFrame(scene);
				assembled = true;
			} else animating = true;
		}
		if (layer && frame) {
			layer.render({
				transform,
				positions: frame.positions,
				alpha: layerAlpha(),
				hovered: highlight,
				time: now / 1000,
				shimmer: shimmering(),
			});
		}
		// Shimmer is hover-only: a selection (click, Tab, ?focus=) draws its
		// highlighted edges once and lets the frame loop stop.
		if (shimmering() && assembled) animating = true;
		if (animating && inView) raf = requestAnimationFrame(drawNow);
		frameLoop = raf !== 0;
	}

	function shimmering(): boolean {
		return hovered >= 0 && !reducedMotion;
	}

	function requestDraw() {
		if (!raf && phase === 'interactive') {
			raf = requestAnimationFrame(drawNow);
			frameLoop = true;
		}
	}

	$effect(() => {
		// Redraw whenever anything the canvas shows changes.
		void transform;
		void highlight;
		void hidden.size;
		void matches;
		void tokenVersion;
		void hovered;
		void inView;
		void size;
		requestDraw();
	});

	function beginAssembly() {
		if (!scene || !mods || assemblyStart >= 0) return;
		if (reducedMotion) {
			frame = mods.scene.restingFrame(scene);
			assembled = true;
			assemblyStart = 0;
		} else {
			frame = mods.scene.assemblyFrame(scene, 0);
			assemblyStart = performance.now();
		}
		requestDraw();
	}

	$effect(() => {
		// Reduced motion has nothing to animate: show the final layout at once.
		if ((inView || reducedMotion) && phase === 'interactive' && scene) beginAssembly();
	});

	function rebuild() {
		if (!mods || !stageEl) return;
		const rect = stageEl.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width));
		const height = Math.max(1, Math.round(rect.height));
		size = { width, height };
		const padding = Math.max(24, Math.min(width, height) * 0.06);
		const next = mods.scene.buildScene(view, { width, height, padding });
		scene = next;
		if (assembled || reducedMotion) frame = mods.scene.restingFrame(next);
		else if (assemblyStart >= 0) frame = mods.scene.assemblyFrame(next, performance.now() - assemblyStart);
		else frame = mods.scene.assemblyFrame(next, 0);
		if (layer) {
			layer.resize(width, height, Math.min(2, window.devicePixelRatio || 1));
			if (tokens) layer.setScene(next, tokens);
		}
		if (zoomBehavior && stageSel) {
			zoomBehavior.extent([
				[0, 0],
				[width, height],
			]);
			zoomBehavior.translateExtent([
				[-width * 0.25, -height * 0.25],
				[width * 1.25, height * 1.25],
			]);
			zoomBehavior.transform(stageSel, mods.zoom.zoomIdentity);
		}
		requestDraw();
	}

	function refreshTokens() {
		if (!mods || !figureEl) return;
		tokens = mods.tokens.readMapTokens(figureEl);
		layer?.setTokens(tokens);
		tokenVersion++;
	}

	function makeLayer(): MapLayer | null {
		if (!mods || !canvasEl) return null;
		const gl = mods.gl.createGlLayer(canvasEl, () => {
			// Lost WebGL context: swap the canvas element's role to 2D.
			layer?.destroy();
			const fresh = document.createElement('canvas');
			fresh.className = canvasEl!.className;
			fresh.setAttribute('aria-hidden', 'true');
			canvasEl!.replaceWith(fresh);
			canvasEl = fresh;
			layer = mods!.canvas.createCanvasLayer(fresh);
			layerKind = layer ? 'canvas2d' : 'none';
			rebuild();
		});
		if (gl) return gl;
		return mods.canvas.createCanvasLayer(canvasEl);
	}

	async function start() {
		if (phase === 'interactive' || phase === 'loading') return;
		phase = 'loading';
		try {
			const [sceneMod, glMod, canvasMod, tokenMod, zoomMod, selMod] = await Promise.all([
				import('./mapScene'),
				import('./glLayer'),
				import('./canvasLayer'),
				import('./themeTokens'),
				import('d3-zoom'),
				import('d3-selection'),
			]);
			mods = { scene: sceneMod, gl: glMod, canvas: canvasMod, tokens: tokenMod, zoom: zoomMod, selection: selMod };
		} catch {
			phase = 'failed';
			return;
		}
		phase = 'interactive';
		await tick();
		if (!stageEl || !canvasEl || !figureEl) return;
		tokens = mods.tokens.readMapTokens(figureEl);
		layer = makeLayer();
		layerKind = layer?.kind ?? 'none';
		setupZoom();
		rebuild();
		applyFocusParam();

		const ro = new ResizeObserver(() => {
			const r = stageEl?.getBoundingClientRect();
			if (r && (Math.round(r.width) !== size.width || Math.round(r.height) !== size.height)) rebuild();
		});
		ro.observe(stageEl);
		disposers.push(() => ro.disconnect());
		disposers.push(mods.tokens.observeTheme(refreshTokens));
	}

	function setupZoom() {
		if (!mods || !stageEl) return;
		const z = mods.zoom
			.zoom<HTMLDivElement, unknown>()
			.scaleExtent([1, 8])
			.filter((event: Event) => {
				const target = event.target as Element | null;
				if (target?.closest?.('.pm-controls, .pm-zoom, .pm-legend, input, button')) return false;
				if (event.type === 'wheel')
					return mode === 'full' || (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
				if (event.type === 'touchstart') return mode === 'full' || (event as TouchEvent).touches.length >= 2;
				if (event.type === 'mousedown') return (event as MouseEvent).button === 0;
				return !(event as MouseEvent).ctrlKey;
			})
			.on('zoom', (event) => {
				transform = { k: event.transform.k, x: event.transform.x, y: event.transform.y };
			});
		const sel = mods.selection.select(stageEl);
		sel.call(z).on('dblclick.zoom', null);
		// Embedded in a scrolling page: one finger scrolls the page, two zoom.
		stageEl.style.touchAction = mode === 'full' ? 'none' : 'pan-y';
		zoomBehavior = z;
		stageSel = sel;
	}

	/**
	 * Moves the view to k/x/y through d3-zoom (so its constraints apply),
	 * tweened over `duration` ms unless motion is reduced. Hand-rolled to keep
	 * d3-transition's typings out of the picture; d3-zoom ships it anyway.
	 */
	function zoomTo(target: { k: number; x: number; y: number }, duration = 220) {
		if (!zoomBehavior || !stageSel || !mods) return;
		const z = zoomBehavior;
		const sel = stageSel;
		const identity = mods.zoom.zoomIdentity;
		const apply = (k: number, x: number, y: number) => z.transform(sel, identity.translate(x, y).scale(k));
		cancelAnimationFrame(zoomAnim);
		if (reducedMotion || duration <= 0) {
			apply(target.k, target.x, target.y);
			return;
		}
		const from = { ...transform };
		const t0 = performance.now();
		const step = (now: number) => {
			const t = mods!.scene.easeOutCubic((now - t0) / duration);
			const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * t);
			apply(k, from.x + (target.x - from.x) * t, from.y + (target.y - from.y) * t);
			if (t < 1) zoomAnim = requestAnimationFrame(step);
		};
		zoomAnim = requestAnimationFrame(step);
	}

	function zoomBy(factor: number) {
		if (!scene) return;
		const [px, py] = highlight >= 0 ? screen(highlight) : [size.width / 2, size.height / 2];
		const k = Math.min(8, Math.max(1, transform.k * factor));
		const r = k / transform.k;
		zoomTo({ k, x: px - (px - transform.x) * r, y: py - (py - transform.y) * r });
	}

	function resetZoom() {
		zoomTo({ k: 1, x: 0, y: 0 });
	}

	function centerOn(i: number, k?: number) {
		if (!scene) return;
		const n = scene.nodes[i];
		const scale = k ?? transform.k;
		zoomTo({ k: scale, x: size.width / 2 - n.x * scale, y: size.height / 2 - n.y * scale }, k !== undefined ? 0 : 260);
	}

	function ensureInView(i: number) {
		const [x, y] = screen(i);
		const m = 36;
		if (x < m || y < m || x > size.width - m || y > size.height - m) centerOn(i);
	}

	function select(i: number) {
		if (!scene) return;
		focusIdx = i;
		showActive = i >= 0;
		const n = i >= 0 ? scene.nodes[i] : null;
		onselect?.(n ? { id: n.id, label: n.label } : null);
	}

	async function focusNode(i: number) {
		select(i);
		await tick();
		const el = stageEl?.querySelector<SVGElement>(`[data-node-index="${i}"]`);
		el?.focus({ preventScroll: true });
		ensureInView(i);
	}

	function applyFocusParam() {
		if (!scene || !focusId) return;
		const i = scene.byId.get(focusId);
		if (i === undefined) return;
		select(i);
		centerOn(i, 2.2);
	}

	// ----------------------------------------------------------------- input

	function local(e: PointerEvent | MouseEvent): [number, number] {
		const r = stageEl!.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	}

	function pick(e: PointerEvent | MouseEvent, radius: number): number {
		if (!scene || !mods) return -1;
		const [sx, sy] = local(e);
		return mods.scene.nearestNode(
			scene,
			(sx - transform.x) / transform.k,
			(sy - transform.y) / transform.k,
			radius / transform.k,
			isVisible,
		);
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerType === 'touch' || !assembled) return;
		if ((e.target as Element).closest('.pm-controls, .pm-zoom, .pm-legend')) {
			hovered = -1;
			return;
		}
		hovered = pick(e, 26);
	}

	function onPointerDown(e: PointerEvent) {
		lastPointer = e.pointerType;
	}

	function onStageClick(e: MouseEvent) {
		const target = e.target as Element;
		if (target.closest('.pm-controls, .pm-zoom, .pm-legend, .pm-node')) return;
		const i = pick(e, lastPointer === 'touch' ? 34 : 26);
		if (i < 0) {
			select(-1);
			return;
		}
		const node = scene!.nodes[i];
		if (lastPointer !== 'touch' && node.link) {
			window.open(node.link, '_blank', 'noopener');
		}
		select(i);
	}

	function onNodeClick(e: MouseEvent, i: number) {
		// Touch: the first tap selects (tooltip + panel); a second tap opens.
		if (lastPointer === 'touch' && !(showActive && focusIdx === i)) {
			e.preventDefault();
			select(i);
			return;
		}
		select(i);
	}

	function onNodeKey(e: KeyboardEvent, i: number) {
		if ((e.key === 'Enter' || e.key === ' ') && !scene?.nodes[i].link) {
			e.preventDefault();
			select(i);
		}
	}

	const ARROWS: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down',
	};

	function onGroupKey(e: KeyboardEvent) {
		// The embed's search box and legend sit inside the stage: their keys
		// (typing -, 0, arrows, Escape) belong to them, not to the map.
		if ((e.target as Element).closest('input, .pm-legend')) return;
		if (!scene || !mods) return;
		const dir = ARROWS[e.key];
		if (dir) {
			e.preventDefault();
			const from = focusIdx >= 0 ? focusIdx : firstVisible();
			const next = mods.scene.neighborInDirection(scene, from, dir, isVisible);
			if (next >= 0) void focusNode(next);
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			hovered = -1;
			showActive = false;
			query = '';
			onselect?.(null);
			return;
		}
		zoomKeys(e);
	}

	function zoomKeys(e: KeyboardEvent) {
		if (e.key === '+' || e.key === '=') {
			e.preventDefault();
			zoomBy(1.5);
		} else if (e.key === '-' || e.key === '_') {
			e.preventDefault();
			zoomBy(1 / 1.5);
		} else if (e.key === '0') {
			e.preventDefault();
			resetZoom();
		}
	}

	function firstVisible(): number {
		if (!scene) return -1;
		// Reading order: top-left first.
		let best = -1;
		let score = Infinity;
		for (const n of scene.nodes) {
			if (!isVisible(n.index)) continue;
			const s = n.y * 2 + n.x;
			if (s < score) {
				score = s;
				best = n.index;
			}
		}
		return best;
	}

	let tabIndexOwner = $derived(focusIdx >= 0 && scene && isVisible(focusIdx) ? focusIdx : firstVisible());

	function onSearchKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && scene && matches.size > 0) {
			e.preventDefault();
			const first = [...matches].find(isVisible);
			if (first !== undefined) void focusNode(first);
		} else if (e.key === 'Escape') {
			query = '';
		}
	}

	function toggleCategory(id: string) {
		if (hidden.has(id)) hidden.delete(id);
		else hidden.add(id);
		if (focusIdx >= 0 && scene && hidden.has(scene.nodes[focusIdx].category)) showActive = false;
	}

	// ----------------------------------------------------------------- mount

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = media.matches;
		const onMotion = () => {
			reducedMotion = media.matches;
			if (reducedMotion && scene && mods && !assembled) {
				frame = mods.scene.restingFrame(scene);
				assembled = true;
			}
		};
		media.addEventListener('change', onMotion);

		// Watch the stage, not the figure: the figure includes the long table.
		const io = new IntersectionObserver(
			(entries) => {
				inView = entries.some((entry) => entry.isIntersecting);
			},
			{ threshold: 0.08 },
		);
		if (stageEl) io.observe(stageEl);

		return () => {
			media.removeEventListener('change', onMotion);
			io.disconnect();
			cancelAnimationFrame(raf);
			for (const d of disposers) d();
			layer?.destroy();
			cancelAnimationFrame(zoomAnim);
			stageSel?.on('.zoom', null);
		};
	});

	$effect(() => {
		if (status === 'ready' && phase === 'static') void start();
		else if (status === 'failed' && phase === 'static') phase = 'failed';
	});

	// Live data that lands after the map is up (or a different focus) rebuilds in place.
	let seenView: ProfileView | null = null;
	$effect(() => {
		const v = view;
		if (phase !== 'interactive' || !mods) {
			seenView = v;
			return;
		}
		if (seenView !== v) {
			seenView = v;
			rebuild();
		}
	});
</script>

<figure
	bind:this={figureEl}
	class="pm pm-{mode}"
	data-testid="project-map"
	data-state={phase}
	data-layer={layerKind}
	data-source={source}
	data-motion={reducedMotion ? 'reduced' : 'full'}
	data-assembled={assembled ? 'true' : 'false'}
	data-animating={frameLoop ? 'true' : 'false'}
	aria-labelledby={titleId}
>
	<div class="pm-shell">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- The group handles keys that bubble from its focusable markers (arrows, Escape, zoom) and pointer hover/picking. -->
		<div
			class="pm-stage"
			class:pm-stage-static={phase !== 'interactive'}
			style:--pm-compact-ratio={svg.compact ? `${svg.compact.width} / ${svg.compact.height}` : null}
			bind:this={stageEl}
			role="group"
			aria-label="Project similarity map. Tab to a project; arrow keys follow similarity links; plus, minus and 0 zoom; Escape clears."
			onpointermove={onPointerMove}
			onpointerleave={() => (hovered = -1)}
			onpointerdown={onPointerDown}
			onclick={onStageClick}
			onkeydown={onGroupKey}
		>
			{#if phase !== 'interactive'}
				<ThemedImage
					lightSrc={svg.light}
					darkSrc={svg.dark}
					alt="Project similarity map: public projects positioned by t-SNE over README text, descriptions, topics and languages, colored and shaped by category. The table below lists every project."
					width={svg.width}
					height={svg.height}
					class="pm-static"
					compact={mode === 'embed' && svg.compact
						? {
								lightSrc: svg.compact.light,
								darkSrc: svg.compact.dark,
								width: svg.compact.width,
								height: svg.compact.height,
								media: '(max-width: 600px)',
							}
						: undefined}
				/>
			{:else}
				<canvas bind:this={canvasEl} class="pm-canvas" aria-hidden="true"></canvas>
				<svg class="pm-overlay" width={size.width} height={size.height} aria-hidden="false">
					{#if hullPath}
						<path d={hullPath} class="pm-hull" style="--hull: var(--pm-cat-{hullIndex % 8})" aria-hidden="true" />
					{/if}
					{#if scene && frame}
						<g class="pm-nodes">
							{#each scene.nodes as n (n.id)}
								{@const [x, y] = screen(n.index)}
								{@const st = nodeState(n.index)}
								<g transform="translate({x} {y})" opacity={frame.alpha[n.index]}>
									{#if n.link}
										<a
											href={n.link}
											target="_blank"
											rel="noopener"
											class="pm-node"
											data-node-index={n.index}
											data-repo-id={n.id}
											data-state={st}
											tabindex={n.index === tabIndexOwner ? 0 : -1}
											aria-label={`${n.label}. ${n.categoryLabel}. Opens the repository.`}
											aria-describedby={n.index === highlight ? tooltipId : undefined}
											onclick={(e) => onNodeClick(e, n.index)}
											onfocus={() => select(n.index)}
										>
											<circle r="14" class="pm-hit" />
											<path
												d={shapePath(shapeFor(n.catIndex), 5.6)}
												class="pm-mark"
												style="--c: var(--pm-cat-{n.catIndex % 8})"
											/>
										</a>
									{:else}
										<g
											class="pm-node"
											role="button"
											data-node-index={n.index}
											data-repo-id={n.id}
											data-state={st}
											tabindex={n.index === tabIndexOwner ? 0 : -1}
											aria-label={`${n.label}. ${n.categoryLabel}. No public repository link.`}
											aria-describedby={n.index === highlight ? tooltipId : undefined}
											onclick={(e) => onNodeClick(e, n.index)}
											onkeydown={(e) => onNodeKey(e, n.index)}
											onfocus={() => select(n.index)}
										>
											<circle r="14" class="pm-hit" />
											<path
												d={shapePath(shapeFor(n.catIndex), 5.6)}
												class="pm-mark pm-mark-nolink"
												style="--c: var(--pm-cat-{n.catIndex % 8})"
											/>
										</g>
									{/if}
								</g>
							{/each}
						</g>
						<g class="pm-labels" aria-hidden="true">
							{#each placedLabels as l (l.i)}
								<text x={l.x} y={l.y} class="pm-label" class:pm-label-strong={l.strong}>{l.text}</text>
							{/each}
						</g>
					{/if}
				</svg>

				<div class="pm-zoom" role="toolbar" aria-label="Zoom">
					<button type="button" onclick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
					<button type="button" onclick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
					<button type="button" onclick={resetZoom} aria-label="Reset zoom">⟲</button>
				</div>

				{#if mode === 'embed'}
					<div class="pm-controls pm-controls-top">
						<label class="sr-only" for="{uid}-search">Search projects</label>
						<input
							id="{uid}-search"
							type="search"
							class="pm-search"
							placeholder="Search projects"
							autocomplete="off"
							bind:value={query}
							onkeydown={onSearchKey}
						/>
					</div>
					<div class="pm-controls pm-controls-bottom">
						<MapLegend
							categories={view.categories}
							{hidden}
							ontoggle={toggleCategory}
							onhover={(id) => (legendHover = id)}
							onshowall={() => hidden.clear()}
							compact={size.width < 560}
						/>
					</div>
				{/if}

				<MapTooltip
					id={tooltipId}
					node={tooltipNode}
					x={tooltipPos[0]}
					y={tooltipPos[1]}
					bounds={size}
					similar={similarLabels}
					hint={tooltipNode?.link
						? lastPointer === 'touch'
							? 'Tap again to open the repository'
							: 'Click or Enter opens the repository'
						: 'No public repository link'}
				/>
			{/if}
		</div>

		{#if mode === 'full'}
			<aside class="pm-panel" aria-label="Map controls and details">
				<h2 id={titleId} class="pm-title">Project similarity</h2>
				<p class="pm-note">
					Public projects placed by t-SNE over README text, descriptions, topics and languages. Lines join each project
					to its closest matches by the same similarity. Distances are approximate; the glow shows layout density, never
					expertise.
				</p>
				{#if phase === 'interactive'}
					<label class="pm-field-label" for="{uid}-search-full">Search projects</label>
					<input
						id="{uid}-search-full"
						type="search"
						class="pm-search"
						placeholder="Label, category or language"
						autocomplete="off"
						bind:value={query}
						onkeydown={onSearchKey}
					/>
					<p class="pm-field-label">Categories</p>
					<MapLegend
						categories={view.categories}
						{hidden}
						ontoggle={toggleCategory}
						onhover={(id) => (legendHover = id)}
						onshowall={() => hidden.clear()}
					/>
					<div class="pm-detail" data-testid="map-detail">
						{#if selectedNode}
							<p class="pm-detail-label">{selectedNode.label}</p>
							<p class="pm-detail-meta">
								{selectedNode.categoryLabel}{selectedNode.languages.length
									? ` · ${selectedNode.languages.join(' · ')}`
									: ''}
							</p>
							{#if selectedNode.link}
								<a href={selectedNode.link} target="_blank" rel="noopener" class="pm-detail-link"
									>Open the repository ↗</a
								>
							{:else}
								<p class="pm-detail-meta">No public repository link.</p>
							{/if}
							{#if scene && scene.adjacency[selectedNode.index].length > 0}
								<p class="pm-field-label">Most similar</p>
								<ul class="pm-similar">
									{#each scene.adjacency[selectedNode.index].filter(isVisible) as j (j)}
										<li><button type="button" onclick={() => focusNode(j)}>{scene.nodes[j].label}</button></li>
									{/each}
								</ul>
							{/if}
						{:else}
							<p class="pm-detail-meta">Hover, tap or Tab to a project to see it here.</p>
						{/if}
					</div>
				{:else}
					<p class="pm-note">
						{phase === 'failed'
							? 'The interactive map could not load its data; the chart and table show the saved copy.'
							: 'The table below lists every project.'}
					</p>
				{/if}
				<p class="pm-fresh">
					Data fetched {formatDay(view.fetched_at.slice(0, 10))}{source === 'live'
						? ' (live)'
						: source === 'fallback'
							? ' (saved copy)'
							: ''}.
				</p>
			</aside>
		{/if}
	</div>

	{#if mode === 'embed'}
		<figcaption class="pm-caption">
			<span id={titleId}>Project similarity map.</span>
			Positions come from t-SNE over README text, descriptions, topics and languages; lines join closest matches. Distances
			are approximate and the glow shows layout density, never expertise. Data fetched
			{formatDay(view.fetched_at.slice(0, 10))}{source === 'live'
				? ' (live)'
				: source === 'fallback'
					? ' (saved copy)'
					: ''}.
		</figcaption>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>

	<div class="pm-table-wrap">
		<table class="table w-full text-sm pm-table" id={tableId} data-testid="project-table">
			<caption class="pm-table-caption">{tableHeading}</caption>
			<thead>
				<tr>
					<th scope="col" class="text-left">Project</th>
					<th scope="col" class="text-left">Category</th>
					<th scope="col" class="text-left">Languages</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr data-repo-id={row.id} data-repo-ids={row.ids.join(' ')}>
						<td>
							{#if row.links.length === 1}
								<a href={row.links[0].href} class="text-primary-500 hover:underline" target="_blank" rel="noopener"
									><span class="project-label">{row.label}</span></a
								>
							{:else}
								<span class="project-label">{row.label}</span>
								{#if row.links.length > 1}
									<!-- One row, one link per repository sharing this description. -->
									<span class="pm-row-links" data-testid="project-row-links">
										{#each row.links as link, j (link.id)}
											<a
												href={link.href}
												class="text-primary-500 hover:underline"
												target="_blank"
												rel="noopener"
												aria-label={`${row.label}, repository ${j + 1}`}>{j + 1}</a
											>
										{/each}
									</span>
								{/if}
							{/if}
						</td>
						<td class="text-surface-500 project-category">
							<svg
								width="12"
								height="12"
								viewBox="-8 -8 16 16"
								aria-hidden="true"
								class="inline-block align-[-1px] mr-1"
							>
								<path
									d={shapePath(shapeFor(categoryIndex.get(row.category) ?? 0), 5.2)}
									style="fill: var(--pm-cat-{(categoryIndex.get(row.category) ?? 0) % 8})"
								/>
							</svg>{row.categoryLabel}
						</td>
						<td class="text-surface-500">{row.languages.join(', ')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</figure>

<style>
	/*
	 * Category colours. No site theme has eight distinct hues in its own
	 * families (pride's primary and error are the same red, pine's primary
	 * and warning sit 4deg apart, trans's primary and tertiary 20deg), so a
	 * fixed family per slot always collides somewhere. Where relative colour
	 * syntax is supported (all current engines) the eight slots are the
	 * theme's primary hue stepped by 45deg at one lightness and chroma per
	 * mode: always hue-distinct, always anchored to the active theme. The
	 * fallback below uses six distinct families plus two in-palette mixes.
	 */
	.pm {
		--pm-cat-0: var(--color-primary-600);
		--pm-cat-1: var(--color-secondary-600);
		--pm-cat-2: var(--color-tertiary-600);
		--pm-cat-3: var(--color-success-600);
		--pm-cat-4: var(--color-error-600);
		--pm-cat-5: var(--color-warning-700);
		--pm-cat-6: color-mix(in oklch, var(--color-primary-600), var(--color-success-600));
		--pm-cat-7: color-mix(in oklch, var(--color-secondary-600), var(--color-tertiary-600));
		--pm-bg: var(--color-surface-50);
		--pm-panel: color-mix(in oklab, var(--color-surface-50) 86%, transparent);
		--pm-panel-solid: var(--color-surface-50);
		--pm-ink: var(--color-surface-950);
		--pm-muted: var(--color-surface-700);
		--pm-line: var(--color-surface-300);
		--pm-edge: var(--color-surface-500);
		--pm-focus: var(--color-primary-500);
		margin: 0;
	}
	:global([data-mode='dark']) .pm {
		--pm-cat-0: var(--color-primary-400);
		--pm-cat-1: var(--color-secondary-400);
		--pm-cat-2: var(--color-tertiary-400);
		--pm-cat-3: var(--color-success-400);
		--pm-cat-4: var(--color-error-400);
		--pm-cat-5: var(--color-warning-400);
		--pm-cat-6: color-mix(in oklch, var(--color-primary-400), var(--color-success-400));
		--pm-cat-7: color-mix(in oklch, var(--color-secondary-400), var(--color-tertiary-400));
		--pm-bg: var(--color-surface-950);
		--pm-panel: color-mix(in oklab, var(--color-surface-950) 84%, transparent);
		--pm-panel-solid: var(--color-surface-900);
		--pm-ink: var(--color-surface-50);
		--pm-muted: var(--color-surface-300);
		--pm-line: var(--color-surface-700);
		--pm-edge: var(--color-surface-400);
		--pm-focus: var(--color-primary-400);
	}

	@supports (color: oklch(from red l c h)) {
		.pm {
			--pm-cat-0: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 0));
			--pm-cat-1: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 45));
			--pm-cat-2: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 90));
			--pm-cat-3: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 135));
			--pm-cat-4: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 180));
			--pm-cat-5: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 225));
			--pm-cat-6: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 270));
			--pm-cat-7: oklch(from var(--color-primary-500) 0.55 0.15 calc(h + 315));
		}
		:global([data-mode='dark']) .pm {
			--pm-cat-0: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 0));
			--pm-cat-1: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 45));
			--pm-cat-2: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 90));
			--pm-cat-3: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 135));
			--pm-cat-4: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 180));
			--pm-cat-5: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 225));
			--pm-cat-6: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 270));
			--pm-cat-7: oklch(from var(--color-primary-500) 0.77 0.13 calc(h + 315));
		}
	}

	.pm-shell {
		position: relative;
	}
	.pm-stage {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: var(--pm-bg);
		border: 1px solid var(--pm-line);
		user-select: none;
		-webkit-user-select: none;
	}
	.pm-embed .pm-stage {
		/* Same box as the server-rendered SVG, so the swap never shifts layout. */
		aspect-ratio: 960 / 1226;
	}
	@media (max-width: 600px) {
		/* The phone fallback is the producer's compact chart, in its own box. */
		.pm-embed .pm-stage.pm-stage-static {
			aspect-ratio: var(--pm-compact-ratio, 960 / 1226);
		}
	}
	.pm-full .pm-shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		height: calc(100dvh - 4rem);
		min-height: 520px;
		border: 1px solid var(--pm-line);
	}
	.pm-full .pm-stage {
		height: 100%;
		border: 0;
	}
	.pm-stage :global(picture) {
		display: contents;
	}
	.pm-stage :global(.pm-static) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.pm-canvas,
	.pm-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.pm-overlay {
		overflow: visible;
	}
	.pm-hull {
		fill: var(--hull);
		fill-opacity: 0.08;
		stroke: var(--hull);
		stroke-opacity: 0.55;
		stroke-width: 22;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.pm-hit {
		fill: transparent;
	}
	.pm-node {
		cursor: pointer;
		outline: none;
		transition: opacity 160ms ease;
	}
	.pm-mark {
		fill: var(--c);
		stroke: var(--pm-bg);
		stroke-width: 1.4;
		transition: transform 160ms ease;
	}
	.pm-mark-nolink {
		fill-opacity: 0.55;
		stroke: var(--c);
	}
	.pm-node[data-state='near'] .pm-mark {
		transform: scale(1.65);
		stroke: var(--pm-ink);
		stroke-width: 1.2;
	}
	.pm-node[data-state='neighbor'] .pm-mark,
	.pm-node[data-state='match'] .pm-mark {
		transform: scale(1.25);
		stroke: var(--pm-ink);
		stroke-width: 0.9;
	}
	.pm-node[data-state='dim'] {
		opacity: 0.28;
	}
	.pm-node[data-state='hidden'] {
		display: none;
	}
	.pm-node:focus-visible .pm-hit {
		fill: none;
		stroke: var(--pm-focus);
		stroke-width: 2.5;
	}
	.pm-label {
		font-size: 11.5px;
		fill: var(--pm-ink);
		paint-order: stroke;
		stroke: var(--pm-bg);
		stroke-width: 3.5px;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.pm-label-strong {
		font-weight: 600;
		font-size: 12.5px;
	}

	.pm-zoom {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 3;
	}
	.pm-zoom button {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		font-size: 1rem;
		line-height: 1;
		background: var(--pm-panel);
		color: var(--pm-ink);
		border: 1px solid var(--pm-line);
		cursor: pointer;
	}
	.pm-zoom button:focus-visible,
	.pm-search:focus-visible,
	.pm-detail-link:focus-visible,
	.pm-similar button:focus-visible {
		outline: 2px solid var(--pm-focus);
		outline-offset: 2px;
	}
	.pm-controls {
		position: absolute;
		left: 0.6rem;
		right: 3.2rem;
		z-index: 3;
	}
	.pm-controls-top {
		top: 0.6rem;
	}
	.pm-controls-bottom {
		bottom: 0.6rem;
		right: 0.6rem;
	}
	.pm-search {
		width: min(100%, 18rem);
		padding: 0.35rem 0.55rem;
		font-size: 0.85rem;
		background: var(--pm-panel);
		color: var(--pm-ink);
		border: 1px solid var(--pm-line);
	}
	.pm-panel .pm-search {
		width: 100%;
	}

	.pm-panel {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem;
		overflow-y: auto;
		border-left: 1px solid var(--pm-line);
		background: var(--pm-panel);
		color: var(--pm-ink);
	}
	.pm-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0;
	}
	.pm-note,
	.pm-fresh,
	.pm-detail-meta {
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--pm-muted);
		margin: 0;
	}
	.pm-field-label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--pm-muted);
		margin: 0.4rem 0 0;
	}
	.pm-detail {
		border-top: 1px solid var(--pm-line);
		padding-top: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.pm-detail-label {
		font-weight: 600;
		margin: 0;
	}
	.pm-detail-link {
		color: var(--color-primary-500);
		font-size: 0.85rem;
	}
	.pm-similar {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.pm-similar button {
		text-align: left;
		font-size: 0.8rem;
		color: var(--pm-ink);
		background: none;
		border: 0;
		padding: 0.1rem 0;
		text-decoration: underline;
		text-decoration-color: var(--pm-line);
		cursor: pointer;
	}
	.pm-fresh {
		margin-top: auto;
	}
	.pm-caption {
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--pm-muted);
		margin-top: 0.5rem;
	}
	.pm-table-wrap {
		overflow-x: auto;
		margin-top: 1rem;
	}
	.pm-table-caption {
		caption-side: top;
		text-align: left;
		font-weight: 600;
		padding-bottom: 0.4rem;
	}
	.pm-row-links {
		display: inline-flex;
		gap: 0.4rem;
		margin-left: 0.4rem;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
	}
	.pm-row-links a::before {
		content: '↗';
		margin-right: 0.1rem;
	}
	.pm-table path {
		stroke: var(--pm-ink);
		stroke-width: 0.8;
	}

	@media (max-width: 1023px) {
		.pm-full .pm-shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto;
			height: auto;
			min-height: 0;
		}
		.pm-full .pm-stage {
			height: min(78dvh, 110vw);
			min-height: 360px;
		}
		.pm-panel {
			border-left: 0;
			border-top: 1px solid var(--pm-line);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pm-node,
		.pm-mark {
			transition: none;
		}
	}
</style>
