<script lang="ts">
	import { onMount } from 'svelte';

	let {
		label,
		defaultOpen = true,
		children,
	}: {
		label: string;
		defaultOpen?: boolean;
		children: import('svelte').Snippet;
	} = $props();

	// SSR/no-JS always exposes the reviewed body. Hydration then applies an
	// authored closed preference without a markup mismatch.
	let open = $state(true);
	onMount(() => {
		open = defaultOpen;
	});

	function toggle(): void {
		open = !open;
	}
</script>

<section class="reviewed-inline-disclosure" data-reviewed-component="InlineDisclosure">
	<button
		type="button"
		class="reviewed-inline-disclosure__trigger"
		aria-expanded={open}
		onclick={toggle}
	>
		{label}
	</button>
	<div class:hidden={!open}>
		{@render children()}
	</div>
</section>

<style>
	.reviewed-inline-disclosure {
		margin-block: 1.5rem;
		border-inline-start: 3px solid var(--color-primary-500);
		padding-inline-start: 1rem;
	}
	.reviewed-inline-disclosure__trigger {
		cursor: pointer;
		font: inherit;
		font-weight: 650;
		text-align: left;
		color: var(--color-primary-600);
	}
	.hidden { display: none; }
</style>
