---
title: "Bigscreen Beyond EDID Non-Desktop Handling: Evidence, Prior Art, and Submission Path"
date: "2026-04-25"
description: "A pre-submission technical report for the Bigscreen Beyond EDID non-desktop lane, including live EDID evidence, prior dri-devel review, and a no-quirk DisplayID parser proof."
tags: ["linux", "kernel", "drm", "edid", "openxr", "monado", "hardware", "rocky-linux", "bci"]
published: false
slug: "bigscreen-beyond-edid-kernel-quirk"
category: "hardware"
source_repo: "tinyland-inc/linux-xr"
source_path: "drivers/gpu/drm/drm_edid.c"
---

## Abstract

The original Bigscreen Beyond headset attached to my `honey` workstation
reports EDID manufacturer `BIG`, product `0x1234`, and a DisplayID 2.0
extension whose primary-use byte is `0x07`, corresponding to a head-mounted
virtual reality display. The target Linux DRM connector semantic is therefore
`non_desktop = true`.

The immediate conclusion is not that a new EDID quirk should be submitted.
Sefa Eyeoglu submitted the same `BIG/0x1234` quirk to `dri-devel` in May 2024,
and the review thread identified the DisplayID primary-use field as the
preferred basis for classification. A quirk-only v1 from me would duplicate
that public work and likely repeat the same review failure.

The parser proof now exists. A no-quirk KUnit test on `honey`, run against
`drm-misc-next` commit `03af6c3afc48`, parsed the captured EDID and passed with
`non_desktop = true`. That result changes the candidate upstream artifact from
"add a product quirk" to either "submit a regression-test-only patch" or "close
the upstream submission lane because current upstream already handles this
EDID."

## Measured Evidence

The current local evidence was captured from the headset path on `honey`
without changing service state.

| Measurement | Value |
| --- | --- |
| Host | `honey` |
| Kernel during capture | `6.19.5-7.xr.el10` |
| DRM connector | `/sys/class/drm/card0-DP-2` |
| EDID first 16 bytes | `00 ff ff ff ff ff ff 00 09 27 34 12 d2 04 00 00` |
| EDID manufacturer/product | `BIG/0x1234` |
| DisplayID extension prefix | `70 20 79 07 ...` |
| DisplayID version byte | `0x20` |
| DisplayID primary-use byte | `0x07` |
| Primary-use interpretation | head-mounted virtual reality display |
| Durable capture | `Jesssullivan/Dell-7810:data/captures/honey/bigscreen-beyond-edid-2026-04-25.txt` |
| No-quirk KUnit proof | `Jesssullivan/Dell-7810:data/captures/honey/bigscreen-displayid-kunit-2026-04-25.txt` |
| KUnit base | `drm-misc-next` commit `03af6c3afc48` |
| KUnit result | `drm_test_connector_edid_displayid_hmd_primary_use` passed |

This evidence proves the device identity, the DisplayID header claim, and the
upstream parser result for this EDID in a no-quirk KUnit test. It does not yet
prove a live connector-property result from an unmodified upstream kernel booted
on this hardware.

I also ran a byte-level preflight against the captured EDID. The result is
important because it moves the next question from conjecture to a narrow parser
test.

| Check | Result |
| --- | --- |
| Total length | 256 bytes |
| Base EDID block checksum | `0x00` |
| DisplayID extension block checksum | `0x00` |
| DisplayID section checksum | `0x00` |
| DisplayID declared payload length | 121 bytes |
| First DisplayID block | tag `0x22`, revision `0x09`, payload length 40 bytes |
| First DisplayID block bounds | valid within the declared DisplayID section |
| Static parser expectation | `non_desktop = true` |

This was a reason to prioritize the parser route rather than a duplicate quirk.
The KUnit result now confirms the parser route in-tree.

## Prior Public Review

The relevant upstream record is already public:

| Date | Source | Result |
| --- | --- | --- |
| 2024-05-17 | [Sefa Eyeoglu initial patch](https://lists.freedesktop.org/archives/dri-devel/2024-May/454216.html) | Submitted a `drm_edid.c` quirk for `BIG/0x1234`. |
| 2024-05-17 | [Jani Nikula evidence request](https://lists.freedesktop.org/archives/dri-devel/2024-May/454226.html) | Requested EDID evidence, and possibly `drm.debug=14` dmesg, in a referenced issue. |
| 2024-05-17 | [Sefa revised patch](https://lists.freedesktop.org/archives/dri-devel/2024-May/454244.html) | Added the freedesktop issue reference. |
| 2024-05-17 | [Philipp Zabel parser objection](https://lists.freedesktop.org/archives/dri-devel/2024-May/454248.html) | Noted that the DisplayID extension marks the device as an HMD and that `update_displayid_info()` should set `non_desktop`. |
| 2024-05-17 | [Sefa EDID conformance note](https://lists.freedesktop.org/archives/dri-devel/2024-May/454255.html) | Reported DisplayID conformance failures from `edid-decode --check`. |
| 2024-05-20 | [Jani Nikula parser-position reply](https://lists.freedesktop.org/archives/dri-devel/2024-May/454416.html) | Reiterated that the primary-use value should be deducible from the DisplayID header. |
| 2024-05-17 | [freedesktop issue 39](https://gitlab.freedesktop.org/drm/misc/kernel/-/work_items/39) | Recorded full EDID evidence for the same headset identity. |

This history changes the submission burden. The kernel-facing question is no
longer "can a product quirk classify this headset?" The more precise question
is whether the current DisplayID parser classifies this EDID correctly, and if
not, why not.

## Kernel Decision Point

The relevant invariant is:

```text
DisplayID version 2.0
+ primary-use field HEAD_MOUNTED_VR
=> drm_display_info.non_desktop = true
```

Current `drm-misc-next` has logic in `update_displayid_info()` in
`drivers/gpu/drm/drm_edid.c` to set `non_desktop` from DisplayID primary use.
The iterator path in `drivers/gpu/drm/drm_displayid.c` exposes the DisplayID
extension version and primary-use byte. The local EDID contains the same
critical header pattern as the 2024 public issue:

```text
70 20 79 07 ...
```

where `0x20` is DisplayID 2.0 and `0x07` is the head-mounted VR primary-use
code.

The direct KUnit result is the important proof point:

```text
[PASSED] drm_test_connector_edid_displayid_hmd_primary_use
Testing complete. Ran 1 tests: passed: 1
```

No `BIG/0x1234` quirk was applied in that test tree.

## Submission Paths

### Path A: Parser Or Regression-Test Patch

This is now the supported route. Current `drm-misc-next` has been evaluated
against the full captured EDID and derives `non_desktop` without a product
quirk. If I send a patch, it should be a regression-test-only patch that records
the previously disputed hardware case and links the 2024 review thread.

### Path B: Quirk With Explicit Rebuttal

This route is only defensible if Path A shows that the parser route cannot
classify this EDID correctly. A quirk submission would need to include the full
EDID, the upstream failure result, the downstream result, and a direct response
to the 2024 DisplayID objection.

### Path C: Coordination With Sefa Eyeoglu

Before I send a public patch that supersedes or reopens the 2024 work, I should
attempt to coordinate with Sefa Eyeoglu. Credit trailers such as `Reported-by`,
`Suggested-by`, `Reviewed-by`, or `Co-developed-by` require explicit consent.

Path A and Path C can proceed in parallel. A quirk-only patch should remain
held until the decision gate on Monday evening, `2026-04-27`.

## Verification Requirements

The minimum proof packet for a kernel submission should include:

- full 256-byte EDID evidence;
- kernel tree and commit used for parser proof;
- observed `non_desktop` result on current upstream or an upstream-equivalent
  build;
- explanation of whether the result comes from DisplayID parsing or an EDID
  quirk;
- references to the 2024 `dri-devel` thread and freedesktop issue 39;
- no claims about Bigscreen Beyond 2e product ID `0x5095` unless separately
  evidenced.

The Monado/XoxdWM runtime path remains useful context, but it is not a
substitute for the DRM parser result. Runtime proof explains why the
classification matters. Parser proof determines what should be sent upstream.

## Current Status

The local quirk branch remains useful as a comparison artifact, but it is not
appropriate for public submission:

| Field | Value |
| --- | --- |
| Worktree | `/Volumes/linux-xr-cs/linux-xr-drm-misc-edid-check` |
| Branch | `jess/upstream-bigscreen-edid-v1-drm-misc` |
| Candidate commit | `6130bc78eefb` |
| Status | held; do not send as v1 |
| Decision gate | Monday evening, `2026-04-27` |

The parser-path proof against the captured EDID now shows that current upstream
already handles the device. The responsible outcome is to avoid a duplicate
quirk and instead clean up the downstream carry, unless a regression-test-only
patch is worth submitting to preserve this exact case in DRM tests.

-Jess
