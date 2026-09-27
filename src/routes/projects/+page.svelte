<script lang="ts">
	import ProfileExplorer from '$lib/profile/ProfileExplorer.svelte';
	import '$lib/profile/profile.css';
</script>

<svelte:head>
	<title>Projects | Jess Sullivan</title>
	<meta
		name="description"
		content="Explore Jess Sullivan's public engineering projects, metadata relationships, observed language history and verified upstream contributions."
	/>
	<link rel="canonical" href="https://transscendsurvival.org/projects" />
</svelte:head>
<div class="profile-surface projects-page">
	<header>
		<p class="eyebrow">Jess Sullivan / public work</p>
		<h1>Projects, in context.</h1>
		<p class="intro">
			Explore the relationships between projects, the languages touched over time, and the public evidence behind
			upstream work.
		</p>
		<nav aria-label="Project views">
			<a href="#project-map">Project map</a><a href="#language-history">Languages over time</a><a href="#upstream"
				>Upstream work</a
			><a href="#activity">Activity rhythm</a><a href="/about">About Jess →</a>
		</nav>
	</header>
	<ProfileExplorer />
</div>

<style>
	.projects-page {
		max-width: 76rem;
		margin: 0 auto;
		padding: clamp(1.2rem, 4vw, 3.5rem);
	}
	header {
		margin-bottom: 2rem;
	}
	.eyebrow {
		font: 0.8rem var(--profile-font-mono);
		color: var(--profile-muted);
		letter-spacing: 0.06em;
		margin: 0 0 1.4rem;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 3.7rem);
		font-weight: 600;
		line-height: 1.15;
		margin: 0 0 1.5rem;
	}
	.intro {
		font-size: clamp(1rem, 2vw, 1.2rem);
		max-width: 62ch;
		color: var(--profile-muted);
		margin: 0 0 1.8rem;
	}
	nav {
		display: flex;
		gap: 1rem 1.8rem;
		flex-wrap: wrap;
		font-size: 0.9rem;
	}
	nav a {
		min-height: 44px;
		padding-block: 0.6rem;
	}
	@media (max-width: 600px) {
		.projects-page {
			padding: 1rem;
		}
		nav {
			gap: 0.4rem 1.1rem;
		}
	}
</style>
