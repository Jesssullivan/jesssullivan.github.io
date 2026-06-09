---
title: "rules_tectonic: building LaTeX PDFs with Bazel, hermetically"
date: "2026-06-08"
description: "A tiny Bazel ruleset that turns a .tex file into a PDF with prebuilt tectonic binaries- no system TeX Live, no surprises."
tags: ["bazel", "latex", "tectonic", "devops", "reproducible-builds"]
published: false
category: "devops"
slug: "rules-tectonic-bazel-latex-pdfs"
author_slug: "jesssullivan"
---

I have a confession. I love LaTeX and I hate installing it.

For crying out loud- every time I want to build one little paper on a new machine, it's another two gigs of TeX Live, another `tlmgr` dance, another "wait, which `latexmk` is on my PATH" detour that eats an afternoon I did not budget. And when I tried to wire a `.tex` build into Bazel- where the whole point is that builds are hermetic and reproducible and don't reach out and grab whatever's lying around your system- the impedance mismatch was just... loud.

So I made a lil thing. It's called [rules_tectonic](https://github.com/Jesssullivan/rules_tectonic).

It's about as small as a Bazel ruleset can be while still being useful. One public rule:

```python
load("@rules_tectonic//tectonic:defs.bzl", "tectonic_pdf")

tectonic_pdf(
    name = "paper",
    main = "paper.tex",
)
```

That's the whole API. `bazel build //:paper` and you get a PDF.

The trick is [tectonic](https://tectonic-typesetting.github.io/)- a modernized, self-contained TeX/LaTeX engine that pulls packages on demand and caches them, instead of asking you to install the entire universe up front. `rules_tectonic` ships prebuilt tectonic binaries and registers toolchains for linux and darwin, both amd64 and arm64, so the right one just gets selected for whatever you're building on. No system TeX. No `apt install texlive-full`. No "works on my machine." The binary hashes are pinned in-tree, so the build that runs on my laptop is byte-for-byte the build that runs in CI.

The dependency footprint is deliberately tiny- just `bazel_skylib` and `platforms`, both already in the registry. It's MIT licensed. There's a working `//examples:hello` smoke target so you can see it compile a real PDF in about four lines.

Why did I want this? Because I keep writing little papers- recovery write-ups, protocol notes, the occasional honest-to-goodness IEEEtran conference thing- and I want them to live next to the code they describe, in the same Bazel graph, building the same hermetic way as everything else. A PDF is just another build artifact. It should act like one.

It's at `v0.1.0` right now, installable today via `bazel_dep` with a `git_override` (the README walks you through it). And I'm working on **submitting it to the Bazel Central Registry**- so that eventually it's a plain `bazel_dep(name = "rules_tectonic", version = "0.1.0")` with no override at all. The tag's pushed, the integrity hashes line up, and the main thing standing between here and a public BCR PR is a `presubmit.yml` and a tiny test module that builds a PDF end to end. Soon!

If you build documents and you're already in Bazel land, give it a spin. And if you find the rough edges before I do- huzzah, open an issue, that's the good stuff.

-Jess
