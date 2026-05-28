---
title: "Resume & CV — three documents, one source"
date: "2026-05-28"
description: "There are now three documents on the /cv page: a generic resume, a targeted (applied-R&D) resume, and the full CV. All three are built from spear-resumes via a small new rules_tectonic Bazel module."
tags: ["personal", "resume", "cv", "bazel"]
published: true
slug: "resume-cv-three-lane"
category: "personal"
---

# Resume & CV — three documents, one source

The [/cv page](/cv) now has three documents instead of two:

- **Resume** — the broad pitch. Full-stack + applied R&D + DevSecOps + kernel work, no specific employer in mind.
- **Resume — Targeted** — the applied-R&D framing. Same person; the bullets foreground the parts most useful to research-shop hiring managers.
- **Full CV** — the long-form record. Cover-letter intro, ventures, fun facts, the whole eclectic work history.

Default tab is the generic resume. Pick whichever one fits what you're after.

## What changed under the hood

I pulled the TeX source out of this site and into a small dedicated repo, [spear-resumes](https://github.com/Jesssullivan/spear-resumes). One source of truth, one set of polish edits, one place to fix typos. The site fetches the prebuilt PDFs from there at build time.

The fetch goes through Bazel — there was no off-the-shelf rule for compiling LaTeX via [Tectonic](https://tectonic-typesetting.github.io/), so I wrote one: [rules_tectonic](https://github.com/Jesssullivan/rules_tectonic). It downloads the right prebuilt tectonic binary per host platform, registers it as a Bazel toolchain, and exposes a single `tectonic_pdf` rule that takes a `.tex` and produces a `.pdf`. Pure bzlmod, MIT-licensed, smoke-tested on darwin-arm64 and the Ubuntu/macOS CI matrix.

If you maintain LaTeX docs and want them as Bazel-built outputs, the README has the consumption snippet.

## Where the three documents live

```
spear-resumes/
├── str/        # private — STR cyber lane
├── cra/        # → resume_targeted.pdf
└── generic/    # → resume.pdf + cv.pdf
```

You can browse the public lanes [in spear-resumes](https://github.com/Jesssullivan/spear-resumes/tree/main).

<a href="/cv/jess_sullivan_resume.pdf" download class="inline-block mt-4 text-sm underline">Download Resume PDF</a>
&middot;
<a href="/cv/jess_sullivan_resume_targeted.pdf" download class="inline-block mt-4 text-sm underline">Download Targeted Resume PDF</a>
&middot;
<a href="/cv/jess_sullivan_cv.pdf" download class="inline-block mt-4 text-sm underline">Download Full CV PDF</a>
