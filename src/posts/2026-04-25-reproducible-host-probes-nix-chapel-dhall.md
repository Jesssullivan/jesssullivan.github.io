---
title: "Reproducible Host Probes With Nix, Chapel, and Dhall on a Dell T7810"
date: "2026-04-25"
description: "Paper-companion draft for a Dell T7810 host-characterization pipeline: Chapel 2.8.0, Nix-built execution, Dhall evidence records, and two saved generic-lane probe runs on honey."
tags: ["Chapel", "Nix", "Dhall", "NUMA", "hardware", "reproducibility"]
published: false
slug: "reproducible-host-probes-nix-chapel-dhall"
category: "hardware"
source_repo: "Jesssullivan/Dell-7810"
source_path: "docs/platform/honey-chapel-live-result-2026-04-23.md"
---

Two Chapel runs on `honey` now have the same shape: 100 synthetic channels,
2500 samples, two 50-channel partitions, `Conforms: true`, and a full host
context captured beside the result.

That is useful.

It is also smaller than it sounds. This is not an RT victory lap, not a NUMA
benchmark, and not a claim that an XR runtime got better. It is the evidence
packet I wanted before making any of those claims: a reproducible host probe
with source paths, raw captures, a Dhall record, and a figure pipeline that can
survive being reused in a paper or talk.

## Result card

| Field | Value |
| --- | --- |
| Host | `honey`, Dell Precision T7810 |
| CPU topology | 2 x Intel Xeon E5-2630 v3, 32 threads, 2 NUMA nodes |
| Kernel lane | generic `6.19.5-7.xr.el10`, `PREEMPT_DYNAMIC` |
| RT state | `/sys/kernel/realtime` absent |
| Chapel version | 2.8.0 |
| Chapel locale model | flat, `Locales: 1`, `Sublocales: 0` |
| Probe | `HostNumaProbe.chpl`, 94 lines |
| Workload | 100 channels, 2500 samples, 250 Hz, 2 partitions of 50 |
| Saved runs | baseline and turnkey replay, both captured on 2026-04-23 |
| Result | both runs report `Conforms: true` |
| Claim level | C4 precondition only: host-characterization method, not RT or XR benefit |

## Evidence packet

All paths are relative to
[Jesssullivan/Dell-7810](https://github.com/Jesssullivan/Dell-7810).

| Evidence | Repo path |
| --- | --- |
| Live result note | [`docs/platform/honey-chapel-live-result-2026-04-23.md`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/platform/honey-chapel-live-result-2026-04-23.md) |
| Baseline raw capture | [`data/captures/honey/chapel-host-probe-baseline.txt`](https://github.com/Jesssullivan/Dell-7810/blob/main/data/captures/honey/chapel-host-probe-baseline.txt) |
| Turnkey replay raw capture | [`data/captures/honey/chapel-host-probe-turnkey.txt`](https://github.com/Jesssullivan/Dell-7810/blob/main/data/captures/honey/chapel-host-probe-turnkey.txt) |
| Machine-readable result | [`dhall/defaults/honey-chapel-host-probe-baseline-2026-04-23.dhall`](https://github.com/Jesssullivan/Dell-7810/blob/main/dhall/defaults/honey-chapel-host-probe-baseline-2026-04-23.dhall) |
| Probe program | [`analysis/examples/HostNumaProbe.chpl`](https://github.com/Jesssullivan/Dell-7810/blob/main/analysis/examples/HostNumaProbe.chpl) |
| Partition/timing support | [`analysis/src/HostNumaTiming.chpl`](https://github.com/Jesssullivan/Dell-7810/blob/main/analysis/src/HostNumaTiming.chpl) |
| Timing predicates | [`analysis/src/TimingProofs.chpl`](https://github.com/Jesssullivan/Dell-7810/blob/main/analysis/src/TimingProofs.chpl) |
| Publication roadmap | [`docs/publication/bodies-of-work-chapel-flow.md`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/publication/bodies-of-work-chapel-flow.md) |
| Paper-companion standard | [`docs/publication/paper-companion-standards.md`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/publication/paper-companion-standards.md) |
| Pipeline figure source | [`docs/publication/figures/bow5-host-probe-pipeline.dot`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/publication/figures/bow5-host-probe-pipeline.dot) |
| Pipeline figure render | [`docs/publication/figures/rendered/bow5-host-probe-pipeline.svg`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/publication/figures/rendered/bow5-host-probe-pipeline.svg) |
| Claim ladder | [`docs/platform/rt-research-contract.md`](https://github.com/Jesssullivan/Dell-7810/blob/main/docs/platform/rt-research-contract.md) |

## Measured numbers

| Metric | Baseline | Turnkey replay | Difference |
| --- | ---: | ---: | ---: |
| Serial reduction | 22.83 ms | 22.61 ms | -0.22 ms, -1.0% |
| Parallel reduction | 2.28 ms | 1.675 ms | -0.605 ms, -26.5% |
| Reported speedup | 10.0132x | 13.4985x | +3.4853x |
| Partitions | 2 x 50 | 2 x 50 | unchanged |
| Timing conforms | true | true | unchanged |
| Delta | 1.86265e-9 | 1.86265e-9 | unchanged |
| Max synthetic jitter | 1.33574e-15 s | 1.33574e-15 s | unchanged |

The stable result is not "the machine is fast." That would be convenient, and
also much too sloppy.

The stable result is narrower: the same Chapel 2.8.0 host probe produced two
conforming, path-captured results on the same generic kernel lane, with enough
host context to cite and replay the measurement.

The serial path moved by about 1.0 percent between runs. The parallel path moved
by about 26.5 percent. That second number is exactly why this should not be
presented as a performance benchmark yet. It is a host-characterization packet:
useful, repeatable, and bounded, but still too small to assign causality to OS
scheduling, cache state, thermal state, IRQ placement, or background workload.

## Method surface

The probe is intentionally small:

| File | Lines | Role |
| --- | ---: | --- |
| `analysis/examples/HostNumaProbe.chpl` | 94 | Live host probe and report format |
| `analysis/src/HostNumaTiming.chpl` | 85 | Partitions, synthetic signal data, timing stats |
| `analysis/src/TimingProofs.chpl` | 112 | Monotonic intervals, jitter, conformance predicate |

The companion PBT work is a separate publication body. I want to use it here as
method scaffolding, not as newly recorded live evidence. The current safe
statement is:

> The source tree contains Chapel property tests for partitioning, timing, and
> deterministic fixtures; the paper-bound PBT claim should cite a fresh recorded
> test run before publication.

That distinction matters.

Source structure is not the same artifact as a saved test run.

## Figure source

The paper-bound pipeline figure is Graphviz, not Mermaid, so the diagram can be
rendered into papers and slides from the same source:

```bash
nix develop .#publication -c just publication-figures-render
```

Current source and render:

```text
docs/publication/figures/bow5-host-probe-pipeline.dot
docs/publication/figures/rendered/bow5-host-probe-pipeline.svg
```

The figure encodes the evidence flow:

```text
Nix flake -> just recipe -> honey -> HostNumaProbe -> raw capture
          -> Dhall record -> result note -> paper/blog packet
```

That is the important reproducibility claim. The compiler path, host context,
probe output, Dhall record, and narrative result all stay tied to repo paths.
No chat archaeology required.

## Why `Sublocales: 0` is not a failed result

`numactl --hardware` reports two NUMA nodes on `honey`, but Chapel reports one
locale and zero sublocales. With the current Chapel 2.8.0 flat locale model,
that is expected: the program is a single-locale host probe while NUMA topology
comes from the operating system inventory.

So the correct wording is:

| Unsafe wording | Safer wording |
| --- | --- |
| Chapel sees both NUMA nodes | The OS reports two NUMA nodes; Chapel ran in a flat single-locale model |
| Chapel proved NUMA scheduling | Chapel expressed a parallel host probe against OS-visible topology |
| The host is optimized for RT | The generic lane produced a C4-precondition host-characterization result |

Less catchy.

Much more likely to survive peer review.

## Claim boundary

What these results establish:

- Chapel 2.8.0 can compile and run the Dell-owned host probe on `honey`.
- The generic kernel lane produced two saved, conforming probe outputs.
- The raw captures include kernel, command line, CPU topology, NUMA inventory,
  compiler source, and probe output.
- Dhall gives the result a machine-readable citation surface.

What these results do not establish:

- They do not prove PREEMPT_RT benefit. Both runs are generic-lane evidence.
- They do not prove downstream XR or compositor benefit. That is a XoxDWM C4
  claim and needs downstream software evidence.
- They do not prove Chapel-visible NUMA sublocales. The run used the flat locale
  model.
- They do not yet justify a performance claim. Two runs are enough for a methods
  packet, not a benchmark distribution.

## Reproduction command

The shortest repo-owned rerun path is:

```bash
just chapel-host-capture-live-on-target target=jess@honey tag=baseline
```

The publication-grade path also needs the projection step so the capture becomes
a citable evidence record:

```bash
python3 scripts/platform/project-chapel-host-probe-dhall \
  data/captures/honey/chapel-host-probe-baseline.txt \
  --date 2026-04-23 \
  --host honey \
  --compiler-source dell-local-fallback-on-target \
  --expected-lane generic \
  --result pass
```

## Paper companion role

This post belongs to BoW-5: the Nix + Chapel + Dhall evidence pipeline. It can
support BoW-2, the "Chapel as host-characterization language" paper, but it
should not replace that paper.

That is the whole reason to keep the blog post numbers-forward. The paper gets
the fuller argument. The blog gets the durable packet a reader can inspect
without reading the entire repo.

The next evidence that would strengthen the chain:

- a fresh recorded `quickchpl`/PBT run for the Chapel timing invariants,
- an RT-lane Chapel capture with matched SMI and `hwlat` context,
- repeated generic-lane captures to summarize variance instead of showing two
  runs as a representative distribution,
- final figure captions that cite the rendered Graphviz figures now committed
  beside their DOT sources.

## Program boundary

This post is deliberately smaller than the whole project.

Dell-7810 is the public evidence authority for the host: NUMA inventory, SMI
and hardware-latency notes, kernel-lane validation, Chapel probes, and Dhall
records. `linux-xr` supplies kernel artifacts. XoxDWM is where downstream XR
and compositor benefit would have to be proven.

That split keeps this post honest. A host probe can become a methods section or
an appendix. It cannot, by itself, become a claim that an XR runtime got better.

Boundaries are boring until they save you from publishing nonsense.

## References

- [Chapel Language](https://chapel-lang.org/) — probe language, version 2.8.0
- [Chapel Locale Models](https://chapel-lang.org/docs/usingchapel/localeModels.html) —
  documents `CHPL_LOCALE_MODEL=flat` behavior and `Sublocales: 0`
- [quickchpl](https://github.com/nicholasTng/quickchpl) — property-based
  testing library for Chapel (used in companion BoW-1 PBT work)
- [Dhall Language](https://dhall-lang.org/) — typed configuration language
  used for machine-readable evidence records
- [Nix](https://nixos.org/) — hermetic build system for compiler sourcing and
  reproducible probe execution
- Chamberlain, Callahan, and Zima, "Parallel Programmability and the Chapel
  Language," HPDC 2007 — working bibliography item for the paper version
- Broquedis et al., "hwloc: A Generic Framework for Managing Hardware
  Affinities in HPC Applications," Euro-Par 2010 — working bibliography item
  for the paper version

-Jess
