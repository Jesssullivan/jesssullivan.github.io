<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	const people = [
		{
			name: 'Gabriella Gonzalez',
			url: 'https://haskellforall.com/',
			image: '/images/signal-boosts/haskellforall.jpg',
			description: 'Haskell for all. Prolific writer on functional programming, Nix, and developer tooling.',
		},
		{
			name: 'Kerfluffle',
			url: 'https://kerfluffle.space/',
			image: '/images/signal-boosts/kerfluffle.png',
			description: 'Art, code, and creative engineering.',
		},
		{
			name: 'Xe Iaso',
			url: 'https://xeiaso.net/',
			image: '/images/signal-boosts/xeiaso.png',
			description: 'Prolific technical writer covering Nix, Go, Rust, infrastructure, and philosophy of software.',
		},
		{
			name: 'Freya Bruhin',
			url: 'https://bruhin.software/',
			image: '/images/signal-boosts/bruhin.jpg',
			description: 'Creator of qutebrowser. Open source developer and software consultant.',
		},
		{
			name: 'Nabeel Valley',
			url: 'https://nabeelvalley.co.za/blog/',
			image: null,
			description: 'Software engineer and photographer. Wide-ranging technical blog covering web, cloud, and functional programming.',
		},
		{
			name: 'Michael Schnerring',
			url: 'https://schnerring.net/',
			image: '/images/signal-boosts/schnerring.jpg',
			description: 'Software engineer. Writes about DevOps, Hugo, infrastructure, and automation.',
		},
		{
			name: 'apalrd',
			url: 'https://www.apalrd.net/',
			image: null,
			description: 'Engineering and technology adventures. Home automation, homelab, and virtualization.',
		},
		{
			name: 'chorl',
			url: 'https://www.etotheipiplusone.net/',
			image: '/images/signal-boosts/etotheipiplusone.jpg',
			description: 'Equals Zero. Combat robots, electric vehicles, and deeply detailed mechanical build logs.',
		},
	];
</script>

<svelte:head>
	<title>Signal Boosts | transscendsurvival.org</title>
	<meta name="description" content="People I admire, from whom I've learned a lot." />
	<meta property="og:title" content="Signal Boosts | transscendsurvival.org" />
	<meta property="og:description" content="People I admire, from whom I've learned a lot." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/signal-boosts" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<link rel="canonical" href="https://transscendsurvival.org/signal-boosts" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<h1 class="text-3xl font-bold mb-2">Signal Boosts</h1>
	<p class="text-surface-500 mb-8">People I admire, from whom I've learned a lot.</p>

	<div class="space-y-4">
		{#each people as person}
			<a
				href={person.url}
				target="_blank"
				rel="noopener"
				class="card p-5 flex items-center gap-5 hover:ring-2 ring-primary-500 transition-all"
				aria-label={`Visit ${person.name}`}
			>
				<Avatar class="size-12">
					{#if person.image}
						<Avatar.Image src={person.image} alt={person.name} />
					{/if}
					<Avatar.Fallback>{person.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
				<div class="min-w-0">
					<h2 class="font-semibold text-lg">{person.name}</h2>
					<p class="text-sm text-surface-500 mt-1">{person.description}</p>
					<p class="text-xs text-primary-500 mt-1 truncate">{person.url}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
