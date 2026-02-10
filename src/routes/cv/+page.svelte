<svelte:head>
	<title>CV | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan — CV and Resume. Systems Analyst, FOSS contributor, hardware hacker." />
	<meta property="og:title" content="CV | transscendsurvival.org" />
	<meta property="og:description" content="Jess Sullivan — CV and Resume. Systems Analyst, FOSS contributor, hardware hacker." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/cv" />
	<meta name="twitter:card" content="summary" />
	<link rel="canonical" href="https://transscendsurvival.org/cv" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-3xl">
	<div class="flex items-baseline justify-between mb-8">
		<h1 class="text-3xl font-bold">CV / Resume</h1>
		<a href="/cv/jess_sullivan_cv.pdf" download class="btn preset-filled-primary-500 text-sm">Download PDF</a>
	</div>

	<div class="card p-6 mb-8">
		<object
			data="/cv/jess_sullivan_cv.pdf"
			type="application/pdf"
			class="w-full h-[80vh] rounded-lg"
			title="Jess Sullivan CV"
		>
			<p class="text-surface-500">
				PDF preview not available in your browser.
				<a href="/cv/jess_sullivan_cv.pdf" download class="text-primary-500 hover:underline">Download the PDF</a> instead.
			</p>
		</object>
	</div>

	<section class="prose max-w-none">
		<h2>Summary</h2>

		<p>Full stack engineer, musician and birdwatcher based in Lewiston, ME.</p>

		<h3>Experience</h3>

		<h4>Systems Analyst (DevSecOps) &mdash; Bates College <span class="text-surface-500 font-normal">(2024&ndash;Present)</span></h4>
		<ul>
			<li>Maintenance and modernization of legacy systems; bespoke Ansible extensions, roles, and plugins</li>
			<li>Degree audit orchestration tooling in Haskell + Python (QuickCheck, Cabal, FPM, autodevops)</li>
			<li>Event management system overhaul (C#, Go, Ansible)</li>
			<li>Apache Solr adoption for indexing and search</li>
			<li>ACME-first certificate management, SAML integrations, KeePassXC declarative workflows</li>
			<li>CI/CD pipelines: GitLab AutoDevOps, OpenTofu, RKE2 + Rancher</li>
		</ul>

		<h4>Computer Vision Software Engineer &mdash; Macaulay Library <span class="text-surface-500 font-normal">(2018&ndash;2022)</span></h4>
		<ul>
			<li>Developed &amp; launched Merlin Sound ID &amp; The Machine Learning Blog</li>
			<li>Fine-grained ML annotation tools for audio classification</li>
			<li>Internal classification and model evaluation web APIs</li>
			<li>Stack: Python (TensorFlow, NumPy, Pandas), Flask, TypeScript, Docker, WebAssembly</li>
		</ul>

		<h4>Fabrication Lab Manager &mdash; Cornell CALS <span class="text-surface-500 font-normal">(2021&ndash;2022)</span></h4>
		<ul>
			<li>Rapid fabrication curricula for Landscape Architecture students and faculty</li>
			<li>OpenSCAD, Fusion 360, C++ tiler development</li>
		</ul>

		<h3>Ventures</h3>

		<h4>Tinyland.dev, Inc <span class="text-surface-500 font-normal">(2024&ndash;Present)</span></h4>
		<p>Semiautonomous infrastructure maintenance platform for higher ed. 5 bespoke SLMs, 100+ autonomous tools. Chapel, Python, Go, Kubernetes (Liqo), Apache Solr.</p>

		<h4>Columbari.us LLC <span class="text-surface-500 font-normal">(2017&ndash;2021)</span></h4>
		<p>Independent contractor in GIS &amp; ML. Clients included National Park Service, Foundation for Healthy Communities, GPRED, Northern Border Regional Commission.</p>

		<h3>FOSS Contributions</h3>
		<p>Rocky Enterprise Linux Foundation, Liqo (CERN), Apache Solr, Caddy, libdns, Skeleton UI, Klipper, KeePassXC, SearXNG, BrainFlow, EyeTrackVR, and more.</p>

		<h3>Community</h3>
		<ul>
			<li>First Fellow &mdash; D&amp;M Makerspace at Plymouth State University (2017&ndash;2020)</li>
			<li>Taught Advanced GIS Programming &amp; Intro to Electromechanics at PSU</li>
			<li>Membership Chair &amp; 3D Printing Captain &mdash; Ithaca Generator (2020&ndash;2022)</li>
			<li>COVID-19 PPE manufacturing coordination across New England makerspaces</li>
		</ul>

		<h3>Current Stack</h3>
		<ul>
			<li><strong>Web</strong>: SvelteKit, Svelte 5 runes, TypeScript, Vite (rolldown)</li>
			<li><strong>HPC</strong>: Chapel, Haskell</li>
			<li><strong>Infrastructure</strong>: Ansible, GitLab CI, Kubernetes (RKE2, Liqo), OpenTofu</li>
			<li><strong>Learning</strong>: Nix, Rust SIMD</li>
		</ul>
	</section>
</div>
