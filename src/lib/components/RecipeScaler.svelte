<script lang="ts">
	// RecipeScaler.svelte — interactive batch scaler for a recipe ingredient list.
	// Svelte 5 runes; prerender-safe (no top-level window/document access).

	type Ingredient = {
		qty: number; // base quantity in US/imperial unit
		unit?: string; // e.g. "cup", "tsp", "" for count items
		item: string; // e.g. "all-purpose flour"
		grams?: number; // optional metric mass for this base qty (enables US <-> metric)
	};

	let {
		ingredients = [],
		title = 'Ingredients',
		scales = [0.5, 1, 2, 3]
	}: {
		ingredients?: Ingredient[];
		title?: string;
		scales?: number[];
	} = $props();

	let scale = $state(1);
	let metric = $state(false);

	// --- fraction-aware US quantity formatting -------------------------------
	const GLYPHS: Record<string, string> = {
		'1/4': '¼',
		'1/2': '½',
		'3/4': '¾',
		'1/3': '⅓',
		'2/3': '⅔',
		'1/8': '⅛',
		'3/8': '⅜',
		'5/8': '⅝',
		'7/8': '⅞'
	};

	function gcd(a: number, b: number): number {
		return b === 0 ? a : gcd(b, a % b);
	}

	// Snap to nearest 1/8 so things like 0.333 * 2 read cleanly.
	function formatUs(value: number): string {
		if (!isFinite(value)) return '0';
		const eighths = Math.round(value * 8);
		if (eighths === 0) return '0';
		const whole = Math.floor(eighths / 8);
		const rem = eighths % 8;
		if (rem === 0) return String(whole);
		const g = gcd(rem, 8);
		const fracKey = `${rem / g}/${8 / g}`;
		const glyph = GLYPHS[fracKey] ?? fracKey;
		return whole > 0 ? `${whole}${glyph}` : glyph;
	}

	function formatMetric(grams: number): string {
		const g = Math.round(grams);
		return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2)} kg` : `${g} g`;
	}

	function scaleLabel(s: number): string {
		if (s === 0.5) return '×½';
		return `×${s}`;
	}

	const rows = $derived(
		ingredients.map((ing) => {
			if (metric && typeof ing.grams === 'number') {
				return { item: ing.item, amount: formatMetric(ing.grams * scale), unit: '' };
			}
			return { item: ing.item, amount: formatUs(ing.qty * scale), unit: ing.unit ?? '' };
		})
	);

	const hasMetric = $derived(ingredients.some((i) => typeof i.grams === 'number'));
</script>

<div class="recipe-scaler card p-4 preset-outlined-surface-500 not-prose my-6">
	<div class="flex flex-wrap items-center justify-between gap-3 mb-3">
		<h3 class="text-lg font-semibold m-0">{title}</h3>
		<div class="flex items-center gap-2">
			<div class="flex gap-1" role="group" aria-label="Scale the batch quantity">
				{#each scales as s (s)}
					<button
						type="button"
						class="badge {scale === s ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
						aria-pressed={scale === s}
						aria-label={`Scale recipe ${scaleLabel(s)}`}
						onclick={() => (scale = s)}
					>
						{scaleLabel(s)}
					</button>
				{/each}
			</div>
			{#if hasMetric}
				<button
					type="button"
					class="badge preset-outlined-surface-500"
					aria-pressed={metric}
					aria-label="Toggle between US and metric units"
					onclick={() => (metric = !metric)}
				>
					{metric ? 'metric' : 'US'}
				</button>
			{/if}
		</div>
	</div>

	<table class="w-full text-sm">
		<caption class="sr-only">
			{title}, scaled {scaleLabel(scale)}, shown in {metric ? 'metric' : 'US'} units
		</caption>
		<thead>
			<tr class="text-surface-600-400 text-left">
				<th scope="col" class="py-1 pr-3 font-medium">Amount</th>
				<th scope="col" class="py-1 font-medium">Ingredient</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.item)}
				<tr class="border-t border-surface-300-700">
					<td class="py-1 pr-3 font-mono whitespace-nowrap">
						{row.amount}{row.unit ? ` ${row.unit}` : ''}
					</td>
					<td class="py-1">{row.item}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<p class="sr-only" aria-live="polite">
		Showing {scaleLabel(scale)} batch in {metric ? 'metric' : 'US'} units.
	</p>
</div>
