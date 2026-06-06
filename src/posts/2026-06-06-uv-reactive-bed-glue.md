---
title: "Bed glue you can see in UV (and a Klipper gate that won't print without it)"
date: "2026-06-06"
description: "A 3D-printer bed adhesive stronger on paper than Frank's Instagoo, infused with strontium-aluminate phosphor so a 365 nm flash shows coverage — with a by-weight batch scaler, an off-the-shelf UV sensing BOM, and a Klipper pre-print gate."
tags: ["3d-printing", "klipper", "chemistry", "adhesives", "strontium-aluminate", "uv", "phosphor", "diy", "maker", "recipe"]
category: "tutorial"
published: false
slug: "uv-reactive-bed-glue"
excerpt: "Stronger-on-paper PVP/PVA bed glue dosed with strontium-aluminate phosphor, a by-weight batch scaler, a Mouser UV-sensing BOM, and a Klipper macro that aborts on a bare bed."
---

<script>
	import GlueScaler from '$lib/components/GlueScaler.svelte';
	import GlueScalerPinch from '$lib/components/GlueScalerPinch.svelte';
</script>

[Frank's "Instagoo"](https://goo.by.frank.af/) is a tidy 3D-printer bed glue: 21 g PVP-K30 + 9 g PVA in 200 ml of ~50% isopropyl alcohol — a 70:30 PVP:PVA solution at roughly 15% solids. It's the same chemistry family as the [DIY "Super Goop"](https://hackaday.com/2022/12/06/homebrew-3d-printer-goop-promises-better-bed-adhesion/) lineage and the commercial brush-ons: [Vision Miner Nano](https://visionminer.com/products/nano-polymer-adhesive)'s SDS discloses only an IPA carrier and a trade-secret polymer, and [Luke's Laboratory](https://www.lukeslabonline.com/products/bed-adhesive) sells Standard/Double/Triple "strength," which is just the same liquid at different solids. None of them publishes a real bond number.

I wanted two things on top: glue that is **stronger**, and glue I can **see** 👀. The seeing part is the fun bit — dose it with strontium-aluminate phosphor and a coat lights up green under UV, so a sensor (and a Klipper macro) can check the bed is actually covered before a print starts.

Fair warning up front: the "stronger" claim here is mechanistic, not yet measured. I haven't put a force gauge on a peel test — that's the next post. What follows is three changes each backed by a named source, which is the most I'll assert until I have numbers.

The full build — BOM, wiring, the Klipper config and host script — lives at **[transscendsurvival.org/tinyland-goo](https://transscendsurvival.org/tinyland-goo/)**. This post is the short version.

## The recipe

Everything by weight, for a 0.01 g scale. 1× (~2 oz) is the smallest worthwhile batch; **2× (~4 oz) is the recommended minimum**, so that's the default below.

<GlueScaler />

## Three honest knobs

Each of these is a documented lever, not a hunch:

| Knob | Change | Why it should help | The number to watch |
| --- | --- | --- | --- |
| Film former | PVP-K30 → [PVP-K90](https://ulipolymer.com/difference-between-pvp-k30-and-pvp-k90/) | ~30× the molecular weight (~1.3M vs ~40k) → more viscosity, film cohesion, tack | it's a drop-in swap |
| Tackifier | add PEG-400 | pressure-sensitive tack in [PVP/PEG blends peaks near 36 wt% PEG](https://www.tandfonline.com/doi/abs/10.1080/00218460213491) | start at ~20% so the film still releases |
| Crosslink | trace boric acid | [boric acid bonds PVA](https://iopscience.iop.org/article/10.1088/2631-8695/ad4cb4) for cohesion while staying water-redispersible | keep it ≤1% of the PVA — past that it stops releasing |

That last row is the one number worth getting right: enough crosslink to stiffen the film, not enough to weld your print to the bed.

## The catch: strontium aluminate hates water

`SrAl₂O₄:Eu,Dy` excites across UV-A (peak ~365 nm) and [emits green at ~520 nm](https://en.wikipedia.org/wiki/Strontium_aluminate) — that's the whole trick. But bare phosphor [hydrolyzes in water](https://www.sciencedirect.com/science/article/abs/pii/S0254058407003719) to non-luminescent hydroxides and quietly stops glowing. You can't dodge it by going anhydrous, because the PVA needs water to dissolve. The fix is a silica/fluoride-coated ("waterproof") grade plus a modest water fraction. Coated powder is mandatory here, not a nicety.

It's non-toxic with no GHS hazard class, but it's a hard mineral dust — mask and gloves when weighing.

## In a pinch

The recipe above wants PVP-K90, an encapsulated phosphor, and a boric-acid crosslink — specialized stock that's still in the mail. So here's a derivation from what's already on the shelf: PVP-40, PVA lab powder, 91% IPA, distilled water, a heavy PEG/PEO powder, and plain strontium aluminate. It's for an automated applicator on **less mission-critical** printers, in 1/2/4 oz mini batches.

It still beats Frank's — same PVP/PVA backbone, a hair more solids, and the PEG/PEO tackifier doing the heavy lifting instead of K90 + crosslink. Two honest trade-offs: the uncoated phosphor hydrolyzes over time (mix small, use fresh), and heavy PEO is stringy (keep it low or the applicator cobwebs). Both glues read the same under UV.

<GlueScalerPinch />

## Seeing coverage

Flood the bed with 365 nm UV and read the green that comes back. An [AMS AS7341 spectral sensor](https://www.adafruit.com/product/4698) has channels at 515 nm and 555 nm straddling the phosphor peak, and its on-chip interference filters reject the 365 nm excitation — so a single-point read often needs no separate glass filter. Baseline the bare bed once; coverage is the green rise above it. The whole sensing BOM (OSRAM 365 nm LED, MEAN WELL driver, the sensor, a Pi) is on the [project page](https://transscendsurvival.org/tinyland-goo/).

## The Klipper gate

`PRINT_START` runs a host script (via the `gcode_shell_command` extension) that reads the sensor and writes the result back through Moonraker's `SAVE_VARIABLE`. A second macro reads that value and aborts — before any heating or motion — if coverage is too low:

```toml
[gcode_macro _COVERAGE_GATE]
gcode:
    {% set min_cov = params.MIN_COVERAGE|default(70)|float %}
    {% set cov = printer.save_variables.variables.coverage_pct|default(-1)|float %}
    {% if cov < min_cov %}
        { action_raise_error("COVERAGE GATE: %.1f%% < %.1f%%. Re-glue and restart." % (cov, min_cov)) }
    {% endif %}
```

Two-point calibration (bare bed → 0%, fully glued → 100%) is required. The complete `coverage_gate.cfg` and `coverage_gate.py` are in the [tinyland-goo repo](https://github.com/Jesssullivan/tinyland-goo).

## Safety, briefly

Flammable alcohol carrier (mix away from flame; let it flash off before the bed heats) · phosphor dust (N95/P2 + eye protection when weighing) · boric acid (reproductive hazard if ingested — gloves, away from food) · 365 nm UV-A (eye/skin hazard at power; enclose it and pulse only during the read).

Next time, hopefully, with a force gauge and actual peel numbers. Until then it glows, which is most of the fun anyway.

Cheers, -Jess
