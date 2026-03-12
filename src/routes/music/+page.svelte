<script lang="ts">
	import type { PageData } from './$types';
	import SoundCloudEmbed from '$lib/components/SoundCloudEmbed.svelte';

	let { data }: { data: PageData } = $props();

	const tracks = [
		{
			title: 'Morning Metal 4.22.21 "Sleepish"',
			url: 'https://soundcloud.com/jesssullivan/morning-metal-42221',
			date: 'April 22, 2021',
			note: 'The usual racket...',
		},
		{
			title: 'Morning Metal 12.17.20',
			url: 'https://soundcloud.com/jesssullivan/morning-metal-121720',
			date: 'December 17, 2020',
			note: 'Some "freezing-cold-New-Hampshire-Winter" morning metal.',
		},
		{
			title: 'Evening Metal 9.14.20',
			url: 'https://soundcloud.com/jesssullivan/evening-metal-91420',
			date: 'September 14, 2020',
			note: "Haven't posted any guitar for a bit, here's a recording from this evening.",
		},
	];
</script>

<svelte:head>
	<title>Music | transscendsurvival.org</title>
	<meta name="description" content="Music by Jess Sullivan — 20+ years of guitar, 25+ years of piano/organ. Morning Metal, Evening Metal, and more." />
	<meta property="og:title" content="Music | transscendsurvival.org" />
	<meta property="og:description" content="Music by Jess Sullivan — guitar, piano, organ recordings and musings." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/music" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org/music" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<h1 class="text-3xl font-bold mb-2">Music</h1>
	<p class="text-surface-500 mb-8">
		20+ years of guitar &mdash; currently play a custom 9-string electric made in NH
		and a 12-string acoustic. 25+ years of piano/organ &mdash; primarily on a rotary Yamaha organ these days.
	</p>

	<!-- SoundCloud Tracks -->
	<section class="mb-12">
		<div class="flex items-baseline justify-between mb-4">
			<h2 class="text-xl font-semibold">Tracks</h2>
			<a
				href="https://soundcloud.com/jesssullivan"
				target="_blank"
				rel="noopener"
				class="text-sm text-primary-500 hover:underline"
			>All tracks on SoundCloud &rarr;</a>
		</div>

		{#each tracks as track}
			<div class="mb-8">
				<h3 class="font-semibold">{track.title}</h3>
				<p class="text-xs text-surface-500 mb-1">{track.date}</p>
				{#if track.note}
					<p class="text-sm text-surface-600-400 mb-2">{track.note}</p>
				{/if}
				<SoundCloudEmbed trackUrl={track.url} title={track.title} />
			</div>
		{/each}
	</section>

	<!-- YouTube Videos -->
	<section class="mb-12">
		<div class="flex items-baseline justify-between mb-4">
			<h2 class="text-xl font-semibold">Videos</h2>
			<a
				href="https://www.youtube.com/@jesssullivan4983"
				target="_blank"
				rel="noopener"
				class="text-sm text-primary-500 hover:underline"
			>YouTube channel &rarr;</a>
		</div>

		<!-- Playlist embed -->
		<div class="mb-8">
			<h3 class="font-semibold mb-2">Morning Metal Playlist</h3>
			<div class="relative w-full" style="padding-bottom: 56.25%;">
				<iframe
					src="https://www.youtube-nocookie.com/embed/videoseries?list=PL6y8N_vP4OooPyza8EOIrz2XC0cck9Fae"
					title="Morning Metal playlist"
					class="absolute inset-0 w-full h-full rounded-lg"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
					loading="lazy"
				></iframe>
			</div>
		</div>

		<!-- Individual videos -->
		<h3 class="font-semibold mb-4">More Videos</h3>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each [
				{ id: 'jcdIMftYGGQ', title: 'Silly Goose Stuff', short: true },
				{ id: 'CcF96vq2dcY', title: 'Sleepy Saturday', short: true },
				{ id: 'HWfSMihJgJw', title: '9 String Amphibiansce', short: false },
				{ id: 'xGdNk7CTTTg', title: 'Drop A for Activities', short: false },
				{ id: 'N2haib_Ttrw', title: 'Twelve a Biggah Numbah Den Nine', short: false },
				{ id: 'JVusudpKTF8', title: 'Morning Metal 04.23.21', short: false },
				{ id: 'zCrrzdaBCsw', title: 'Morning Metal 10/28/20', short: false },
				{ id: 'nVkjCMmpUII', title: 'Shortest Morning Metal 7 8 20', short: false },
				{ id: 's_6pwdzT9ZQ', title: 'Note Feel Good Metal', short: false },
				{ id: 'jrxJHwmtwak', title: 'Shortest Morning Metal 7 8 20', short: false },
			] as video}
				<div class="card overflow-hidden">
					<div class="relative w-full" style="padding-bottom: {video.short ? '177%' : '56.25%'};">
						<iframe
							src="https://www.youtube-nocookie.com/embed/{video.id}"
							title={video.title}
							class="absolute inset-0 w-full h-full"
							frameborder="0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
							loading="lazy"
						></iframe>
					</div>
					<p class="text-sm font-medium p-3">{video.title}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Music blog posts -->
	{#if data.musicPosts.length > 0}
		<section class="mb-12">
			<h2 class="text-xl font-semibold mb-4">Music Posts</h2>
			<div class="space-y-4">
				{#each data.musicPosts as post}
					<a href="/blog/{post.slug}" class="block card p-4 hover:ring-2 ring-primary-500 transition-all">
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="font-semibold">{post.title}</h3>
							<time class="text-xs text-surface-500 whitespace-nowrap">
								{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</time>
						</div>
						{#if post.description}
							<p class="text-sm text-surface-500 mt-1 line-clamp-2">{post.description}</p>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<blockquote class="border-l-4 border-primary-500 pl-4 italic text-surface-500">
		"If there were no computers I'd probably be a baker, a minstrel or a bard."
	</blockquote>
</div>
