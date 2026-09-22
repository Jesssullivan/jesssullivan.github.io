<script lang="ts">
	interface TocItem {
		id: string;
		text: string;
		level: number;
	}

	let { documentRoot, refreshKey = 0 }: { documentRoot: HTMLElement | null; refreshKey?: number } = $props();
	let items = $state<TocItem[]>([]);
	let activeId = $state('');

	function jumpToHeading(id: string) {
		const heading = Array.from(documentRoot?.querySelectorAll<HTMLElement>('h2, h3, h4') ?? []).find(
			(candidate) => candidate.id === id,
		);
		if (!heading) return;

		activeId = id;
		heading.setAttribute('tabindex', '-1');
		heading.focus({ preventScroll: true });
		window.setTimeout(() => {
			if (window.location.hash === `#${encodeURIComponent(id)}`) activeId = id;
		});
	}

	$effect(() => {
		const root = documentRoot;
		void refreshKey;
		if (!root) {
			items = [];
			activeId = '';
			return;
		}

		let intersectionObserver: IntersectionObserver | undefined;
		let pending = false;
		let disposed = false;
		const setActiveFromHash = () => {
			let fragment = '';
			try {
				fragment = decodeURIComponent(window.location.hash.slice(1));
			} catch {
				// A malformed but legal URL fragment must not stop TOC refresh.
			}
			const heading = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, h4')).find(
				(candidate) => candidate.id === fragment,
			);
			if (heading) activeId = heading.id;
		};
		const refresh = () => {
			if (disposed || !root.isConnected) return;
			pending = false;
			intersectionObserver?.disconnect();
			const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, h4')).filter((heading) =>
				Boolean(heading.id),
			);
			items = headings.map((heading) => ({
				id: heading.id,
				text: heading.textContent?.replace(/^#\s*/, '') || '',
				level: parseInt(heading.tagName[1]),
			}));
			setActiveFromHash();

			if (headings.length < 3) return;
			intersectionObserver = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!disposed && entry.isIntersecting) activeId = entry.target.id;
					}
				},
				{ rootMargin: '-80px 0px -70% 0px' },
			);
			headings.forEach((heading) => intersectionObserver?.observe(heading));
		};
		const scheduleRefresh = () => {
			if (disposed || pending) return;
			pending = true;
			queueMicrotask(() => {
				if (!disposed) refresh();
			});
		};

		refresh();
		window.addEventListener('hashchange', setActiveFromHash);
		const mutationObserver = new MutationObserver(scheduleRefresh);
		mutationObserver.observe(root, { childList: true, subtree: true });
		return () => {
			disposed = true;
			window.removeEventListener('hashchange', setActiveFromHash);
			mutationObserver.disconnect();
			intersectionObserver?.disconnect();
		};
	});
</script>

{#if items.length >= 3}
	<nav class="hidden lg:block max-h-[60dvh] overflow-y-auto text-sm" aria-label="Table of contents">
		<p class="font-semibold text-surface-400 uppercase text-xs mb-3 tracking-wide">On this page</p>
		<ul class="space-y-1 border-l border-surface-300-700">
			{#each items as item (item.id)}
				<li style="padding-left: {(item.level - 2) * 0.75}rem">
					<a
						href="#{item.id}"
						class="block py-0.5 pl-3 -ml-px border-l-2 transition-colors {activeId === item.id
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:text-surface-300'}"
						aria-label={`Jump to section ${item.text}`}
						aria-current={activeId === item.id ? 'location' : undefined}
						onclick={() => jumpToHeading(item.id)}
					>
						{item.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
