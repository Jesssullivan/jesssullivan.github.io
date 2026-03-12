<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	const profiles = [
		{
			name: 'Thingiverse',
			handle: 'Jesssullivan',
			url: 'https://www.thingiverse.com/Jesssullivan/designs',
			image: null,
			logo: 'thingiverse',
			description: 'Functional prints and practical designs. Huion pen nibs, laser-cut server racks, candle pitchers, Prius EV mode buttons, and assorted household fixes.',
			highlights: [
				{ name: 'Printable Huion Pen Nib Replacement', note: '14 likes' },
				{ name: 'Prius EV Mode Button Insert', note: '11 likes' },
				{ name: 'NezuCoaster', note: '11 likes' },
				{ name: 'Laser Cut 19" Computer Rack & Shelf', note: 'CC BY-NC-SA' },
			],
		},
		{
			name: 'SketchUp 3D Warehouse',
			handle: 'Jesssullivan',
			url: 'https://3dwarehouse.sketchup.com/by/Jesssullivan',
			image: null,
			logo: 'sketchup',
			description: 'Skatepark ramp plans, recording studios, CNC assemblies, headphone drivers, and more. See stats above.',
			highlights: [
				{ name: 'Tiny Recording Studio', note: '1.3K downloads' },
				{ name: 'Small Recording Studio, SUPERTINY', note: '838 downloads' },
				{ name: 'Electrostatic Headphone Driver', note: 'DIY audio' },
			],
		},
		{
			name: 'YouTube',
			handle: '@jesssullivan',
			url: 'https://www.youtube.com/@jesssullivan4983',
			image: null,
			logo: 'youtube',
			description: 'Morning Metal guitar sessions, project demos, and the occasional cartography screencast. Currently updating the channel with more content.',
			highlights: [
				{ name: 'Morning Metal playlist', note: 'Ongoing guitar series' },
			],
		},
		{
			name: 'SoundCloud',
			handle: 'jesssullivan',
			url: 'https://soundcloud.com/jesssullivan',
			image: null,
			logo: 'soundcloud',
			description: 'Guitar and organ recordings. Mostly morning metal sessions -- 9-string electric through a variety of amps and pedals.',
			highlights: [
				{ name: 'Morning Metal 4.22.21 "Sleepish"', note: 'Apr 2021' },
				{ name: 'Evening Metal 9.14.20', note: 'Sep 2020' },
			],
		},
	];
</script>

<svelte:head>
	<title>Making | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan's 3D models, music, videos, and creative work across Thingiverse, SketchUp 3D Warehouse, YouTube, and SoundCloud." />
	<meta property="og:title" content="Making | transscendsurvival.org" />
	<meta property="og:description" content="3D models, music, videos, and creative work." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/making" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org/making" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<h1 class="text-3xl font-bold mb-2">Making</h1>
	<p class="text-surface-500 mb-2">
		3D models, music, project demos, and assorted creative output scattered across the internet.
	</p>
	<p class="text-xs text-surface-400 mb-8">
		Eventually migrating to self-hosted and fediverse alternatives. These will do for now.
	</p>

	<!-- SketchUp 3D Warehouse Stats -->
	<div class="card p-6 mb-8">
		<div class="flex items-center gap-4 mb-4">
			<Avatar name="SketchUp 3D Warehouse" size="lg" />
			<div>
				<a
					href="https://3dwarehouse.sketchup.com/by/Jesssullivan"
					target="_blank"
					rel="noopener"
					class="text-lg font-semibold text-primary-500 hover:underline"
				>SketchUp 3D Warehouse</a>
				<p class="text-sm text-surface-400">50 public models, 2014-2019</p>
			</div>
		</div>
		<div class="grid grid-cols-3 gap-4 text-center mb-4">
			<div class="card preset-outlined-surface-200-800 p-4">
				<p class="text-2xl font-bold">86.5K+</p>
				<p class="text-xs text-surface-400">Downloads</p>
			</div>
			<div class="card preset-outlined-surface-200-800 p-4">
				<p class="text-2xl font-bold">172K+</p>
				<p class="text-xs text-surface-400">Views</p>
			</div>
			<div class="card preset-outlined-surface-200-800 p-4">
				<p class="text-2xl font-bold">135</p>
				<p class="text-xs text-surface-400">Likes</p>
			</div>
		</div>
		<p class="text-surface-600-400 leading-relaxed mb-4">Mostly skatepark ramp plans, recording studio layouts, CNC machine assemblies, and headphone driver designs. The mini ramp plans alone have 9,300+ downloads.</p>
		<div class="space-y-1">
			<p class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Top Models</p>
			{#each [
				{ name: '4 Foot Mini Ramp Plans', note: '9.3K downloads, 30K views' },
				{ name: 'Speed Hub w/ Rollin', note: '6.9K downloads' },
				{ name: 'Large Launch Box', note: '5.9K downloads' },
				{ name: 'Long Low Grind Rail', note: '5.4K downloads' },
				{ name: 'Progression Funbox w/ Rail', note: '5.3K downloads' },
				{ name: 'MPCNC CNC Machine', note: '7.3K views' },
				{ name: 'CoilBot v2 Lasercut Coil Winder', note: '4.7K views' },
			] as item}
				<div class="flex items-baseline justify-between gap-4 text-sm">
					<span class="font-medium truncate">{item.name}</span>
					<span class="text-xs text-surface-400 whitespace-nowrap">{item.note}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="space-y-6">
		{#each profiles as profile}
			<div class="card p-6">
				<div class="flex items-start gap-4 mb-4">
					<Avatar name={profile.name} size="lg" />
					<div class="min-w-0">
						<a
							href={profile.url}
							target="_blank"
							rel="noopener"
							class="text-lg font-semibold text-primary-500 hover:underline"
						>{profile.name}</a>
						<p class="text-sm text-surface-400">@{profile.handle}</p>
					</div>
				</div>
				<p class="text-surface-600-400 leading-relaxed mb-4">{profile.description}</p>
				{#if profile.highlights.length > 0}
					<div class="space-y-1">
						{#each profile.highlights as item}
							<div class="flex items-baseline justify-between gap-4 text-sm">
								<span class="font-medium truncate">{item.name}</span>
								<span class="text-xs text-surface-400 whitespace-nowrap">{item.note}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="mt-8 text-center">
		<a href="/about" class="text-sm text-primary-500 hover:underline">&larr; Back to About</a>
	</div>
</div>
