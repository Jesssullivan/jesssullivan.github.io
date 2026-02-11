<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const ventures = [
		{ name: 'Tinyland.dev', url: 'https://tinyland.dev', period: '2024-Present', desc: 'Funded, stealthmode. Tinyland is big, more to come very soon.' },
		{ name: 'xoxd.ai', url: 'https://xoxd.ai', period: '2024-Present', desc: 'Massively parallel, provable, ownable agent infrastructure. 130+ agents, 5 custom models, Chapel + Go + K8s.' },
		{ name: 'Columbari.us', url: 'https://columbari.us', period: '2017-2021', desc: 'Independent Gov. contractor in GIS & ML.' },
		{ name: 'Moonlight Coworking', url: null, period: '2024', desc: 'Shelved rapidfab / HPC hackerspace initiative in NY.' },
		{ name: 'Kitten Spit Labs', url: null, period: '2022-Present', desc: 'Ultrasonic phantom network gel synthesis. Currently on mfg. pause.' },
	];

	const experience = [
		{ role: 'Systems Analyst (DevSecOps)', org: 'Bates College', period: '2024-Present', highlights: 'Legacy modernization, Ansible extensions, Apache Solr, ACME/SAML, GitLab AutoDevOps, RKE2 + Rancher, Haskell + Python tooling' },
		{ role: 'CV/ML Software Engineer', org: 'Macaulay Library', period: '2018-2022', highlights: 'Merlin Sound ID, fine-grained ML annotation, classification APIs, TensorFlow/NumPy/Flask/WASM' },
		{ role: 'Fabrication Lab Manager', org: 'Cornell CALS', period: '2021-2022', highlights: 'Rapid fabrication curricula, OpenSCAD, Fusion 360, C++ tiler development' },
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

	const clients = [
		'National Park Service',
		'Foundation for Healthy Communities',
		'GPRED',
		'Northern Border Regional Commission',
		'Plymouth State University',
		'Massage Ithaca',
		'Tetrahedron',
		'Rossel',
		'STNWL',
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
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Jess Sullivan | transscendsurvival.org" />
	<meta name="twitter:description" content="Full stack engineer, musician, and birdwatcher. Blog and portfolio by Jess Sullivan." />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org" />
</svelte:head>

<!-- Hero banner — Hemingway WP faithful -->
<section class="hero-banner">
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

	<!-- Featured Posts -->
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

	<!-- Recent Posts -->
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

	<!-- Clients -->
	<section class="mb-12">
		<h3 class="text-sm font-semibold uppercase text-surface-500 mb-3">Clients</h3>
		<div class="flex flex-wrap gap-2">
			{#each clients as client}
				<span class="badge preset-outlined-surface-500">{client}</span>
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
					Worked with aerial photographer Alex MacLean and Mike Nyman. Wrote youth photography curricula for Mass Audubon. Work featured at Newton Public Library, Broadmoor Wildlife Sanctuary, and more.
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
