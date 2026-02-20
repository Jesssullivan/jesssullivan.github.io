<script lang="ts">
	import TagCloud from './TagCloud.svelte';
	import ThemedImage from './ThemedImage.svelte';
	import { THEMED_IMAGES } from '$lib/data/github-profile';

	let { compact = false }: { compact?: boolean } = $props();
</script>

<div class="profile-sidebar {compact ? 'profile-sidebar--compact' : ''}">
	{#if compact}
		<!-- Mobile compact: horizontal layout -->
		<div class="flex items-center gap-4 mb-4">
			<img
				src="https://github.com/Jesssullivan.png"
				alt="Jess Sullivan"
				width="64"
				height="64"
				class="rounded-full"
				loading="lazy"
			/>
			<div>
				<p class="font-semibold">Jess Sullivan</p>
				<p class="text-xs text-surface-500">Full stack engineer, musician, birdwatcher</p>
			</div>
		</div>
	{:else}
		<!-- Desktop: vertical card layout -->
		<div class="text-center mb-4">
			<img
				src="https://github.com/Jesssullivan.png"
				alt="Jess Sullivan"
				width="250"
				height="250"
				class="rounded-full mx-auto mb-3"
				loading="lazy"
			/>
			<h2 class="font-semibold text-lg">Jess Sullivan</h2>
			<img
				src="/images/CodeCogsEqn-1.png"
				alt="Learning = internet * (time + standards * Ambition) / Difficulty"
				class="w-full mt-2"
				loading="lazy"
			/>
		</div>

		<p class="text-sm text-surface-600-400 mb-4">
			Full stack engineer, musician, and birdwatcher based in Lewiston, ME.
			I build infrastructure tooling, digital automata, hack upon compilers,
			love learning new languages, futz with hardware, and maintain a lot of
			fun projects here and elsewhere.
		</p>

		<!-- Social links -->
		<div class="flex flex-wrap gap-2 mb-4">
			<a
				href="https://github.com/Jesssullivan"
				target="_blank"
				rel="noopener"
				class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
			>GitHub</a>
			<a
				href="https://gitlab.com/jesssullivan"
				target="_blank"
				rel="noopener"
				class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
			>GitLab</a>
			<a
				href="https://github.com/sponsors/Jesssullivan"
				target="_blank"
				rel="noopener"
				class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
			>Sponsor</a>
			<a
				href="/cv"
				class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
			>CV</a>
			<a
				href="/about"
				class="badge preset-outlined-surface-500 text-xs hover:preset-outlined-primary-500 transition-colors"
			>About</a>
			<a
				href="https://www.fightforthefuture.org/"
				target="_blank"
				rel="noopener"
				class="inline-flex items-center"
			>
				<img src="/images/idl_badge.png" alt="Member of The Internet Defense League" height="20" class="h-5" />
			</a>
		</div>

		<!-- Tag Cloud -->
		<TagCloud />

		<!-- Tag co-occurrence graph -->
		<div class="mt-6">
			<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-1.5">Topic Network</h4>
			<ThemedImage
				lightSrc="/images/tag-graph.svg"
				darkSrc="/images/tag-graph-dark.svg"
				alt="Tag Co-occurrence Network"
				class="w-full rounded"
			/>
		</div>

		<!-- GitHub Activity widgets -->
		<div class="mt-6 space-y-3">
			<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-400">GitHub Activity</h4>
			<ThemedImage
				lightSrc={THEMED_IMAGES.githubStats.light}
				darkSrc={THEMED_IMAGES.githubStats.dark}
				alt={THEMED_IMAGES.githubStats.alt}
				class="w-full rounded"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.topLangs.light}
				darkSrc={THEMED_IMAGES.topLangs.dark}
				alt={THEMED_IMAGES.topLangs.alt}
				class="w-full rounded"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.repoGraph.light}
				darkSrc={THEMED_IMAGES.repoGraph.dark}
				alt={THEMED_IMAGES.repoGraph.alt}
				class="w-full rounded"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.snake.light}
				darkSrc={THEMED_IMAGES.snake.dark}
				alt={THEMED_IMAGES.snake.alt}
				class="w-full rounded"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.streak.light}
				darkSrc={THEMED_IMAGES.streak.dark}
				alt={THEMED_IMAGES.streak.alt}
				class="w-full rounded"
			/>
		</div>

	{/if}
</div>
