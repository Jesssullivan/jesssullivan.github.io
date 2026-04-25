---
title: "Characterizing a Dual-Socket BCI Server Before and After RT"
date: "2026-04-25"
description: "Building a reproducible host-characterization pipeline for a Dell T7810 BCI server-- generic lane baseline captured, RT lane next, with Chapel probes, PBT verification, and Nix+Dhall for reproducibility."
tags: ["Chapel", "Nix", "Dhall", "NUMA", "hardware", "reproducibility", "RT"]
published: false
slug: "reproducible-host-probes-nix-chapel-dhall"
category: "hardware"
source_repo: "Jesssullivan/Dell-7810"
source_path: "docs/platform/honey-chapel-live-result-2026-04-23.md"
---

I've been tuning a Dell Precision T7810 as a BCI server for real-time XR work-- two Xeon E5-2630 v3 processors, 32 threads, two NUMA nodes, the kind of dual-socket Haswell-era machine that rewards you for thinking about memory topology and punishes you for ignoring it.

The goal is to characterize this host's parallel and scheduling behavior across kernel configurations-- generic lane versus PREEMPT_RT-- so I can make honest claims about what RT actually buys us on this hardware before building the XR compositor on top of it.

![It needs Chapel Lang](/images/posts/chapel-lang-meme.webp)

## The machine

`honey` is a Dell Precision T7810 running Rocky Linux with a heavily tuned kernel cmdline-- `tsc=nowatchdog`, `nohz_full`, `isolcpus`, `irqaffinity`, the works. Two kernel lanes are installed:

- **Generic**: `6.19.5-7.xr.el10`, `PREEMPT_DYNAMIC` -- the current baseline
- **RT**: `6.19.5-rt1-8.xr.el10`, `PREEMPT_RT` -- booted and validated, SMI storm observed (1.6 SMIs/sec)

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

## Generic lane baseline (captured)

Two runs on the generic lane, same day, same kernel, same Chapel 2.8.0:

| Metric | Run 1 (Nix-prebuilt) | Run 2 (on-target build) |
| --- | ---: | ---: |
| Serial reduction | 22.83 ms | 22.61 ms |
| Parallel reduction | 2.28 ms | 1.675 ms |
| Speedup (serial / parallel) | 10.01x | 13.50x |
| Conforms | true | true |

The serial path is stable (~1%). The parallel path varies ~26% between runs-- that variance is the interesting signal, and characterizing it is part of the point.

## RT lane (next)

The RT kernel was booted on `honey` the same day. `realtime: 1`, PREEMPT_RT enabled, CONFIG_HZ=1000. SMI validation showed 1.6 SMIs/sec-- likely an SMI storm that will need BIOS-level mitigation before the RT numbers mean much.

The Chapel probe hasn't run on the RT lane yet. That capture, with matched SMI and `hwlat` context, is the next step and the one that will actually tell us whether RT scheduling changes the parallel characterization story on this hardware.

## The reproducibility pipeline

The probe is Chapel. The reproducibility is [Nix](https://nixos.org/) (hermetic compiler sourcing) and [Dhall](https://dhall-lang.org/) (typed evidence records). One command:

```bash
just chapel-host-capture-live-on-target target=jess@honey tag=baseline
```

![Chapel probe pipeline](/images/posts/chapel-probe-pipeline.svg)

Every artifact-- compiler path, host context, probe output, Dhall record-- stays tied to a repo path.

## What's next

- RT-lane Chapel capture with matched SMI and `hwlat` context
- Longer generic-lane capture series to characterize the parallel variance
- Fresh `quickchpl` PBT run for the paper-bound timing invariant claims

The [Dell-7810](https://github.com/Jesssullivan/Dell-7810) repo has everything: Chapel probes, Dhall records, raw captures, publication roadmap, and the claim ladder that keeps me honest.

-Jess
