<svelte:head>
	<title>About | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME." />
	<meta property="og:title" content="About | transscendsurvival.org" />
	<meta property="og:description" content="Jess Sullivan — full stack engineer, musician, and birdwatcher based in Lewiston, ME." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/about" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary" />
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

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<h1 class="text-3xl font-bold mb-8">About</h1>

	<section class="mb-8">
		<p class="text-surface-600-400 leading-relaxed mb-4">
			Full stack engineer, musician, and birdwatcher based in Lewiston, ME.
		</p>
		<p class="text-surface-600-400 leading-relaxed mb-4">
			I spent about a year completely offline &mdash; no LinkedIn, no blog, no social media.
			Late 2023 through the end of 2024. An intentional disconnect.
			I'm back to building in the open.
		</p>
		<p class="text-surface-600-400 leading-relaxed">
			I build infrastructure tooling, contribute to compilers and languages, hack on hardware,
			and maintain a <em>lot</em> of FOSS.
		</p>
	</section>

	<section class="mb-8">
		<h2 class="text-xl font-semibold mb-4">Experience</h2>

		<div class="space-y-6">
			<div>
				<h3 class="font-semibold">Systems Analyst (DevSecOps) &mdash; Bates College</h3>
				<p class="text-sm text-surface-500 mb-2">2024&ndash;Present</p>
				<ul class="list-disc list-inside text-surface-600-400 space-y-1">
					<li>Legacy modernization, bespoke Ansible extensions, roles & plugins</li>
					<li>Apache Solr, ACME cert management, SAML integrations</li>
					<li>GitLab AutoDevOps, RKE2 + Rancher, promoter of IaC practices</li>
					<li>Orchestration, packaging & tooling work (Haskell + Python, QuickCheck, Cabal, FPM)</li>
				</ul>
			</div>

			<div>
				<h3 class="font-semibold">CV/ML Software Engineer &mdash; Macaulay Library</h3>
				<p class="text-sm text-surface-500 mb-2">2018&ndash;2022</p>
				<ul class="list-disc list-inside text-surface-600-400 space-y-1">
					<li>Developed & launched <a href="https://merlin.allaboutbirds.org/" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Merlin Sound ID</a> & The Machine Learning Blog</li>
					<li>Fine-grained ML annotation tools for audio classification</li>
					<li>Internal classification & model evaluation web APIs</li>
					<li>Python (TensorFlow, NumPy, Pandas), Flask, TypeScript, Docker, WASM</li>
				</ul>
			</div>

			<div>
				<h3 class="font-semibold">Fabrication Lab Manager &mdash; Cornell CALS</h3>
				<p class="text-sm text-surface-500 mb-2">2021&ndash;2022</p>
				<ul class="list-disc list-inside text-surface-600-400 space-y-1">
					<li>Rapid fabrication curricula for Landscape Architecture students & faculty</li>
					<li>OpenSCAD, Fusion 360, C++ tiler development</li>
				</ul>
			</div>
		</div>
	</section>

	<section class="mb-8">
		<h2 class="text-xl font-semibold mb-4">Ventures</h2>

		<div class="space-y-4">
			<div>
				<h3 class="font-semibold"><a href="https://tinyland.dev" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Tinyland.dev, Inc</a></h3>
				<p class="text-sm text-surface-500">2024&ndash;Present &mdash; Funded, stealthmode</p>
			</div>

			<div>
				<h3 class="font-semibold"><a href="https://xoxd.ai" class="text-primary-500 hover:underline" target="_blank" rel="noopener">xoxd.ai</a></h3>
				<p class="text-sm text-surface-500">2024&ndash;Present &mdash; Seeking funding, stealthmode</p>
			</div>

			<div>
				<h3 class="font-semibold">Columbari.us LLC</h3>
				<p class="text-sm text-surface-500">2017&ndash;2021 &mdash; Independent Gov. contractor in GIS & ML</p>
			</div>

			<div>
				<h3 class="font-semibold">Moonlight Coworking LLC</h3>
				<p class="text-sm text-surface-500">2024 &mdash; Shelved rapidfab / HPC hackerspace initiative in NY</p>
			</div>

			<div>
				<h3 class="font-semibold">Kitten Spit Labs</h3>
				<p class="text-sm text-surface-500">2022&ndash;Present &mdash; Ultrasonic phantom network gel synthesis. Currently on mfg. pause.</p>
			</div>
		</div>
	</section>

	<section class="mb-8">
		<h2 class="text-xl font-semibold mb-4">Community</h2>

		<ul class="list-disc list-inside text-surface-600-400 space-y-2">
			<li><strong>RESF Community Member</strong> &mdash; Rocky Enterprise Linux Foundation</li>
			<li><strong>First Fellow</strong> &mdash; D&M Makerspace, Plymouth State University (2017&ndash;2020)</li>
			<li>Taught Advanced GIS Programming & Intro to Electromechanics at PSU</li>
			<li><strong>Membership Chair & 3D Printing Captain</strong> &mdash; Ithaca Generator (2020&ndash;2022)</li>
			<li><strong>COVID-19 PPE manufacturing coordination</strong> across New England makerspaces</li>
		</ul>
	</section>

	<section class="mb-8">
		<h2 class="text-xl font-semibold mb-4">Beyond Code</h2>

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

	<section>
		<h2 class="text-xl font-semibold mb-3">Links</h2>
		<ul class="space-y-2">
			<li><a href="https://github.com/Jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">GitHub</a></li>
			<li><a href="https://gitlab.com/jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">GitLab</a></li>
			<li><a href="https://xoxd.ai" class="text-primary-500 hover:underline" target="_blank" rel="noopener">xoxd.ai</a></li>
			<li><a href="https://tinyland.dev" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Tinyland.dev</a></li>
			<li><a href="/cv" class="text-primary-500 hover:underline">CV / Resume</a></li>
			<li><a href="/blog" class="text-primary-500 hover:underline">Blog</a></li>
			<li><a href="https://github.com/sponsors/Jesssullivan" class="text-primary-500 hover:underline" target="_blank" rel="noopener">Sponsor</a></li>
		</ul>
	</section>
</div>
