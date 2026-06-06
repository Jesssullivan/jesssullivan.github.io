<script lang="ts">
	// WeightScaler.svelte — generic by-weight batch scaler engine.
	//
	// Recipe data lives in thin wrapper components (GlueScaler, GlueScalerPinch)
	// so the wrappers can be dropped into the mdsvex blog without tripping its
	// brace-escaper. Everything is grams for a 0.01 g scale, with a g <-> oz
	// toggle. `factor` multiplies the base-batch grams.

	type Ingredient = { item: string; grams: number; role: string };
	type Preset = { factor: number; label: string; recommended?: boolean };

	let {
		title = 'Batch scaler (by weight)',
		ingredients = [],
		presets = [{ factor: 1, label: '×1' }],
		defaultFactor = presets[0]?.factor ?? 1,
		totalLabel = 'Finished glue',
		footnote = ''
	}: {
		title?: string;
		ingredients?: Ingredient[];
		presets?: Preset[];
		defaultFactor?: number;
		totalLabel?: string;
		footnote?: string;
	} = $props();

	const G_PER_OZ = 28.349523125;

	// null = "follow the recipe's default"; a click pins an explicit factor.
	let factorOverride = $state<number | null>(null);
	const factor = $derived(factorOverride ?? defaultFactor);
	let unit = $state<'g' | 'oz'>('g');

	const rows = $derived(
		ingredients.map((ing) => {
			const grams = ing.grams * factor;
			const amount = unit === 'oz' ? (grams / G_PER_OZ).toFixed(3) : grams.toFixed(2);
			return { item: ing.item, role: ing.role, amount };
		})
	);

	const totalGrams = $derived(ingredients.reduce((s, i) => s + i.grams, 0) * factor);
	const totalOz = $derived(totalGrams / G_PER_OZ);
</script>

<div class="card p-4 preset-outlined-surface-500 not-prose my-6">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
		<h3 class="m-0 text-lg font-semibold">{title}</h3>
		<div class="flex items-center gap-2">
			<div class="flex gap-1" role="group" aria-label="Scale the batch size">
				{#each presets as p (p.factor)}
					<button
						type="button"
						class="badge {factor === p.factor
							? 'preset-filled-primary-500'
							: 'preset-outlined-surface-500'}"
						aria-pressed={factor === p.factor}
						aria-label={`Batch ${p.label}${p.recommended ? ', recommended minimum' : ''}`}
						onclick={() => (factorOverride = p.factor)}
					>
						{p.label}{p.recommended ? ' ✓' : ''}
					</button>
				{/each}
			</div>
			<button
				type="button"
				class="badge preset-outlined-surface-500"
				aria-pressed={unit === 'oz'}
				aria-label="Toggle grams or ounces"
				onclick={() => (unit = unit === 'g' ? 'oz' : 'g')}
			>
				{unit === 'g' ? 'grams' : 'ounces'}
			</button>
		</div>
	</div>

	<table class="w-full text-sm">
		<caption class="sr-only">
			{title}, ~{totalOz.toFixed(1)} oz, shown in {unit === 'g' ? 'grams' : 'ounces'}
		</caption>
		<thead>
			<tr class="text-left text-surface-600 dark:text-surface-400">
				<th scope="col" class="py-1 pr-3 font-medium">Weight</th>
				<th scope="col" class="py-1 font-medium">Ingredient</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.item)}
				<tr class="border-t border-surface-300 dark:border-surface-700">
					<td class="whitespace-nowrap py-1 pr-3 font-mono">{row.amount} {unit}</td>
					<td class="py-1">
						<span class="font-medium">{row.item}</span>
						<span class="block text-xs text-surface-500">{row.role}</span>
					</td>
				</tr>
			{/each}
			<tr class="border-t-2 border-surface-400 dark:border-surface-600 font-semibold">
				<td class="whitespace-nowrap py-1 pr-3 font-mono">
					{unit === 'oz' ? totalOz.toFixed(3) : totalGrams.toFixed(2)}
					{unit}
				</td>
				<td class="py-1">{totalLabel} (~{totalOz.toFixed(1)} oz)</td>
			</tr>
		</tbody>
	</table>

	{#if footnote}
		<p class="mt-3 text-xs text-surface-500">{footnote}</p>
	{/if}
	<p class="sr-only" aria-live="polite">Showing ~{totalOz.toFixed(1)} oz in {unit === 'g' ? 'grams' : 'ounces'}.</p>
</div>
