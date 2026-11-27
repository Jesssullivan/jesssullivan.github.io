<script lang="ts">
	// A moving picture of the stream (TIN-8657, ruling RM97: "Play it, with a pause").
	// It rests as its first frame, which is all a page without scripts shows. On the screen it plays by itself,
	// and off the screen it stops. Its one control pauses it and plays it, and a pause the visitor made holds
	// until they play it again (WCAG 2.2.2). With reduced motion it never starts by itself.
	// The moving file is asked for only once the picture is on the screen and free to play.
	import { onMount } from 'svelte';
	import type { StreamImage } from '$lib/home/stream';

	let {
		image,
		href,
		name,
		style,
	}: {
		image: StreamImage;
		/** Where the picture leads: its post. */
		href: string;
		/** What the control names: the picture's own words, or its post's title. */
		name: string;
		style?: string;
	} = $props();

	let box = $state<HTMLElement | null>(null);
	let mounted = $state(false);
	let onScreen = $state(false);
	let reduced = $state(false);
	/** What the visitor asked for. Until they ask, the picture plays while it is on the screen. */
	let asked = $state<'play' | 'pause' | null>(null);
	/** True once the moving file is here and decoded, so the change from the still shows no gap. */
	let here = $state(false);

	const wanted = $derived(asked === 'play' || (asked === null && !reduced));
	const playing = $derived(wanted && onScreen && here);

	onMount(() => {
		mounted = true;
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = calm.matches;
		const onCalm = () => (reduced = calm.matches);
		calm.addEventListener('change', onCalm);
		const seen = new IntersectionObserver((entries) => (onScreen = entries[entries.length - 1].isIntersecting), { threshold: 0.4 });
		if (box) seen.observe(box);
		return () => {
			calm.removeEventListener('change', onCalm);
			seen.disconnect();
		};
	});

	$effect(() => {
		if (!wanted || !onScreen || here || !image.motion) return;
		let live = true;
		const file = new Image();
		file.src = image.motion.moving;
		void file.decode().then(
			() => live && (here = true),
			() => {},
		);
		return () => {
			live = false;
		};
	});
</script>

<span class="moving" bind:this={box} {style} data-testid="moving" data-playing={playing}>
	<a {href} tabindex="-1" aria-hidden={image.alt ? undefined : 'true'}>
		<img src={playing ? image.motion?.moving : (image.motion?.still ?? image.src)} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
	</a>
	{#if mounted}
		<button type="button" aria-label={`${wanted ? 'Pause' : 'Play'} ${name}`} data-tip={wanted ? 'Pause' : 'Play'} onclick={() => (asked = wanted ? 'pause' : 'play')} data-testid="moving-toggle">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#if wanted}<path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" />{:else}<path d="M8 5l11 7-11 7z" />{/if}
			</svg>
		</button>
	{/if}
</span>

<style>
	.moving {
		position: relative;
		display: block;
		overflow: hidden;
	}
	a,
	img {
		display: block;
		width: 100%;
		height: 100%;
	}
	img {
		object-fit: cover;
	}
	/*
	 * The control lies on the picture, at its lower left, as a video's does: the bare sign in the accent,
	 * on a feather of the page's ground that holds under the sign and then falls off into the picture.
	 */
	button {
		position: absolute;
		left: 0;
		bottom: 0;
		display: grid;
		place-items: end start;
		width: 6.5rem;
		height: 5.75rem;
		padding: 0 0 0.3rem 0.55rem;
		color: var(--accent);
		cursor: pointer;
		background: radial-gradient(
			ellipse farthest-side at 0 100%,
			color-mix(in oklch, var(--ground) 95%, transparent) 0,
			color-mix(in oklch, var(--ground) 92%, transparent) 46%,
			color-mix(in oklch, var(--ground) 74%, transparent) 58%,
			color-mix(in oklch, var(--ground) 46%, transparent) 72%,
			color-mix(in oklch, var(--ground) 18%, transparent) 87%,
			transparent 100%
		);
		transition: color 0.3s var(--ease-soft);
	}
	button:hover {
		color: var(--ink);
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -4px;
	}
	svg {
		width: 2.4rem;
		height: 2.4rem;
		margin-left: -0.5rem;
		fill: currentColor;
		transition: transform 0.3s var(--ease);
	}
	button:hover svg {
		transform: scale(1.12);
	}
	button:active svg {
		transform: scale(0.96);
	}

	/* The tooltip names the control, as every tooltip of the stream does. */
	[data-tip]::after {
		content: attr(data-tip);
		content: attr(data-tip) / '';
		position: absolute;
		left: 0.55rem;
		bottom: calc(100% - 2.1rem);
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
