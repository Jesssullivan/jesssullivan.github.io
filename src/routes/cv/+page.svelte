<script lang="ts">
	let activeTab = $state<'cv' | 'resume'>('cv');
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
	<h1 class="text-3xl font-bold mb-6">CV / Resume</h1>

	<!-- Tab switcher -->
	<div class="flex items-center gap-2 mb-6">
		<button
			class="btn text-sm {activeTab === 'cv' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
			onclick={() => activeTab = 'cv'}
		>Full CV</button>
		<button
			class="btn text-sm {activeTab === 'resume' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
			onclick={() => activeTab = 'resume'}
		>Resume</button>
	</div>

	<!-- Action bar -->
	<div class="flex flex-wrap items-center gap-3 mb-6">
		{#if activeTab === 'cv'}
			<a href="/cv/jess_sullivan_cv.pdf" download class="btn preset-filled-primary-500 text-sm">Download CV PDF</a>
			<a
				href="https://github.com/Jesssullivan/jesssullivan.github.io/blob/main/cv/jess_sullivan_cv.tex"
				target="_blank"
				rel="noopener"
				class="btn preset-outlined-surface-500 text-sm"
			>View TeX Source</a>
		{:else}
			<a href="/cv/jess_sullivan_resume.pdf" download class="btn preset-filled-primary-500 text-sm">Download Resume PDF</a>
			<a
				href="https://github.com/Jesssullivan/jesssullivan.github.io/blob/main/cv/jess_sullivan_resume.tex"
				target="_blank"
				rel="noopener"
				class="btn preset-outlined-surface-500 text-sm"
			>View TeX Source</a>
		{/if}
	</div>

	<!-- PDF viewer -->
	<div class="card mb-8">
		{#if activeTab === 'cv'}
			<iframe
				src="/cv/jess_sullivan_cv.pdf"
				class="w-full h-[85vh] rounded-lg"
				title="Jess Sullivan CV"
			></iframe>
		{:else}
			<iframe
				src="/cv/jess_sullivan_resume.pdf"
				class="w-full h-[85vh] rounded-lg"
				title="Jess Sullivan Resume"
			></iframe>
		{/if}
	</div>

	<!-- Build info -->
	<p class="text-xs text-surface-400 text-center">
		Built with XeLaTeX via <a href="https://tectonic-typesetting.github.io/" target="_blank" rel="noopener" class="hover:text-primary-500 underline">Tectonic</a>.
		PDFs are <a href="https://github.com/Jesssullivan/jesssullivan.github.io/blob/main/.github/workflows/build-cv.yml" target="_blank" rel="noopener" class="hover:text-primary-500 underline">auto-compiled in CI</a> from TeX source on every push.
	</p>
</div>
