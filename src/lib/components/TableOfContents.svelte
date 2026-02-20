<script lang="ts">
	import { onMount } from 'svelte';

	interface TocItem {
		id: string;
		text: string;
		level: number;
	}

	let items = $state<TocItem[]>([]);
	let activeId = $state('');

	onMount(() => {
		const headings = document.querySelectorAll('.prose h2, .prose h3, .prose h4');
		const collected: TocItem[] = [];

		headings.forEach((el) => {
			if (el.id) {
				collected.push({
					id: el.id,
					text: el.textContent?.replace(/^#\s*/, '') || '',
					level: parseInt(el.tagName[1])
				});
			}
		});

		items = collected;

		if (collected.length < 3) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
					}
				}
			},
			{ rootMargin: '-80px 0px -70% 0px' }
		);

		headings.forEach((el) => {
			if (el.id) observer.observe(el);
		});

		return () => observer.disconnect();
	});
</script>

{#if items.length >= 3}
	<nav class="hidden lg:block max-h-[60vh] overflow-y-auto text-sm">
		<p class="font-semibold text-surface-400 uppercase text-xs mb-3 tracking-wide">On this page</p>
		<ul class="space-y-1 border-l border-surface-300-700">
			{#each items as item}
				<li style="padding-left: {(item.level - 2) * 0.75}rem">
					<a
						href="#{item.id}"
						class="block py-0.5 pl-3 -ml-px border-l-2 transition-colors {activeId === item.id
							? 'border-primary-500 text-primary-500'
							: 'border-transparent text-surface-500 hover:text-surface-300'}"
					>
						{item.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
