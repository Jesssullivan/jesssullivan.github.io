<script lang="ts">
	import { onMount } from 'svelte';
	let dark = $state(false);
	onMount(() => {
		const read = () => (dark = document.documentElement.dataset.mode === 'dark');
		read();
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
		return () => observer.disconnect();
	});
</script>

<picture
	><source media="(max-width: 600px)" srcset={`/profile/v2/svg/timeline-compact-${dark ? 'dark' : 'light'}.svg`} /><img
		src={`/profile/v2/svg/timeline-${dark ? 'dark' : 'light'}.svg`}
		alt="Roles and ventures by year. Ongoing work ends at the snapshot year; undated ventures remain outside the date axis."
		width="960"
		height="713"
		loading="lazy"
	/></picture
>

<style>
	picture,
	img {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
