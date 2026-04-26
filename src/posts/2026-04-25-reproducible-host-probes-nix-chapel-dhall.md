---
title: "Characterizing a Dual-Socket BCI Server Before Claiming RT Wins"
date: "2026-04-25"
description: "A draft result note for a Dell T7810 BCI server: first generic/RT packet captured, two generic repeat packets captured, no RT improvement claim yet."
tags: ["Chapel", "Nix", "Dhall", "NUMA", "hardware", "reproducibility", "RT"]
published: false
slug: "reproducible-host-probes-nix-chapel-dhall"
category: "hardware"
source_repo: "Jesssullivan/Dell-7810"
source_path: "docs/platform/honey-generic-host-characterization-window-2026-04-26.md"
---

I've been tuning a Dell Precision T7810 as a BCI server for real-time XR work-- two Xeon E5-2630 v3 processors, 32 threads, two NUMA nodes, the kind of dual-socket Haswell-era machine that rewards you for thinking about memory topology and punishes you for ignoring it.

The goal is to characterize this host's parallel and scheduling behavior across kernel configurations-- generic lane versus PREEMPT_RT-- so I can make honest claims about what RT actually buys us on this hardware before building the XR compositor on top of it.

![It needs Chapel Lang](/images/posts/chapel-lang-meme.webp)

## The machine

`honey` is a Dell Precision T7810 running Rocky Linux with a heavily tuned kernel cmdline-- `tsc=nowatchdog`, `nohz_full`, `isolcpus`, `irqaffinity`, the works. Two kernel lanes are installed:

- **Generic**: `6.19.5-7.xr.el10`, `PREEMPT_DYNAMIC` -- the current baseline
- **RT**: `6.19.5-rt1-8.xr.el10`, `PREEMPT_RT` -- booted once for a bounded packet, then returned to generic

The question isn't whether RT is faster. The question is: what does this host's parallel behavior look like on each lane, measured the same way, with the same probe, captured in a format I can cite in a paper?

## The probe

I wrote a Chapel host-characterization probe that generates a synthetic workload, partitions it across the NUMA topology, and measures serial versus parallel reduction time. Here's the heart of it:

```c
// Serial: one core, one pass
var serialTotal: real = 0.0;
for ch in 0..<numChannels {
  for s in 0..<numSamples do
    serialTotal += abs(data[ch, s]);
}

// Parallel: forall distributes across cores
var channelTotals: [0..<numChannels] real;
forall ch in 0..<numChannels {
  var total: real = 0.0;
  for s in 0..<numSamples do
    total += abs(data[ch, s]);
  channelTotals[ch] = total;
}
```

Chapel's `forall` distributes the outer loop across cores, and because the channel partitions are aligned to NUMA nodes, memory accesses stay local to each socket. The probe, its timing support, and conformance predicates total about 290 lines across three files. I also built [quickchpl](https://github.com/nicholasTng/quickchpl)-- a property-based testing library for Chapel-- to verify the partitioning and timing invariants hold across partition sizes and channel counts.

## First paired packet (captured)

The first paired packet exists now. It is useful, but it is not an improvement story:

| Metric | Generic lane | RT lane |
| --- | ---: | ---: |
| Kernel | `6.19.5-7.xr.el10` | `6.19.5-rt1-8.xr.el10` |
| SMI samples | 73-74 / 30s | 65-74 / 30s |
| tracefs `hwlat` max | 0-2 us | 0-2 us |
| Serial reduction | 22.323 ms | 22.533 ms |
| Parallel reduction | 1.807 ms | 1.927 ms |
| Characterization ratio | 12.3536x | 11.6933x |
| Conforms | true | true |

RT was slightly slower in this single Chapel pair, and SMI activity remained nonzero on both lanes. The safe claim is narrower: the same host-characterization probe conforms on generic and RT, under the same short SMI/`hwlat` capture shape, and `honey` returned to the generic fallback afterward.

## Generic repeat series (captured twice)

Two five-sample generic repeat packets are now captured. All runs conform, but the ratio moves around enough that single-pair storytelling would be sloppy.

The first repeat packet:

| Metric | Min | Max | Mean | Sample stdev |
| --- | ---: | ---: | ---: | ---: |
| Serial seconds | 0.021871 | 0.025839 | 0.023723 | 0.001885 |
| Parallel seconds | 0.001667 | 0.002431 | 0.001956 | 0.000302 |
| Characterization ratio | 8.9967x | 14.0738x | 12.3491x | 1.9463x |

The second repeat packet adds longer SMI/hwlat context-- three 120-second SMI windows, three 120-second tracefs `hwlat` windows, and five more Chapel repeats:

| Metric | Min | Max | Mean | Sample stdev |
| --- | ---: | ---: | ---: | ---: |
| Serial seconds | 0.021841 | 0.027597 | 0.023822 | 0.002590 |
| Parallel seconds | 0.001768 | 0.002382 | 0.001962 | 0.000249 |
| Characterization ratio | 9.3375x | 14.1814x | 12.2760x | 1.8093x |

That same packet had SMI counts of 280, 279, and 279 events per 120 seconds, while tracefs `hwlat` stayed at 0 us max in all three windows. The captures also record load average, which matters. This is host characterization under lab conditions, not an idle benchmark distribution.

## The reproducibility pipeline

The probe is Chapel. The reproducibility is [Nix](https://nixos.org/) (hermetic compiler sourcing) and [Dhall](https://dhall-lang.org/) (typed evidence records). One command:

```bash
just platform-host-characterization-window target=jess@honey tag=generic-repeat-2026-04-26 expect_lane=generic smi_samples=3 smi_duration=120 hwlat_duration=120 chapel_samples=5
```

![Chapel probe pipeline](/images/posts/chapel-probe-pipeline.svg)

Every artifact-- compiler path, host context, probe output, Dhall record-- stays tied to a repo path.

## What's next

- Matching RT repeat series using the same store-prebuilt Chapel path
- Longer RT SMI/`hwlat` windows to match the generic 120-second packet
- Notes on lab load, reboot/recovery cost, and any BIOS or C-state changes
- Fresh `quickchpl` PBT run for the paper-bound timing invariant claims

The [Dell-7810](https://github.com/Jesssullivan/Dell-7810) repo has everything: Chapel probes, Dhall records, raw captures, publication roadmap, and the claim ladder that keeps me honest.

-Jess
