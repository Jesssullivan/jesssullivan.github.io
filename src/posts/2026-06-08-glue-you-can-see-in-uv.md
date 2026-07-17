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
editorial_tier: "noteworthy"
---

<script>
	import GlueScaler from '$lib/components/GlueScaler.svelte';
	import GlueScalerPinch from '$lib/components/GlueScalerPinch.svelte';
</script>


## 3D-printer bed glue your printer can *see*.


### docs: [transscendsurvival.org/tinyland-goo](https://transscendsurvival.org/tinyland-goo/)
#### source: [github.com/Jesssullivan/tinyland-goo](https://github.com/Jesssullivan/tinyland-goo)


I loaded this experimental strontium-aluminate-infused glue with phosphor so a 365nm flash shows exactly where you laid it down, then wired up a little coverage sensor and a Klipper pre-print gate that refuses to print on a bare bed.  Future work will ideally include a auto re-applicator head for the SnapMaker U1 and perhaps a [Klicky-probe](https://github.com/jlas1/Klicky-Probe) style dock for the sv06 if I get around to it. 

Scale any batch by weight right here:

<GlueScaler />

Note, bare strontium aluminate *hydrolyzes in water and stops glowing.* You need a silica/fluoride-**coated/encapsulated** ("waterproof") grade. And don't go anhydrous- the PVA needs water. There's also an "in a pinch" PVP-40 derivation on the page for less mission-critical printers, built from common stock only (no K90, no boric acid, no coated phosphor).  But this is less cool, and doesn't give the same PEO street cred:

<GlueScalerPinch />

## Seeing coverage

`SrAl₂O₄:Eu,Dy` excites at ~365nm and emits green ~520nm. Flood the bed with 365nm UV; glued area glows green, bare bed stays dark. The **AS7341** F4 (515nm) / F5 (555nm) channels straddle the peak and its filters reject 365nm, so a single-point read often needs no separate filter- baseline the bare bed once, and coverage is the green rise above it. Feed that into a Klipper `PRINT_START` gate and the printer simply won't start on a bare bed.

I'll maybe add a video or two later, though most of my weekend printer larks do not make it past the first few weekends of entertainment, lol.

-Jess
