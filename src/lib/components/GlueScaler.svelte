<script lang="ts">
	// GlueScaler.svelte — main UV-reactive bed glue (the "specialized" recipe).
	// Data only; the engine lives in WeightScaler.svelte. 1× ≈ 2 oz (smallest
	// worthwhile batch); default 2× ≈ 4 oz (recommended minimum).
	import WeightScaler from './WeightScaler.svelte';

	const ingredients = [
		{ item: 'PVP-K90 powder', grams: 4.0, role: 'Primary film former — K90 (MW ~1.3M) is the strength upgrade over Frank’s K30' },
		{ item: 'PVA, 88% hydrolyzed (cold-water grade)', grams: 1.2, role: 'Secondary film former / toughness — pins a minimum water fraction' },
		{ item: 'PEG-400', grams: 1.0, role: 'Tackifier / plasticizer — the highest-leverage bond-strength additive' },
		{ item: '1% boric-acid stock solution', grams: 0.85, role: 'Delivers a trace PVA crosslink (~0.7% of PVA) — dosed via stock so it’s weighable' },
		{ item: 'Coated SrAl₂O₄:Eu,Dy phosphor, 35–50 µm', grams: 2.0, role: 'UV-reactive coverage indicator — MUST be waterproof/encapsulated grade' },
		{ item: 'Ethanol (≥95%, denatured ok)', grams: 26.5, role: 'Co-solvent for PVP/PEG; flashes off on the heated bed' },
		{ item: 'Distilled water (free water)', grams: 20.86, role: 'Dissolves the PVA; carrier lands at ~55:45 ethanol:water' }
	];

	const presets = [
		{ factor: 1, label: '×1 · ~2 oz' },
		{ factor: 2, label: '×2 · ~4 oz', recommended: true },
		{ factor: 4, label: '×4 · ~8 oz' }
	];

	const footnote =
		'Solids are ~14.6% by weight (PVP:PVA ≈ 77:23). 1× is the smallest worthwhile batch; 2× (~4 oz) is the recommended minimum. A 0.01 g scale is assumed — the boric acid is dosed as a 1% stock because the neat mass (≈8 mg) is below that resolution.';
</script>

<WeightScaler title="Glue batch scaler (by weight)" {ingredients} {presets} defaultFactor={2} {footnote} />
