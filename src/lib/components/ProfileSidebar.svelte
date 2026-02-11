<script lang="ts">
	import TagCloud from './TagCloud.svelte';

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
			<p class="text-sm text-surface-500 mt-1">Systems Analyst (DevSecOps)</p>
			<p class="text-sm text-surface-500">Lewiston, ME</p>
		</div>

		<p class="text-sm text-surface-600-400 mb-4">
			Full stack engineer, musician, and birdwatcher.
			I build infrastructure tooling, contribute to compilers and languages,
			hack on hardware, and maintain a lot of FOSS.
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
		</div>

		<!-- Tag Cloud -->
		<TagCloud />
	{/if}
</div>
