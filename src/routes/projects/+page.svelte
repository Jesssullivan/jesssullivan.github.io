<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import ProjectMap, { type MapSelection } from '$lib/components/profile-map/ProjectMap.svelte';
	import { ProfileState } from '$lib/profile/profileState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	const profile = new ProfileState(data.profile);
	let focusId = $state<string | null>(null);

	const svg = {
		light: '/profile/v2/svg/project-map-light.svg',
		dark: '/profile/v2/svg/project-map-dark.svg',
		width: 960,
		height: 1226,
	};

	onMount(() => {
		// ?focus=<repo id> deep link (README links, R80). Read in the browser:
		// the page is prerendered, so search params are not available at build.
		focusId = new URL(window.location.href).searchParams.get('focus');
		void profile.load();
	});

	function onselect(selection: MapSelection | null) {
		const url = new URL(window.location.href);
		if (selection) url.searchParams.set('focus', selection.id);
		else url.searchParams.delete('focus');
		if (url.href !== window.location.href) replaceState(url, {});
	}

	const description =
		'An interactive map of Jess Sullivan’s public projects, placed by similarity of README text, descriptions, topics and languages.';
</script>

<svelte:head>
	<title>Projects | transscendsurvival.org</title>
	<meta name="description" content={description} />
	<meta property="og:title" content="Projects | transscendsurvival.org" />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/projects" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<link rel="canonical" href="https://transscendsurvival.org/projects" />
</svelte:head>

<div class="projects-page">
	<h1 class="sr-only">Projects</h1>
	<ProjectMap
		view={profile.view}
		status={profile.status}
		source={profile.source}
		mode="full"
		{svg}
		{focusId}
		{onselect}
		tableHeading="Every public project on the map"
	/>
	<p class="projects-back"><a href="/about" class="text-primary-500 hover:underline">&larr; Back to About</a></p>
</div>

<style>
	.projects-page {
		padding: 0.75rem 0 2.5rem;
	}
	.projects-page :global(.pm-table-wrap) {
		max-width: 64rem;
		margin-left: auto;
		margin-right: auto;
		padding: 0 1rem;
	}
	.projects-back {
		max-width: 64rem;
		margin: 1.5rem auto 0;
		padding: 0 1rem;
		font-size: 0.9rem;
	}
	@media (min-width: 1024px) {
		.projects-page {
			padding: 0.75rem 1rem 2.5rem;
		}
	}
</style>
