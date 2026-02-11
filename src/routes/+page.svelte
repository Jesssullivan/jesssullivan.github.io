<script lang="ts">
	import type { PageData } from './$types';
	import { browser } from '$app/environment';
	let { data }: { data: PageData } = $props();

	let scrollY = $state(0);
	let parallaxOffset = $derived(scrollY * 0.33);
	let titleOpacity = $derived(Math.max(0, 1 - scrollY / 300));

	$effect(() => {
		if (!browser) return;

		let ticking = false;
		function onScroll() {
			if (!ticking) {
				requestAnimationFrame(() => {
					scrollY = window.scrollY;
					ticking = false;
				});
				ticking = true;
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const ventures = [
		{ name: 'Tinyland.dev', url: 'https://tinyland.dev', period: '2024-Present', desc: 'Funded, stealthmode. Tinyland is big, more to come very soon.' },
		{ name: 'xoxd.ai', url: 'https://xoxd.ai', period: '2024-Present', desc: 'Massively parallel, provable, ownable agent infrastructure. 130+ agents, 5 custom models.' },
		{ name: 'Columbari.us', url: 'https://columbari.us', period: '2017-2021', desc: 'Independent Gov. contractor in GIS & ML.' },
		{ name: 'Moonlight Coworking', url: null, period: '2024', desc: 'Shelved rapidfab / HPC hackerspace initiative in NY.' },
		{ name: 'Kitten Spit Labs', url: null, period: '2022-Present', desc: 'Ultrasonic phantom network gel synthesis. Currently on mfg. pause.' },
	];

	const experience = [
		{ role: 'Systems Analyst (DevSecOps)', org: 'Bates College', period: '2024-Present', highlights: 'Legacy modernization, Ansible extensions, Apache Solr, ACME/SAML, GitLab AutoDevOps, RKE2 + Rancher, Haskell + Python tooling' },
		{ role: 'CV/ML Software Engineer', org: 'Macaulay Library', period: '2018-2022', highlights: 'Merlin Sound ID, fine-grained ML annotation, classification APIs, TensorFlow/NumPy/Flask/WASM' },
		{ role: 'Fabrication Lab Manager', org: 'Cornell CALS', period: '2021-2022', highlights: 'Rapid fabrication curricula, OpenSCAD, Fusion 360, C++ tiler development' },
	];

	const fossProjects = [
		{ name: 'quickchpl', url: 'https://github.com/Jesssullivan/quickchpl', desc: 'Property-Based Testing for Chapel' },
		{ name: 'GloriousFlywheel', url: 'https://github.com/Jesssullivan/GloriousFlywheel', desc: 'Recursive IaC flywheel for GitLab' },
		{ name: 'XoxdWM', url: 'https://github.com/Jesssullivan/XoxdWM', desc: 'Eye-gesture VR & BCI XWayland Emacs WM' },
	];

	const fossContributions = [
		{ name: 'Chapel', url: 'https://chapel-lang.org/' },
		{ name: 'Futhark', url: 'https://futhark-lang.org/' },
		{ name: 'SearXNG', url: 'https://github.com/searxng/searxng' },
		{ name: 'KeePassXC', url: 'https://keepassxc.org/' },
		{ name: 'Apache Solr', url: 'https://solr.apache.org/' },
		{ name: 'Skeleton UI', url: 'https://skeleton.dev/' },
	];
</script>

<svelte:head>
	<title>Jess Sullivan | transscendsurvival.org</title>
	<meta name="description" content="Full stack engineer, musician, and birdwatcher. Blog and portfolio by Jess Sullivan." />
	<meta property="og:title" content="Jess Sullivan | transscendsurvival.org" />
	<meta property="og:description" content="Full stack engineer, musician, and birdwatcher. Blog and portfolio by Jess Sullivan." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Jess Sullivan | transscendsurvival.org" />
	<meta name="twitter:description" content="Full stack engineer, musician, and birdwatcher. Blog and portfolio by Jess Sullivan." />
	<link rel="canonical" href="https://transscendsurvival.org" />
</svelte:head>

<!-- Hero with parallax -->
<section class="hero-parallax">
	<img
		src="/images/header.png"
		alt="Great Blue Heron"
		class="hero-parallax-bg"
		style="transform: translate3d(0, {parallaxOffset}px, 0)"
	/>
	<div class="hero-overlay"></div>
	<div class="hero-title-wrap" style="opacity: {titleOpacity}">
		<div class="container mx-auto max-w-3xl">
			<h1 class="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg tracking-wide">
				Trans Scend Survival
			</h1>
			<p class="text-lg sm:text-xl text-surface-200 mt-2 drop-shadow font-heading tracking-wider">
				Jess Sullivan &mdash; Systems Analyst | Lewiston, ME
			</p>
		</div>
	</div>
</section>

<div class="container mx-auto px-4 py-12 max-w-3xl">

	<!-- Intro -->
	<section class="mb-12">
		<p class="text-lg text-surface-600-400 mb-4">
			Full stack engineer, musician, and birdwatcher. I build infrastructure tooling, contribute to compilers and languages, hack on hardware, and maintain a lot of FOSS.
		</p>
		<p class="text-surface-500 mb-6">
			After spending a year completely offline (late 2023 &ndash; end 2024), I'm back to building in the open.
		</p>
		<div class="flex gap-3">
			<a href="/blog" class="btn preset-filled-primary-500">Read the Blog</a>
			<a href="/cv" class="btn preset-outlined-primary-500">View CV</a>
			<a href="/about" class="btn preset-outlined-surface-500">About</a>
		</div>
	</section>

	<!-- Recent Posts -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Recent Posts</h2>
		{#if data.posts.length > 0}
			<div class="space-y-4">
				{#each data.posts as post}
					<a href="/blog/{post.slug}" class="block card p-4 hover:ring-2 ring-primary-500 transition-all">
						<div class="flex items-baseline justify-between gap-4">
							<h3 class="font-semibold">{post.title}</h3>
							<time class="text-xs text-surface-500 whitespace-nowrap">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
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

	<!-- Ventures -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Ventures</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each ventures as v}
				<div class="card p-4">
					<div class="flex items-baseline justify-between gap-2">
						{#if v.url}
							<a href={v.url} target="_blank" rel="noopener" class="font-semibold text-primary-500 hover:underline">{v.name}</a>
						{:else}
							<span class="font-semibold">{v.name}</span>
						{/if}
						<span class="text-xs text-surface-500 whitespace-nowrap">{v.period}</span>
					</div>
					<p class="text-sm text-surface-500 mt-1">{v.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Experience -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Experience</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-surface-300-700 text-left">
						<th class="py-2 pr-4 font-semibold">Role</th>
						<th class="py-2 pr-4 font-semibold">Organization</th>
						<th class="py-2 pr-4 font-semibold">Period</th>
						<th class="py-2 font-semibold">Highlights</th>
					</tr>
				</thead>
				<tbody>
					{#each experience as e}
						<tr class="border-b border-surface-200-800">
							<td class="py-3 pr-4 font-medium">{e.role}</td>
							<td class="py-3 pr-4">{e.org}</td>
							<td class="py-3 pr-4 whitespace-nowrap text-surface-500">{e.period}</td>
							<td class="py-3 text-surface-500">{e.highlights}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- FOSS -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">FOSS</h2>
		<h3 class="text-sm font-semibold uppercase text-surface-500 mb-3">Original Projects</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			{#each fossProjects as proj}
				<a href={proj.url} class="card p-4 hover:ring-2 ring-primary-500 transition-all" target="_blank" rel="noopener">
					<h4 class="font-semibold">{proj.name}</h4>
					<p class="text-sm text-surface-500 mt-1">{proj.desc}</p>
				</a>
			{/each}
		</div>
		<h3 class="text-sm font-semibold uppercase text-surface-500 mb-3">Contributor & Maintainer</h3>
		<div class="flex flex-wrap gap-2">
			{#each fossContributions as c}
				<a href={c.url} target="_blank" rel="noopener" class="badge preset-outlined-primary-500 hover:preset-filled-primary-500 transition-all">{c.name}</a>
			{/each}
		</div>
	</section>

	<!-- Community -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Community</h2>
		<ul class="space-y-2 text-surface-600-400">
			<li><span class="font-medium">RESF Community Member</span> &mdash; Rocky Enterprise Linux Foundation</li>
			<li><span class="font-medium">First Fellow</span> &mdash; D&M Makerspace, Plymouth State University (2017-2020). Taught Advanced GIS Programming & Intro to Electromechanics.</li>
			<li><span class="font-medium">Membership Chair & 3D Printing Captain</span> &mdash; Ithaca Generator (2020-2022)</li>
			<li><span class="font-medium">COVID-19 PPE Manufacturing</span> &mdash; Coordination across New England makerspaces</li>
		</ul>
	</section>

	<!-- Beyond Code -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Beyond Code</h2>
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="card p-4">
				<h3 class="font-semibold mb-1">Photography</h3>
				<p class="text-sm text-surface-500">
					Worked with aerial photographer Alex MacLean. Wrote youth photography curricula for Mass Audubon. Work featured across New England galleries and libraries.
				</p>
			</div>
			<div class="card p-4">
				<h3 class="font-semibold mb-1">Music</h3>
				<p class="text-sm text-surface-500">
					20+ years of guitar (custom 9-string electric, 12-string acoustic). 25+ years of piano/organ on a rotary Yamaha organ.
				</p>
			</div>
			<div class="card p-4">
				<h3 class="font-semibold mb-1">Hospitality</h3>
				<p class="text-sm text-surface-500">
					Bartender & event organizer at Modern Alchemy Game Bar in Ithaca. Organized Goth Nights & art shows. Bagel baker at Tandem Bagel Co.
				</p>
			</div>
		</div>
		<blockquote class="border-l-4 border-primary-500 pl-4 mt-6 italic text-surface-500">
			"If there were no computers I'd probably be a baker, a minstrel or a bard."
		</blockquote>
	</section>

</div>
