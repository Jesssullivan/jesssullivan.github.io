<script lang="ts">
	// Gingersnap-specific wrapper around the generic RecipeScaler.
	// The ingredient data lives here (a real .svelte file) rather than in the
	// mdsvex post, because the post pipeline's rehype brace-escaper rewrites
	// `{`/`}` in the markdown source — which would corrupt object literals in a
	// post <script>. Keeping data here lets the post stay brace-free.
	import RecipeScaler from './RecipeScaler.svelte';

	const ingredients = [
		{ qty: 0.75, unit: 'cup', item: 'milk-free, soy-free margarine', grams: 170 },
		{ qty: 1, unit: 'cup', item: 'brown sugar, packed', grams: 213 },
		{ qty: 0.25, unit: 'cup', item: 'molasses', grams: 85 },
		{ qty: 2, unit: 'Tbsp', item: 'orange juice', grams: 31 },
		{ qty: 2.25, unit: 'cups', item: 'all-purpose flour', grams: 270 },
		{ qty: 2, unit: 'tsp', item: 'baking soda', grams: 12 },
		{ qty: 0.5, unit: 'tsp', item: 'salt', grams: 3 },
		{ qty: 1, unit: 'tsp', item: 'ground ginger', grams: 2 },
		{ qty: 1, unit: 'tsp', item: 'ground cinnamon', grams: 3 },
		{ qty: 1, unit: 'tsp', item: 'ground cloves', grams: 2 },
		{ qty: 0.25, unit: 'cup', item: 'granulated sugar (for rolling)', grams: 50 }
	];
</script>

<RecipeScaler {ingredients} title="Gingersnap batch scaler" />
