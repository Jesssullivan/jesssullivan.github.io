<script lang="ts">
	let { progress = 0, reducedMotion = false }: { progress?: number; reducedMotion?: boolean } = $props();

	const radius = 45;
	const circumference = $derived(2 * Math.PI * radius);
	const strokeDashoffset = $derived(circumference - (progress / 100) * circumference);
</script>

<div class="reading-progress-ring">
	<div class="relative inline-flex items-center justify-center">
		<svg
			class="w-24 h-24 transform -rotate-90"
			viewBox="0 0 100 100"
			role="img"
			aria-label={`Reading progress: ${Math.round(progress)}%`}
		>
			<!-- Background circle -->
			<circle
				cx="50"
				cy="50"
				r={radius}
				stroke="currentColor"
				stroke-width="8"
				fill="transparent"
				class="text-surface-300 opacity-30"
			/>
			<!-- Progress circle -->
			<circle
				cx="50"
				cy="50"
				r={radius}
				stroke="currentColor"
				stroke-width="8"
				fill="transparent"
				stroke-dasharray={circumference}
				stroke-dashoffset={strokeDashoffset}
				stroke-linecap="round"
				class:transition-all={!reducedMotion}
				class:duration-300={!reducedMotion}
				class:ease-out={!reducedMotion}
				class="text-primary-500"
			/>
		</svg>
		<div class="absolute inset-0 flex items-center justify-center">
			{#if progress < 100}
				<span class="text-lg font-bold">{Math.round(progress)}%</span>
			{:else}
				<span class="text-2xl">&#127881;</span>
			{/if}
		</div>
	</div>
</div>
