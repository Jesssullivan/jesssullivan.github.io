<script lang="ts">
	// GlueScalerPinch.svelte — "in a pinch" simplified derivation from on-hand
	// chemicals (PVP-40, PVA powder, 91% IPA, distilled water, heavy PEG/PEO,
	// plain strontium aluminate). 1 oz base; presets are absolute mini sizes.
	// Still stronger than Frank's via the PEG/PEO tack lever + slightly higher
	// adhesive solids — no K90, no boric acid, no coated phosphor required.
	import WeightScaler from './WeightScaler.svelte';

	// 1× = 1 oz ≈ 28.35 g finished glue.
	const ingredients = [
		{ item: 'PVP-40 powder (K-30 class, MW ~40k)', grams: 2.8, role: 'Film former — same PVP grade as Frank’s; the backbone' },
		{ item: 'PVA lab powder', grams: 1.1, role: 'Toughness (PVP:PVA ≈ 72:28, echoes Frank’s 70:30)' },
		{ item: 'PEG/PEO powder (heavy MW)', grams: 0.5, role: 'Tackifier — the strength edge over Frank’s; potent & stringy, start low' },
		{ item: 'Strontium aluminate (plain, uncoated)', grams: 1.0, role: 'UV coverage indicator — uncoated, so mix small & use fresh' },
		{ item: '91% isopropyl alcohol', grams: 16.0, role: 'Carrier; flashes off. Kept IPA-heavy to slow phosphor hydrolysis' },
		{ item: 'Distilled water', grams: 6.95, role: 'Just enough to dissolve the PVA (carrier ≈ 63:37 IPA:water)' }
	];

	const presets = [
		{ factor: 1, label: '1 oz' },
		{ factor: 2, label: '2 oz' },
		{ factor: 4, label: '4 oz' }
	];

	const footnote =
		'Adhesive solids ~15.5% (PVP+PVA+PEO), a touch above Frank’s — the PEG/PEO is the tack lever. Uncoated phosphor hydrolyzes in water over time, so mix mini batches and use fresh; shake before each use. Heavy PEO strings — if your applicator clogs or cobwebs, cut the PEO. A 0.01 g scale is assumed.';
</script>

<WeightScaler
	title="In-a-pinch batch scaler (on-hand chemicals)"
	{ingredients}
	{presets}
	defaultFactor={1}
	{footnote}
/>
