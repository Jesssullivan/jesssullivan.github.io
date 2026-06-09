---
title: "Glue You Can See in UV"
date: "2026-06-08"
description: "A 3D-printer bed adhesive that's stronger than Frank's Instagoo, loaded with strontium-aluminate phosphor so a 365nm flash shows exactly where you laid it down- plus a Klipper gate that won't print on a bare bed."
tags: ["3d-printing", "bed-adhesion", "klipper", "chemistry", "diy"]
published: true
category: "hardware"
slug: "glue-you-can-see-in-uv"
author_slug: "jesssullivan"
feature_image: "/images/posts/uv-glue-development.jpg"
---

<script>
	import GlueScaler from '$lib/components/GlueScaler.svelte';
	import GlueScalerPinch from '$lib/components/GlueScalerPinch.svelte';
</script>


## 3D-printer bed glue you / your printer can *see*.


See the full docs and mix calculators and also a more basic recipe here, in the Docs and repo:

### **→ [transscendsurvival.org/tinyland-goo](https://transscendsurvival.org/tinyland-goo/)** · source: [github.com/Jesssullivan/tinyland-goo](https://github.com/Jesssullivan/tinyland-goo)



It's UV-reactive, strontium-aluminate-infused, and it's stronger than [Frank's "Instagoo"](https://goo.by.frank.af/)- loaded with phosphor so a 365nm flash shows exactly where you laid it down. Then I wired the same trick into a little coverage sensor and a Klipper pre-print gate that refuses to print on a bare bed.  Future work will include a auto re-applicator head for the SnapMaker U1 and perhaps a [Klicky-probe](https://github.com/jlas1/Klicky-Probe) style dock for the sv06. 

The whole thing- recipe, an interactive by-weight batch scaler, the full bill of materials, the Klipper macros, and every citation- lives in its own little public spoke:



### The recipe (4 oz)

By weight, for a 0.01 g scale. The [live page](https://jesssullivan.github.io/tinyland-goo/) has a scaler that does this for any batch size, but here's the headline:

| Ingredient | 4 oz (g) | Role |
| --- | ---: | --- |
| PVP-K90 | 8.00 | Film former — K90 (MW ~1.3M) beats Frank's K30 |
| PVA, 88% hydrolyzed | 2.40 | Toughness; pins a minimum water fraction |
| PEG-400 | 2.00 | Tackifier (highest-leverage bond knob) |
| 1% boric-acid stock | 1.70 | Trace PVA crosslink (~0.7% of PVA) |
| Coated SrAl₂O₄:Eu,Dy, 35–50 µm | 4.00 | UV coverage indicator (**waterproof grade required**) |
| Ethanol (≥95%) | 53.00 | Co-solvent; flashes off |
| Distilled water | 41.72 | Dissolves PVA; carrier ≈ 55:45 EtOH:water |

**Stronger than Frank's** via three levers: PVP-**K90** (cohesion), **PEG-400** (tack), and a **trace boric-acid** crosslink (cohesion without killing release). Solids ≈ 14.6%, PVP:PVA ≈ 77:23.

Scale any batch by weight right here:

<GlueScaler />

Note, bare strontium aluminate *hydrolyzes in water and stops glowing.* You need a silica/fluoride-**coated/encapsulated** ("waterproof") grade. And don't go anhydrous- the PVA needs water. There's also an "in a pinch" PVP-40 derivation on the page for less mission-critical printers, built from common stock only (no K90, no boric acid, no coated phosphor).

<GlueScalerPinch />

## Seeing coverage

`SrAl₂O₄:Eu,Dy` excites at ~365nm and emits green ~520nm. Flood the bed with 365nm UV; glued area glows green, bare bed stays dark. The **AS7341** F4 (515nm) / F5 (555nm) channels straddle the peak and its filters reject 365nm, so a single-point read often needs no separate filter- baseline the bare bed once, and coverage is the green rise above it. Feed that into a Klipper `PRINT_START` gate and the printer simply won't start on a bare bed.


-Jess
