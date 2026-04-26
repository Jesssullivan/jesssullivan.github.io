---
title: "Characterizing a Dual-Socket BCI Server Before Claiming RT Wins"
date: "2026-04-25"
description: "A draft result note for a Dell T7810 BCI server: generic repeats captured, RT SMI/hwlat matched, RT Chapel repeat captured, no RT improvement claim."
tags: ["Chapel", "Nix", "Dhall", "NUMA", "hardware", "reproducibility", "RT"]
published: false
slug: "reproducible-host-probes-nix-chapel-dhall"
category: "hardware"
source_repo: "Jesssullivan/Dell-7810"
source_path: "docs/platform/honey-rt-chapel-repeat-2026-04-26.md"
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

## Matching RT window (captured)

The matching RT-side long-window packet exists for SMI and `hwlat`, and the follow-up Chapel-only RT repeat now exists too. It is still not an improvement story.

| Metric | Generic 120s window | RT 120s window |
| --- | ---: | ---: |
| SMI sample 1 | 280 / 120s | 279 / 120s |
| SMI sample 2 | 279 / 120s | 279 / 120s |
| SMI sample 3 | 279 / 120s | 278 / 120s |
| tracefs `hwlat` max 1 | 0 us | 2 us |
| tracefs `hwlat` max 2 | 0 us | 2 us |
| tracefs `hwlat` max 3 | 0 us | 14 us |

That is the opposite of an RT victory lap. RT did not reduce the SMI rate in this packet, and one RT `hwlat` window crossed the 10 us checklist threshold.

The hardened RT Chapel repeat completed five conforming samples:

![Generic versus RT repeat packet](/images/posts/honey-generic-rt-repeat-packet.svg)

| Metric | RT repeat |
| --- | ---: |
| Serial seconds | 0.022144-0.023715 |
| Parallel seconds | 0.001726-0.016977 |
| Characterization ratio | 1.3617x-12.8297x |
| Ratio mean | 9.3204x |
| Ratio sample stdev | 4.6220x |
| Conforms | 5 / 5 |

The generic repeat it should be compared against had a ratio mean of 12.2760x and sample stdev of 1.8093x. The RT repeat had one severe parallel outlier: sample 2 took 16.977 ms on the parallel path and collapsed to 1.3617x. That outlier is the result, not noise to hand-wave away.

The host returned to the saved generic kernel afterward, the generic validator passed, and `rke2-server` came back active after boot settle.

## What would make RT worth it?

This started as "do we need an RT kernel for the BCI/XR box?" The measured answer is narrower: the current host-characterization packet does not justify making RT the default. It does not prove RT is useless. It says the next claim has to come from a downstream deadline, not from kernel flavor.

The Chapel result is a caution flag, not a universal law. PREEMPT_RT changes Linux by making more kernel work preemptible and by moving many interrupt handlers into scheduler-controlled threads. That can help a high-priority deadline thread. It can also perturb a mixed workload. My local packet only proves that this NUMA-aware Chapel probe got slower and more variable under this RT boot.

So the next tests have to be specific:

**GPU and VR frame timing**: OpenXR exposes predicted display time and display period; Monado documents frame pacing as application wake, render, compositor submit, present, and display. A useful RT claim needs missed-frame or frame-timing histograms from that pipeline. RT does not by itself fix display bandwidth, DSC, GPU throughput, or headset optics.

**BCI and audio I/O**: This is the most plausible RT surface, but it needs period, buffer, quantum, xrun, round-trip latency, and missed-deadline evidence. If a low-buffer audio or sensor-ingest packet misses deadlines on generic and improves under RT, that is a real result. Without that packet, "RT is needed for BCI" is just a preference.

**Buffering and application design**: Queues, backpressure, batching, timestamps, and clock-domain conversion can dominate latency even on a good kernel. If the application buffers badly, RT will not rescue the design.

**The alternative that already exists**: `honey` already has `isolcpus`, `nohz_full`, `irqaffinity`, and `tsc=nowatchdog` applied through the `linux-xr` posture. The lower-risk next hypothesis is targeted isolation plus real-time scheduling policy for the specific audio/BCI thread, then measure whether deadlines are missed.

The RT characterization campaign produced a defensible cautionary result: the host was tested, the result was captured, and the conclusion is bounded. The decision framework and source-grounded analysis live in the [Dell-7810 repo](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/publication/rt-benefit-decision-framework-2026-04-26.md).

## The reproducibility pipeline

The probe is Chapel. The reproducibility is [Nix](https://nixos.org/) (hermetic compiler sourcing) and [Dhall](https://dhall-lang.org/) (typed evidence records). One command:

```bash
just platform-host-characterization-window target=jess@honey tag=generic-repeat-2026-04-26 expect_lane=generic smi_samples=3 smi_duration=120 hwlat_duration=120 chapel_samples=5
```

![Chapel probe pipeline](/images/posts/chapel-probe-pipeline.svg)

Every artifact-- compiler path, host context, probe output, Dhall record-- stays tied to a repo path.

## What's next

The RT host-probe question is answered for now. The next work starts on the generic lane:

- **Targeted core isolation**: test `SCHED_FIFO` on isolated cores for audio/BCI threads and measure the actual deadline behavior
- **Audio/BCI IO packet**: period, buffer, quantum, xrun, and deadline evidence under the generic kernel with isolation tuning
- **XR frame timing**: `xrWaitFrame` / compositor timing histogram via Monado, missed-frame counts, and GPU/display mode evidence (XoxDWM-owned)
- **Fresh `quickchpl` PBT run** for the paper-bound timing invariant claims
- **Fan and enclosure work**: the T7810 thermal path and the Session 01 bench measurements are independent of RT

The RT lane stays available if a downstream packet ever demonstrates a concrete deadline failure on the generic kernel. The burden of proof has shifted: RT needs to earn its way back in, not be assumed.

The [Dell-7810](https://github.com/Jesssullivan/Dell-7810) repo has everything: Chapel probes, Dhall records, raw captures, publication roadmap, RT analysis, and the claim ladder that keeps me honest.

-Jess
