<script lang="ts">
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import { theme, THEMES } from '$lib/theme.svelte';

	let isOpen = $state(false);

	function handleOpenChange(details: { open: boolean }) {
		isOpen = details.open;
	}
</script>

<Popover
	open={isOpen}
	onOpenChange={handleOpenChange}
	positioning={{ placement: 'bottom-end', gutter: 8 }}
	closeOnInteractOutside
	closeOnEscape
>
	<Popover.Trigger class="p-1.5 hover:bg-surface-200-800 rounded transition-colors" aria-label="Theme settings">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 21a4 4 0 01-4-4c0-1.305.835-2.416 2-2.828V11a7 7 0 1114 0v3.172A3.001 3.001 0 0121 17a4 4 0 01-4 4H7z"
			/>
		</svg>
	</Popover.Trigger>
	<Portal>
		<Popover.Positioner class="z-50">
			<Popover.Content
				class="bg-surface-50 dark:bg-surface-900 border border-surface-300-700 rounded-lg shadow-lg py-2 min-w-[200px]"
			>
				<p class="px-3 py-1 text-xs text-surface-400 uppercase tracking-wide font-semibold">Mode</p>
				{#each ['light', 'dark', 'system'] as const as mode (mode)}
					<button
						onclick={() => {
							theme.setMode(mode);
							isOpen = false;
						}}
						aria-label={`Set color mode to ${mode}`}
						class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors capitalize flex items-center justify-between {theme.mode ===
						mode
							? 'text-primary-500 font-semibold'
							: ''}"
					>
						{mode}
						{#if theme.mode === mode}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
								><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg
							>
						{/if}
					</button>
				{/each}
				<div class="border-t border-surface-300-700 my-1.5"></div>
				<p class="px-3 py-1 text-xs text-surface-400 uppercase tracking-wide font-semibold">Theme</p>
				{#each THEMES as t (t.id)}
					<button
						onclick={() => {
							theme.setTheme(t.id);
							isOpen = false;
						}}
						aria-label={`Set color theme to ${t.label}`}
						class="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-200-800 transition-colors flex items-center gap-2 {theme.currentTheme ===
						t.id
							? 'text-primary-500 font-semibold'
							: ''}"
					>
						<span class="flex gap-0.5">
							{#each t.colors as color, index (`${t.id}-${index}`)}
								<span class="w-2.5 h-2.5 rounded-full border border-surface-300-700" style="background: {color}"></span>
							{/each}
						</span>
						{t.label}
						{#if theme.currentTheme === t.id}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 ml-auto"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
								><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg
							>
						{/if}
					</button>
				{/each}
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>
