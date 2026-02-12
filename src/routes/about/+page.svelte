<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import ThemedImage from '$lib/components/ThemedImage.svelte';
	import {
		TYPING_SVG_URL,
		CTA_BADGES,
		IDENTITY_BADGES,
		THEMED_IMAGES,
		CLIENT_BADGES,
		SPONSOR_BADGES,
	} from '$lib/data/github-profile';

	let { data }: { data: PageData } = $props();

	let bannerRef: HTMLElement | undefined = $state();
	let bannerOpacity = $state(1);

	const ventures = [
		{ name: 'Tinyland.dev, Inc', url: 'https://tinyland.dev', period: '2024\u2013Present', desc: 'Funded, stealthmode. Tinyland is big, more to come very soon.' },
		{ name: 'xoxd.ai', url: 'https://xoxd.ai', period: '2024\u2013Present', desc: 'Massively parallel, provable, ownable agent infrastructure. 130+ agents, 5 custom models, Chapel + Go + K8s.' },
		{ name: 'Columbari.us LLC', url: 'https://columbari.us', period: '2017\u20132021', desc: 'Independent Gov. contractor in GIS & ML.' },
		{ name: 'Moonlight Coworking LLC', url: null, period: '2024', desc: 'Shelved rapidfab / HPC hackerspace initiative in NY.' },
		{ name: 'Kitten Spit Labs', url: null, period: '2022\u2013Present', desc: 'Ultrasonic phantom network gel synthesis. Currently on mfg. pause.' },
	];

	const experience = [
		{
			role: 'Systems Analyst (DevSecOps)',
			org: 'Bates College',
			period: '2024\u2013Present',
			highlights: [
				'Legacy modernization, bespoke Ansible extensions, roles & plugins',
				'Apache Solr, ACME cert management, SAML integrations',
				'GitLab AutoDevOps, RKE2 + Rancher, promoter of IaC practices',
				'Orchestration, packaging & tooling work (Haskell + Python, QuickCheck, Cabal, FPM)',
			],
		},
		{
			role: 'CV/ML Software Engineer',
			org: 'Macaulay Library',
			period: '2018\u20132022',
			highlights: [
				'Developed & launched Merlin Sound ID & The Machine Learning Blog',
				'Fine-grained ML annotation tools for audio classification',
				'Internal classification & model evaluation web APIs',
				'Python (TensorFlow, NumPy, Pandas), Flask, TypeScript, Docker, WASM',
			],
		},
		{
			role: 'Fabrication Lab Manager',
			org: 'Cornell CALS',
			period: '2021\u20132022',
			highlights: [
				'Rapid fabrication curricula for Landscape Architecture students & faculty',
				'OpenSCAD, Fusion 360, C++ tiler development',
			],
		},
	];

	const fossCategories = [
		{
			label: 'Languages & Compilers',
			projects: [
				{ name: 'quickchpl', url: 'https://github.com/Jesssullivan/quickchpl', desc: 'Property-Based Testing for Chapel' },
				{ name: 'RemoteJuggler', url: 'https://github.com/Jesssullivan/RemoteJuggler', desc: 'Multi-identity git credential resolver in Chapel' },
				{ name: 'pixelwise-research', url: 'https://github.com/Jesssullivan/pixelwise-research', desc: 'WebGPU glyph compositor demo in Futhark' },
			]
		},
		{
			label: 'Infrastructure & DevOps',
			projects: [
				{ name: 'GloriousFlywheel', url: 'https://github.com/Jesssullivan/GloriousFlywheel', desc: 'Recursive IaC flywheel for GitLab' },
				{ name: 'Ansible-DAG-Harness', url: 'https://github.com/Jesssullivan/Ansible-DAG-Harness', desc: 'LangGraph DAG harness for Ansible iteration cycles' },
				{ name: 'searchies', url: 'https://github.com/Jesssullivan/searchies', desc: 'SearXNG infrastructure with Caddy & OpenTofu' },
			]
		},
		{
			label: 'Hardware & Maker',
			projects: [
				{ name: 'XoxdWM', url: 'https://github.com/Jesssullivan/XoxdWM', desc: 'Eye-gesture VR & BCI XWayland Emacs WM' },
				{ name: 'TurkeyProbe', url: 'https://github.com/Jesssullivan/TurkeyProbe', desc: 'ESP8266 thermistor probe with WebSocket UI' },
				{ name: 'hiberpower-ntfs', url: 'https://github.com/Jesssullivan/hiberpower-ntfs', desc: 'ASM2362 NVMe FTL corruption recovery research' },
			]
		},
		{
			label: 'Web & Apps',
			projects: [
				{ name: 'tetrahedron', url: 'https://github.com/Jesssullivan/tetrahedron', desc: 'Mental health social service application' },
				{ name: 'timberbuddy', url: 'https://github.com/Jesssullivan/timberbuddy', desc: 'Control package for Amish sawmill robotics' },
				{ name: 'FastPhotoAPI', url: 'https://github.com/Jesssullivan/FastPhotoAPI', desc: 'Flask image server with Lanczos resampling' },
			]
		},
		{
			label: 'ML & Data',
			projects: [
				{ name: 'gnucashr', url: 'https://github.com/Jesssullivan/gnucashr', desc: 'High-performance R package for GNUCash accounting' },
			]
		},
	];

	const fossContributions = [
		{ name: 'Chapel', url: 'https://chapel-lang.org/' },
		{ name: 'Futhark', url: 'https://futhark-lang.org/' },
		{ name: 'SearXNG', url: 'https://github.com/searxng/searxng' },
		{ name: 'KeePassXC', url: 'https://keepassxc.org/' },
		{ name: 'Apache Solr', url: 'https://solr.apache.org/' },
		{ name: 'Skeleton UI', url: 'https://skeleton.dev/' },
		{ name: 'xCaddy', url: 'https://github.com/caddyserver/xcaddy' },
		{ name: 'fft.js', url: 'https://github.com/nicbarker/fft.js' },
		{ name: 'libdns', url: 'https://github.com/libdns/libdns' },
		{ name: 'qutebrowser', url: 'https://github.com/qutebrowser/qutebrowser' },
		{ name: 'pytest', url: 'https://github.com/pytest-dev/pytest' },
		{ name: 'svelte-superforms', url: 'https://github.com/ciscoheat/sveltekit-superforms' },
		{ name: 'Klipper', url: 'https://github.com/Klipper3d/klipper' },
	];

	function badgeUrl(text: string, color: string, opts?: { logo?: string; style?: string; emoji?: string }): string {
		const style = opts?.style ?? 'flat-square';
		let label = text;
		if (opts?.emoji) label = `${opts.emoji} ${text}`;
		const encoded = encodeURIComponent(label).replace(/-/g, '--');
		let url = `https://img.shields.io/badge/${encoded}-${color}?style=${style}`;
		if (opts?.logo) url += `&logo=${opts.logo}&logoColor=white`;
		return url;
	}

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const onScroll = () => {
			if (!bannerRef) return;
			bannerOpacity = Math.max(0, 1 - window.scrollY / bannerRef.offsetHeight);
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:head>
	<title>About | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME." />
	<meta property="og:title" content="About | transscendsurvival.org" />
	<meta property="og:description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/about" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="About | transscendsurvival.org" />
	<meta name="twitter:description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME." />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org/about" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "Person",
		"name": "Jess Sullivan",
		"url": "https://transscendsurvival.org",
		"jobTitle": "Systems Analyst (DevSecOps)",
		"worksFor": { "@type": "Organization", "name": "Bates College" },
		"sameAs": [
			"https://github.com/Jesssullivan",
			"https://gitlab.com/jesssullivan",
			"https://soundcloud.com/jesssullivan"
		],
		"description": "Full stack engineer, musician, and birdwatcher based in Lewiston, ME."
	})}</script>`}
</svelte:head>

<!-- 1. Hero banner with scroll-fade -->
<section class="hero-banner" bind:this={bannerRef} style:opacity={bannerOpacity}>
	<picture>
		<source srcset="/images/header.webp" type="image/webp" />
		<img
			src="/images/header.png"
			alt="Great Blue Heron"
			class="hero-banner-img"
			width="672"
			height="219"
			fetchpriority="high"
			decoding="sync"
		/>
	</picture>
	<div class="hero-banner-overlay">
		<h1 class="hero-banner-title text-2xl sm:text-3xl lg:text-4xl">
			Trans Scend Survival
		</h1>
		<div class="hero-banner-separator" aria-hidden="true"></div>
		<p class="hero-banner-description">
			<span class="hero-banner-description-word"><strong>Trans:</strong> Latin prefix implying &ldquo;across&rdquo; or &ldquo;Beyond&rdquo;, often used in gender nonconforming situations</span>
			<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
			<span class="hero-banner-description-word"><strong>Scend:</strong> Archaic word describing a strong &ldquo;surge&rdquo; or &ldquo;wave&rdquo;, originating with 15th century english sailors</span>
			<span class="hero-banner-description-dash" aria-hidden="true">&mdash;</span>
			<span class="hero-banner-description-word"><strong>Survival:</strong> 15th century english compound word describing an existence only worth transcending</span>
		</p>
		<p class="hero-banner-subtitle text-sm sm:text-base">
			Jess Sullivan
		</p>
	</div>
</section>

<div class="container mx-auto px-4 py-12 max-w-3xl">

	<!-- 2. Typing SVG -->
	<section class="mb-8 text-center">
		<img src={TYPING_SVG_URL} alt="Typing animation of skills and technologies" width="800" height="50" loading="eager" class="mx-auto max-w-full" />
	</section>

	<!-- 3. CTA badges -->
	<section class="mb-8 flex flex-wrap justify-center gap-3">
		{#each CTA_BADGES as badge}
			<a href={badge.url} target="_blank" rel="noopener">
				<img
					src={badgeUrl(`${badge.label}-${badge.text}`, badge.color, { style: 'for-the-badge' })}
					alt={badge.label}
					height="28"
					loading="eager"
				/>
			</a>
		{/each}
	</section>

	<!-- 4. Bio -->
	<section class="mb-8">
		<p class="text-surface-600-400 leading-relaxed mb-4">
			Full stack engineer, musician, and birdwatcher based in Lewiston, ME.
		</p>
		<p class="text-surface-600-400 leading-relaxed mb-4">
			I spent about a year completely offline &mdash; no LinkedIn, no blog, no social media.
			Late 2023 through the end of 2024. An intentional disconnect.
			I'm back to building in the open.
		</p>
		<p class="text-surface-600-400 leading-relaxed mb-4">
			I build infrastructure tooling, contribute to compilers and languages, hack on hardware,
			and maintain a <em>lot</em> of FOSS.
		</p>
		<div class="flex gap-3">
			<a href="/blog" class="btn preset-filled-primary-500">Read the Blog</a>
			<a href="/cv" class="btn preset-outlined-primary-500">View CV</a>
		</div>
	</section>

	<!-- 5. Identity / tech badge cloud -->
	<section class="mb-8">
		<div class="flex flex-wrap gap-1.5 justify-center">
			{#each IDENTITY_BADGES as badge}
				<img
					src={badgeUrl(badge.text, badge.color, { logo: badge.logo, emoji: badge.emoji })}
					alt={badge.text}
					height="20"
				/>
			{/each}
		</div>
	</section>

	<!-- 6. Featured + Recent Posts -->
	{#if data.featured.length > 0}
		<section class="mb-12">
			<h2 class="text-2xl font-semibold mb-4">Featured</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{#each data.featured as post, i}
					{@const variants = ['preset-filled-primary-500', 'preset-filled-secondary-500', 'preset-filled-tertiary-500', 'preset-filled-success-500', 'preset-filled-warning-500', 'preset-filled-error-500']}
					<a href="/blog/{post.slug}" class="block card p-5 hover:ring-2 ring-primary-500 transition-all {data.featured.length === 1 ? 'sm:col-span-2' : ''}">
						<div class="flex items-start justify-between gap-3">
							<div>
								<h3 class="text-lg font-bold">{post.title}</h3>
								{#if post.description}
									<p class="text-sm text-surface-500 mt-1 line-clamp-3">{post.description}</p>
								{/if}
							</div>
							{#if post.category}
								<span class="badge {variants[i % variants.length]} text-xs whitespace-nowrap">{post.category}</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 mt-3">
							<time class="text-xs text-surface-500">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
							{#if post.reading_time}
								<span class="text-xs text-surface-400">{post.reading_time} min read</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Recent Posts</h2>
		{#if data.posts.length > 0}
			<div class="space-y-4">
				{#each data.posts as post, i}
					{@const variants = ['preset-outlined-primary-500', 'preset-outlined-secondary-500', 'preset-outlined-tertiary-500', 'preset-outlined-success-500', 'preset-outlined-warning-500', 'preset-outlined-error-500']}
					<a href="/blog/{post.slug}" class="block card p-4 hover:ring-2 ring-primary-500 transition-all">
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="font-semibold">{post.title}</h3>
							<div class="flex items-center gap-2">
								{#if post.category}
									<span class="badge {variants[i % variants.length]} text-xs">{post.category}</span>
								{/if}
								<time class="text-xs text-surface-500 whitespace-nowrap">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
							</div>
						</div>
						{#if post.description}
							<p class="text-sm text-surface-500 mt-1 line-clamp-2">{post.description}</p>
						{/if}
					</a>
				{/each}
			</div>
			<a href="/blog" class="inline-block mt-4 text-sm text-primary-500 hover:underline">View all posts &rarr;</a>
		{:else}
			<p class="text-surface-500">No posts yet.</p>
		{/if}
	</section>

	<!-- 7. GitHub Activity -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">GitHub Activity</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
			<ThemedImage
				lightSrc={THEMED_IMAGES.githubStats.light}
				darkSrc={THEMED_IMAGES.githubStats.dark}
				alt={THEMED_IMAGES.githubStats.alt}
				class="w-full"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.topLangs.light}
				darkSrc={THEMED_IMAGES.topLangs.dark}
				alt={THEMED_IMAGES.topLangs.alt}
				class="w-full"
			/>
		</div>
		<div class="mb-4">
			<ThemedImage
				lightSrc={THEMED_IMAGES.snake.light}
				darkSrc={THEMED_IMAGES.snake.dark}
				alt={THEMED_IMAGES.snake.alt}
				class="w-full"
			/>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<ThemedImage
				lightSrc={THEMED_IMAGES.streak.light}
				darkSrc={THEMED_IMAGES.streak.dark}
				alt={THEMED_IMAGES.streak.alt}
				class="w-full"
			/>
			<ThemedImage
				lightSrc={THEMED_IMAGES.activityGraph.light}
				darkSrc={THEMED_IMAGES.activityGraph.dark}
				alt={THEMED_IMAGES.activityGraph.alt}
				class="w-full"
			/>
		</div>
	</section>

	<!-- 8. Repository Similarity Graph -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Repository Similarity Graph</h2>
		<ThemedImage
			lightSrc={THEMED_IMAGES.repoGraph.light}
			darkSrc={THEMED_IMAGES.repoGraph.dark}
			alt={THEMED_IMAGES.repoGraph.alt}
			class="w-full"
		/>
		<p class="text-sm text-surface-500 mt-2 text-center italic">Jaccard similarity of repository language distributions</p>
	</section>

	<!-- 9. Experience -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Experience</h2>
		<div class="space-y-6">
			{#each experience as e}
				<div>
					<h3 class="font-semibold">{e.role} &mdash; {e.org}</h3>
					<p class="text-sm text-surface-500 mb-2">{e.period}</p>
					<ul class="list-disc list-inside text-surface-600-400 space-y-1">
						{#each e.highlights as h}
							<li>{h}</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>

	<!-- 10. Ventures -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Ventures</h2>
		<div class="space-y-4">
			{#each ventures as v}
				<div>
					<h3 class="font-semibold">
						{#if v.url}
							<a href={v.url} class="text-primary-500 hover:underline" target="_blank" rel="noopener">{v.name}</a>
						{:else}
							{v.name}
						{/if}
					</h3>
					<p class="text-sm text-surface-500">{v.period} &mdash; {v.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- 11. Clients -->
	<section class="mb-12">
		<h3 class="text-sm font-semibold uppercase text-surface-500 mb-3">Clients</h3>
		<div class="flex flex-wrap gap-2">
			{#each CLIENT_BADGES as client}
				<img
					src={badgeUrl(client.text, client.color)}
					alt={client.text}
					height="20"
				/>
			{/each}
		</div>
	</section>

	<!-- 12. FOSS -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">FOSS</h2>
		<h3 class="text-sm font-semibold uppercase text-surface-500 mb-3">Original Projects</h3>
		{#each fossCategories as cat}
			<h4 class="text-xs font-semibold uppercase tracking-wider text-surface-400 mt-4 mb-2">{cat.label}</h4>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
				{#each cat.projects as proj}
					<a href={proj.url} class="card p-4 hover:ring-2 ring-primary-500 transition-all" target="_blank" rel="noopener">
						<h5 class="font-semibold">{proj.name}</h5>
						<p class="text-sm text-surface-500 mt-1">{proj.desc}</p>
					</a>
				{/each}
			</div>
		{/each}
		<h3 class="text-sm font-semibold uppercase text-surface-500 mt-6 mb-3">Contributor & Maintainer</h3>
		<div class="flex flex-wrap gap-2">
			{#each fossContributions as c}
				<a href={c.url} target="_blank" rel="noopener" class="badge preset-outlined-primary-500 hover:preset-filled-primary-500 transition-all">{c.name}</a>
			{/each}
		</div>
	</section>

	<!-- 13. Community -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Community</h2>
		<ul class="list-disc list-inside text-surface-600-400 space-y-2">
			<li><strong>RESF Community Member</strong> &mdash; Rocky Enterprise Linux Foundation</li>
			<li><strong>First Fellow</strong> &mdash; D&M Makerspace, Plymouth State University (2017&ndash;2020)</li>
			<li>Taught Advanced GIS Programming & Intro to Electromechanics at PSU</li>
			<li><strong>Membership Chair & 3D Printing Captain</strong> &mdash; Ithaca Generator (2020&ndash;2022)</li>
			<li><strong>COVID-19 PPE manufacturing coordination</strong> across New England makerspaces</li>
		</ul>
	</section>

	<!-- 14. Beyond Code -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Beyond Code</h2>
		<div class="space-y-4">
			<div>
				<h3 class="font-semibold mb-2">Photography</h3>
				<p class="text-surface-600-400 leading-relaxed">
					Cut my teeth professionally with world-renowned aerial photographer Alex MacLean
					and Mike Nyman Wedding Photography before going into business as J.S. Event Photography.
					Wrote and taught the youth photography curriculum at Joppa Flats and Drumlin Farm
					Mass Audubon Wildlife Sanctuaries &mdash; programs still going strong.
					Work featured at Celebrate Newton, Newton Public Library, Pease Public Library,
					Newtonville Cinema, Newton Camera Club, Broadmoor Wildlife Sanctuary, and in the Newton Tab.
					Did my own printing on a heavily modified inkjet printer.
					Completely burnt out from photography by end of 2017, sold all my gear by the end of college.
				</p>
			</div>
			<div>
				<h3 class="font-semibold mb-2">Music</h3>
				<p class="text-surface-600-400 leading-relaxed">
					20+ years of guitar &mdash; currently play a custom 9-string electric made for me in NH
					and a 12-string acoustic. 25+ years of piano/organ &mdash; primarily on a rotary Yamaha organ these days.
				</p>
				<blockquote class="border-l-2 border-primary-500 pl-4 mt-3 italic text-surface-500">
					"If there were no computers I'd probably be a baker, a minstrel or a bard."
				</blockquote>
			</div>
			<div>
				<h3 class="font-semibold mb-2">Hospitality</h3>
				<p class="text-surface-600-400 leading-relaxed">
					Evening bartender & event organizer at Modern Alchemy Game Bar in Ithaca &mdash;
					organized monthly Goth Nights, art shows & private events.
					Bartender at The Downstairs Listening Room & Tavern and The Watershed in New York.
					Casual bagel baker at Tandem Bagel Co in Northampton, MA (Spring 2024).
				</p>
			</div>
		</div>
	</section>

	<!-- 15. Learning Formula -->
	<section class="mb-12 text-center">
		<img src="/images/CodeCogsEqn-1.png" alt="Learning = internet * (time + standards * Ambition) / Difficulty" width="400" class="mx-auto" />
	</section>

	<!-- 16. Links -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-3">Links</h2>
		<ul class="space-y-2">
			<li><a href="https://github.com/Jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">GitHub</a></li>
			<li><a href="https://gitlab.com/jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">GitLab</a></li>
			<li><a href="https://xoxd.ai" class="text-primary-500 hover:underline" target="_blank" rel="noopener">xoxd.ai</a></li>
			<li><a href="https://tinyland.dev" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Tinyland.dev</a></li>
			<li><a href="/cv" class="text-primary-500 hover:underline">CV / Resume</a></li>
			<li><a href="/blog" class="text-primary-500 hover:underline">Blog</a></li>
			<li><a href="https://github.com/sponsors/Jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Sponsor</a></li>
			<li><a href="https://www.eff.org/" class="text-primary-500 hover:underline" target="_blank" rel="noopener">EFF Member</a></li>
			<li>
				<a href="https://www.fightforthefuture.org/" target="_blank" rel="noopener">
					<img src="/images/idl_badge.png" alt="Member of The Internet Defense League" height="20" class="inline" />
				</a>
			</li>
		</ul>
	</section>

</div>
