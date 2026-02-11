<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import BlobSVG from './BlobSVG.svelte';
	import { BlobPhysics } from './BlobPhysics.js';
	import { ScrollHandler } from './ScrollHandler.js';
	import type { ConvexBlob } from './types.js';

	let blobs = $state.raw<ConvexBlob[]>([]);
	let animating = $state(false);
	let prefersReducedMotion = $state(false);

	let physics: BlobPhysics;
	let scrollHandler: ScrollHandler;
	let lastTime = 0;
	let rafId: number;

	onMount(() => {
		// Respect reduced motion preference
		const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mql.matches;
		mql.addEventListener('change', (e) => {
			prefersReducedMotion = e.matches;
			if (e.matches) stopAnimation();
			else startAnimation();
		});

		if (prefersReducedMotion) return;

		const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
		physics = new BlobPhysics(isDark);
		scrollHandler = new ScrollHandler();

		blobs = physics.initializeBlobs();

		// Watch for theme changes
		const observer = new MutationObserver(() => {
			const dark = document.documentElement.getAttribute('data-mode') === 'dark';
			physics.updateTheme(dark);
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

		// Listen for scroll events
		const onWheel = (e: WheelEvent) => scrollHandler.handleScroll(e);
		window.addEventListener('wheel', onWheel, { passive: true });

		startAnimation();

		return () => {
			stopAnimation();
			observer.disconnect();
			window.removeEventListener('wheel', onWheel);
		};
	});

	function startAnimation() {
		if (animating) return;
		animating = true;
		lastTime = performance.now();
		rafId = requestAnimationFrame(animate);
	}

	function stopAnimation() {
		animating = false;
		if (rafId) cancelAnimationFrame(rafId);
	}

	function animate(timestamp: number) {
		if (!animating) return;

		const deltaTime = (timestamp - lastTime) / 1000;
		lastTime = timestamp;
		const time = timestamp / 1000;

		physics.update(deltaTime, time, scrollHandler.getStickiness(), scrollHandler.getPullForces());
		blobs = physics.getBlobs();

		rafId = requestAnimationFrame(animate);
	}
</script>

{#if browser && !prefersReducedMotion && blobs.length > 0}
	<div class="blob-background" aria-hidden="true" data-testid="blob-background">
		<BlobSVG {blobs} />
	</div>
{/if}

<style>
	.blob-background {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0.4;
		will-change: transform;
	}
</style>
