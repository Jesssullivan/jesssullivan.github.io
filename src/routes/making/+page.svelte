<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	const profiles = [
		{
			name: 'Thingiverse',
			handle: 'Jesssullivan',
			url: 'https://www.thingiverse.com/Jesssullivan/designs',
			image: null,
			logo: 'thingiverse',
			description: 'Functional prints -- pen nibs, server racks, EV mode buttons, household fixes.',
			highlights: [
				{ name: 'Printable Huion Pen Nib Replacement', note: '14 likes' },
				{ name: 'Prius EV Mode Button Insert', note: '11 likes' },
				{ name: 'NezuCoaster', note: '11 likes' },
				{ name: 'Laser Cut 19" Computer Rack & Shelf', note: 'CC BY-NC-SA' },
			],
		},
		{
			name: 'YouTube',
			handle: '@jesssullivan',
			url: 'https://www.youtube.com/@jesssullivan4983',
			image: null,
			logo: 'youtube',
			description: 'Guitar sessions and project demos.',
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
			description: '9-string electric and organ recordings.',
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
	<p class="text-surface-500 mb-8">
		3D models, music, and project demos.
	</p>

	<!-- SketchUp 3D Warehouse Stats -->
	<div class="card p-6 mb-8">
		<div class="flex items-center gap-4 mb-4">
			<Avatar class="size-12"><Avatar.Fallback>SW</Avatar.Fallback></Avatar>
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
		<p class="text-sm text-surface-600-400 leading-relaxed mb-4">Skatepark ramp plans, recording studios, CNC assemblies, headphone drivers, and a hammock tent.</p>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			{#each [
				{ name: '4ft Mini Ramp Plans', note: '9.3K dl / 30K views', img: '/images/sketchup/mini-ramp-4ft.jpg', url: 'https://3dwarehouse.sketchup.com/model/ueeab6ec3-57aa-4faf-912e-0ea7d9c16792' },
				{ name: '3ft Mini Ramp Plans', note: '2.5K dl / 13K views', img: '/images/sketchup/mini-ramp-3ft.jpg', url: 'https://3dwarehouse.sketchup.com/model/uaf19d4cd-572d-4650-aa0a-efc996241c75' },
				{ name: 'Speed Hub w/ Rollin', note: '6.9K downloads', img: '/images/sketchup/speed-hub.jpg', url: 'https://3dwarehouse.sketchup.com/model/u76f28f89-a32e-446a-8aab-c8a26d56bcc2' },
				{ name: 'Large Launch Box', note: '5.9K downloads', img: '/images/sketchup/large-launch-box.jpg', url: 'https://3dwarehouse.sketchup.com/model/u31d6b970-c5bf-4b67-bad5-86eea08c9093' },
				{ name: 'Long Low Grind Rail', note: '5.4K downloads', img: '/images/sketchup/grind-rail.jpg', url: 'https://3dwarehouse.sketchup.com/model/uef39f392-6ed8-4ad8-88bc-c2c979a49d0f' },
				{ name: 'Funbox w/ Rail', note: '5.3K downloads', img: '/images/sketchup/funbox.jpg', url: 'https://3dwarehouse.sketchup.com/model/u1899ec96-410e-437d-a176-c1355874addf' },
				{ name: 'Medium Launch Ramp', note: '4.7K downloads', img: '/images/sketchup/medium-launch.jpg', url: 'https://3dwarehouse.sketchup.com/model/u5e70c402-87d6-4fc0-98b3-88733356964e' },
				{ name: 'Euro Gap Flybox', note: '4.6K downloads', img: '/images/sketchup/euro-gap-flybox.jpg', url: 'https://3dwarehouse.sketchup.com/model/u85ccd005-1d96-4988-a94d-ff6ac353aa99' },
				{ name: 'Skatepark Bowl + Street', note: '4K dl / 5K views', img: '/images/sketchup/skatepark-bowl.jpg', url: 'https://3dwarehouse.sketchup.com/model/ueb5d831d-c3c6-45eb-8542-c49255e99924' },
				{ name: 'Far Side Skate Hub', note: '3.8K downloads', img: '/images/sketchup/far-side-hub.jpg', url: 'https://3dwarehouse.sketchup.com/model/u269e2877-5224-4cb4-9fd2-461f4b839a51' },
				{ name: 'Tiny Recording Studio', note: '1.3K dl / 5.5K views', img: '/images/sketchup/tiny-studio.jpg', url: 'https://3dwarehouse.sketchup.com/model/u2b306710-a22e-420e-8a3f-a18a092acdf2' },
				{ name: 'MPCNC CNC Machine', note: '7.3K views', img: '/images/sketchup/mpcnc.jpg', url: 'https://3dwarehouse.sketchup.com/model/72bbe55e-8df7-42a2-9a57-c355debf1447' },
				{ name: 'CoilBot v2', note: '4.7K views', img: '/images/sketchup/coilbot.jpg', url: 'https://3dwarehouse.sketchup.com/model/97730817-843c-4e13-89ae-7c22d8d18eaf' },
				{ name: 'Electrostatic Headphone', note: 'DIY audio', img: '/images/sketchup/electrostatic-hp.jpg', url: 'https://3dwarehouse.sketchup.com/model/0f47a4a7-7546-4237-95bb-e01ce5822069' },
				{ name: 'Hammock Tent', note: '829 downloads', img: '/images/sketchup/hammock-tent.jpg', url: 'https://3dwarehouse.sketchup.com/model/u801d1e9f-13c5-47c5-98f2-194043bf97ff' },
			] as model}
				<a href={model.url} target="_blank" rel="noopener" class="card overflow-hidden hover:ring-2 ring-primary-500 transition-all">
					<img src={model.img} alt={model.name} class="w-full aspect-square object-cover" loading="lazy" />
					<div class="p-2">
						<p class="text-xs font-medium truncate">{model.name}</p>
						<p class="text-[10px] text-surface-400">{model.note}</p>
					</div>
				</a>
			{/each}
		</div>
	</div>

	<div class="space-y-6">
		{#each profiles as profile}
			<div class="card p-6">
				<div class="flex items-start gap-4 mb-4">
					<Avatar class="size-12"><Avatar.Fallback>{profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</Avatar.Fallback></Avatar>
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
