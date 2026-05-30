<script lang="ts">
	import { onMount } from 'svelte';

	type Tab = 'resume' | 'resume_targeted' | 'cv';

	let activeTab = $state<Tab>('resume');
	let hydrated = $state(false);

	const docs: Record<Tab, { label: string; file: string; iframeTitle: string; downloadLabel: string }> = {
		resume: {
			label: 'Resume',
			file: '/cv/jess_sullivan_resume.pdf',
			iframeTitle: 'Jess Sullivan Resume',
			downloadLabel: 'Download Resume PDF',
		},
		resume_targeted: {
			label: 'Resume — Targeted',
			file: '/cv/jess_sullivan_resume_targeted.pdf',
			iframeTitle: 'Jess Sullivan Resume — Targeted',
			downloadLabel: 'Download Targeted Resume PDF',
		},
		cv: {
			label: 'Full CV',
			file: '/cv/jess_sullivan_cv.pdf',
			iframeTitle: 'Jess Sullivan Full CV',
			downloadLabel: 'Download Full CV PDF',
		},
	};

	const order: Tab[] = ['resume', 'resume_targeted', 'cv'];

	function setActiveTab(tab: Tab): void {
		activeTab = tab;
	}

	onMount(() => {
		hydrated = true;
	});
</script>

<svelte:head>
	<title>CV | transscendsurvival.org</title>
	<meta name="description" content="Jess Sullivan — CV and Resume. Systems Analyst, FOSS contributor, hardware hacker." />
	<meta property="og:title" content="CV | transscendsurvival.org" />
	<meta property="og:description" content="Jess Sullivan — CV and Resume. Systems Analyst, FOSS contributor, hardware hacker." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://transscendsurvival.org/cv" />
	<meta property="og:image" content="https://transscendsurvival.org/images/header.png" />
	<meta property="og:site_name" content="transscendsurvival.org" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:image" content="https://transscendsurvival.org/images/header.png" />
	<link rel="canonical" href="https://transscendsurvival.org/cv" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-4xl">
	<h1 class="text-3xl font-bold mb-2">CV / Resume</h1>
	<p class="text-sm text-surface-400 mb-6">
		Built with XeLaTeX via <a href="https://tectonic-typesetting.github.io/" target="_blank" rel="noopener" class="hover:text-primary-500 underline">Tectonic</a>,
		orchestrated by <a href="https://github.com/Jesssullivan/rules_tectonic" target="_blank" rel="noopener" class="hover:text-primary-500 underline">rules_tectonic</a>.
		Sources live in <a href="https://github.com/Jesssullivan/spear-resumes" target="_blank" rel="noopener" class="hover:text-primary-500 underline">spear-resumes</a>;
		PDFs are <a href="https://github.com/Jesssullivan/jesssullivan.github.io/blob/main/.github/workflows/build-cv.yml" target="_blank" rel="noopener" class="hover:text-primary-500 underline">synced into this site by CI</a>.
	</p>

	<!-- Tab switcher -->
	<div class="flex flex-wrap items-center gap-2 mb-6">
		{#each order as tab}
			<button
				class="btn text-sm {activeTab === tab ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
				disabled={!hydrated}
				onclick={() => setActiveTab(tab)}
			>{docs[tab].label}</button>
		{/each}
	</div>

	<!-- Action bar -->
	<div class="flex flex-wrap items-center gap-3 mb-6">
		<a href={docs[activeTab].file} download class="btn preset-filled-primary-500 text-sm">{docs[activeTab].downloadLabel}</a>
		<a
			href="https://github.com/Jesssullivan/spear-resumes"
			target="_blank"
			rel="noopener"
			class="btn preset-outlined-surface-500 text-sm"
		>View TeX Source</a>
	</div>

	<!-- PDF viewer -->
	<div class="card mb-8">
		<iframe
			src={docs[activeTab].file}
			class="w-full h-[85dvh]"
			title={docs[activeTab].iframeTitle}
		></iframe>
	</div>

	<!-- Build flow diagram -->
	<section class="mb-8" aria-labelledby="cv-build-flow-heading">
		<h2 id="cv-build-flow-heading" class="text-lg font-semibold mb-3">How these PDFs are built</h2>
		<div class="card p-4 flex justify-center">
			<img
				src="/cv/build-flow.svg"
				alt="Build flow: private spear-resumes XeLaTeX sources (//generic:resume, //generic:cv, //cra:resume) compile via rules_tectonic using the Tectonic XeLaTeX engine, producing three PDFs; bazel run //static/cv:sync_pdfs writes them into static/cv/ in this repo, which the /cv page serves as an iframe per tab. The build-cv.yml GitHub Actions workflow fetches the private source with an SSH deploy key, installs bazelisk, runs the sync, and auto-commits the refreshed PDFs."
				class="max-w-full h-auto"
				loading="lazy"
			/>
		</div>
	</section>
</div>
