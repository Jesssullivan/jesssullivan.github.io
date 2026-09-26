<script lang="ts">
	import type { PageData } from './$types';
	import ThemedImage from '$lib/components/ThemedImage.svelte';
	import {
		profile,
		profileAsset,
		svgPair,
		imageForSlot,
		period,
		projectGroups,
		currentRole,
		personSameAs,
	} from '$lib/data/profile';

	let { data }: { data: PageData } = $props();

	// R53: every claim below comes from static/profile/facts.json (synced from
	// spear_resumes). Hand-written here: the offline-year note, Beyond Code, the
	// post lists, the page meta description and the blog-local link extras.
	const identity = profile.identity;
	const role = currentRole();
	const groups = projectGroups();
	// Intrinsic sizes (the SVG viewBoxes) reserve layout space before load.
	const charts = {
		timeline: { ...svgPair('timeline'), width: 960, height: 550 },
		projectMap: { ...svgPair('project-map'), width: 960, height: 740 },
		languages: { ...svgPair('languages'), width: 960, height: 402 },
		upstream: { ...svgPair('upstream'), width: 960, height: 534 },
	};
	const learning = imageForSlot('closing');
	const linkBadge = imageForSlot('links');
	const upstreamProjects = new Set(profile.merged_upstream.map((u) => u.project));
	const otherRelations = profile.relations.filter((r) => !upstreamProjects.has(r.project) && 'url' in r && r.url);

	// R54: blog-local extras, appended after the facts links. Nothing here may
	// repeat a facts link (facts already carry GitHub, Blog, CV, AAG poster,
	// LinkedIn, xoxd.ai and Email).
	const blogLinks: { label: string; url: string }[] = [
		{ label: 'GitLab', url: 'https://gitlab.com/jesssullivan' },
		{ label: 'Signal Boosts', url: '/signal-boosts' },
		{ label: 'Making', url: '/making' },
		{ label: 'Thingiverse', url: 'https://www.thingiverse.com/Jesssullivan/designs' },
		{ label: 'SketchUp 3D Warehouse', url: 'https://3dwarehouse.sketchup.com/by/Jesssullivan' },
		{ label: 'YouTube', url: 'https://www.youtube.com/@jesssullivan' },
		{ label: 'SoundCloud', url: 'https://soundcloud.com/jesssullivan' },
		{ label: 'Sponsor', url: 'https://github.com/sponsors/Jesssullivan' },
		{ label: 'EFF Member', url: 'https://www.eff.org/' },
	];
	const factUrls = new Set(profile.links.map((l) => l.url));
	const extraLinks = blogLinks.filter((l) => !factUrls.has(l.url));

	function isExternal(url: string): boolean {
		return /^https?:\/\//.test(url);
	}

	const personLd = {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: identity.name,
		url: 'https://transscendsurvival.org',
		jobTitle: role.title,
		worksFor: { '@type': 'Organization', name: role.org },
		sameAs: personSameAs(),
		description: identity.summary,
	};
</script>

<svelte:head>
	<title>About | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME &amp; Boston, MA." />
	<meta property="og:title" content="About | transscendsurvival.org" />
	<meta property="og:description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME &amp; Boston, MA." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/about" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="About | transscendsurvival.org" />
	<meta name="twitter:description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME &amp; Boston, MA." />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org/about" />
	{@html `<script type="application/ld+json">${JSON.stringify(personLd).replace(/</g, '\\u003c')}</script>`}
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<h1 class="text-3xl font-bold mb-8">About</h1>

	<!-- Intro (facts identity) -->
	<section class="mb-8" id="profile-intro">
		<p class="text-lg font-semibold">{identity.headline}</p>
		{#each identity.taglines as tagline}
			<p class="text-sm text-surface-500 mb-4">{tagline}</p>
		{/each}
		<p class="text-surface-600-400 leading-relaxed mb-4">{identity.summary}</p>
		<p class="text-sm text-surface-500 mb-4">{identity.location}</p>
		<p class="text-surface-600-400 leading-relaxed mb-4">
			I spent about a year completely offline &mdash; no LinkedIn, no blog, no social media.
			Late 2023 through the end of 2024. An intentional disconnect.
			I'm back to building in the open.
		</p>
		<blockquote class="border-l-2 border-primary-500 pl-4 mb-4 italic text-surface-500">
			{identity.always_building}
		</blockquote>
		<div class="flex gap-3">
			<a href="/blog" class="btn preset-filled-primary-500">Read the Blog</a>
			<a href="/cv" class="btn preset-outlined-primary-500">View CV</a>
		</div>
	</section>

	<!-- Featured + Recent Posts (blog data) -->
	{#if data.featured.length > 0}
		<section class="mb-12">
			<h2 class="text-2xl font-semibold mb-4">Featured</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{#each data.featured as post, i}
					{@const variants = ['preset-filled-primary-500', 'preset-filled-secondary-500', 'preset-filled-tertiary-500', 'preset-filled-success-500', 'preset-filled-warning-500', 'preset-filled-error-500']}
					<a
						href="/blog/{post.slug}"
						class="block card p-5 hover:ring-2 ring-primary-500 transition-all {data.featured.length === 1 ? 'sm:col-span-2' : ''}"
						aria-label={`Read featured post: ${post.title}`}
					>
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
					<a
						href="/blog/{post.slug}"
						class="block card p-4 hover:ring-2 ring-primary-500 transition-all"
						aria-label={`Read recent post: ${post.title}`}
					>
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

	<!-- Experience (facts roles) -->
	<section class="mb-12" id="experience">
		<h2 class="text-2xl font-semibold mb-4">Experience</h2>
		<div class="space-y-6">
			{#each profile.roles as r}
				<div>
					<h3 class="font-semibold">{r.title} &mdash; {r.org}</h3>
					<p class="text-sm text-surface-500 mb-2">{period(r)}</p>
					<p class="text-surface-600-400 mb-2">{r.summary}</p>
					{#if r.bullets.length > 0}
						<ul class="list-disc list-inside text-surface-600-400 space-y-1">
							{#each r.bullets as b}
								<li>{b}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
		<div class="mt-6">
			<ThemedImage lightSrc={charts.timeline.light} darkSrc={charts.timeline.dark} alt="Roles and ventures timeline" width={charts.timeline.width} height={charts.timeline.height} class="w-full h-auto" />
		</div>
	</section>

	<!-- Ventures (facts ventures) -->
	<section class="mb-12" id="ventures">
		<h2 class="text-2xl font-semibold mb-4">Ventures</h2>
		<div class="space-y-4">
			{#each profile.ventures as v}
				<div>
					<h3 class="font-semibold">
						{#if 'url' in v && v.url}
							<a href={v.url} class="text-primary-500 hover:underline" target="_blank" rel="noopener" aria-label={`Visit ${v.name}`}>{v.name}</a>
						{:else}
							{v.name}
						{/if}
						{#if 'role' in v && v.role}
							<span class="text-sm font-normal text-surface-500">&middot; {v.role}</span>
						{/if}
					</h3>
					<p class="text-sm text-surface-500">{period(v)} &mdash; {v.description}</p>
					{#if 'product_line' in v && v.product_line}
						<p class="text-sm text-surface-500 mt-1">{v.product_line}</p>
					{/if}
					{#if 'infra' in v && v.infra}
						<p class="text-sm text-surface-500 mt-1">{v.infra}</p>
					{/if}
					{#if 'github' in v && v.github}
						<a href={v.github} class="text-xs text-primary-500 hover:underline" target="_blank" rel="noopener" aria-label={`${v.name} on GitHub`}>{v.name} on GitHub</a>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Projects (facts project map + table) -->
	<section class="mb-12" id="projects">
		<h2 class="text-2xl font-semibold mb-4">Projects</h2>
		<ThemedImage lightSrc={charts.projectMap.light} darkSrc={charts.projectMap.dark} alt="Project map of public repositories by category" width={charts.projectMap.width} height={charts.projectMap.height} class="w-full mb-4 h-auto" />
		<div class="overflow-x-auto">
			<table class="table w-full text-sm" data-testid="project-table">
				<thead>
					<tr>
						<th class="text-left">Project</th>
						<th class="text-left">Category</th>
					</tr>
				</thead>
				<tbody>
					{#each groups as g}
						{#each g.rows as row}
							<tr>
								<td>
									{#if row.urls.length > 0}
										<a href={row.urls[0]} class="text-primary-500 hover:underline" target="_blank" rel="noopener">{row.label}</a>
										{#each row.urls.slice(1) as url, i}
											<a href={url} class="text-primary-500 hover:underline ml-1" target="_blank" rel="noopener" aria-label={`${row.label}, repository ${i + 2}`}>[{i + 2}]</a>
										{/each}
									{:else}
										{row.label}
									{/if}
								</td>
								<td class="text-surface-500">{g.label}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
		<div class="mt-6">
			<ThemedImage lightSrc={charts.languages.light} darkSrc={charts.languages.dark} alt="Language mix across the mapped public repositories" width={charts.languages.width} height={charts.languages.height} class="w-full h-auto" />
		</div>
	</section>

	<!-- Merged upstream (facts merged_upstream + relations) -->
	<section class="mb-12" id="upstream">
		<h2 class="text-2xl font-semibold mb-4">Merged Upstream</h2>
		<ThemedImage lightSrc={charts.upstream.light} darkSrc={charts.upstream.dark} alt="Merged upstream work by project and merge date" width={charts.upstream.width} height={charts.upstream.height} class="w-full mb-4 h-auto" />
		<ul class="space-y-1 text-surface-600-400" data-testid="upstream-list">
			{#each profile.merged_upstream as u}
				<li>
					<a href={u.url} class="text-primary-500 hover:underline" target="_blank" rel="noopener">{u.project}</a>
					{#if u.relation}<span class="text-surface-500"> ({u.relation})</span>{/if}
					<span class="text-xs text-surface-500">&middot; merged {u.merged}</span>
				</li>
			{/each}
		</ul>
		{#if otherRelations.length > 0}
			<h3 class="text-sm font-semibold uppercase text-surface-500 mt-6 mb-2">Also</h3>
			<div class="flex flex-wrap gap-2">
				{#each otherRelations as r}
					<a href={'url' in r ? r.url : undefined} target="_blank" rel="noopener" class="badge preset-outlined-primary-500 hover:preset-filled-primary-500 transition-all">{r.project} ({r.relation})</a>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Community (facts community) -->
	<section class="mb-12" id="community">
		<h2 class="text-2xl font-semibold mb-4">Community</h2>
		<ul class="list-disc list-inside text-surface-600-400 space-y-2">
			{#each profile.community as c}
				<li>{c}</li>
			{/each}
		</ul>
	</section>

	<!-- Publications (facts publications) -->
	<section class="mb-12" id="publications">
		<h2 class="text-2xl font-semibold mb-4">Publications</h2>
		<ul class="space-y-3 text-surface-600-400">
			{#each profile.publications as pub}
				<li>
					{pub.authors} ({pub.year}).
					{#if 'url' in pub && pub.url}
						<a href={pub.url} class="text-primary-500 hover:underline" target={isExternal(pub.url) ? '_blank' : undefined} rel={isExternal(pub.url) ? 'noopener' : undefined}>{pub.title}</a>.
					{:else}
						{pub.title}.
					{/if}
					{#if 'venue' in pub && pub.venue}<em>{pub.venue}</em>.{/if}
				</li>
			{/each}
		</ul>
	</section>

	<!-- Beyond Code (hand-written, R53) -->
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

	<!-- Learning formula (facts image, closing slot) -->
	{#if learning}
		<section class="mb-12 text-center">
			<ThemedImage
				lightSrc={profileAsset(learning.src)}
				darkSrc={profileAsset(learning.src_dark ?? learning.src)}
				alt={learning.alt}
				width="400"
				height="46"
				class="mx-auto h-auto"
			/>
		</section>
	{/if}

	<!-- Links: facts links first, then blog-local extras (R54) -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-3">Links</h2>
		<div class="flex flex-wrap gap-x-4 gap-y-2 items-center" data-testid="profile-links">
			{#each profile.links as l}
				<a href={l.url} class="text-primary-500 hover:underline" target={isExternal(l.url) ? '_blank' : undefined} rel={isExternal(l.url) ? 'noopener' : undefined}>{l.label}</a>
			{/each}
			{#each extraLinks as l}
				<a href={l.url} class="text-primary-500 hover:underline" target={isExternal(l.url) ? '_blank' : undefined} rel={isExternal(l.url) ? 'noopener' : undefined}>{l.label}</a>
			{/each}
			{#if linkBadge && 'url' in linkBadge && linkBadge.url}
				<a href={linkBadge.url} target="_blank" rel="noopener" aria-label="Visit Fight for the Future">
					<img src={profileAsset(linkBadge.src)} alt={linkBadge.alt} height="20" class="inline h-5" />
				</a>
			{/if}
		</div>
	</section>

</div>
