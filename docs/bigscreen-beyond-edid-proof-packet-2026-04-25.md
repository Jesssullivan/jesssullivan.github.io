# Bigscreen Beyond EDID Non-Desktop Handling: Proof Packet

Date: `2026-04-25`
Status: draft; pre-submission; quirk-only patch held; parser proof passed
Decision gate: Monday evening, `2026-04-27`

## Abstract

A Bigscreen Beyond head-mounted display attached to the `honey` workstation
reports EDID manufacturer `BIG`, product `0x1234`, and a DisplayID 2.0
extension header whose primary-use field is `0x07`, corresponding to a
head-mounted virtual reality display. The required DRM semantic result is
`non_desktop = true`.

A local downstream quirk patch can produce that result, but a quirk-only
upstream submission is not presently appropriate. An identical `BIG/0x1234`
quirk was submitted to `dri-devel` in May 2024, and reviewers directed the
problem toward DisplayID parsing rather than an EDID quirk table entry.

That parser route now has a positive result: a no-quirk KUnit test on `honey`
against current `drm-misc-next` passed with this captured EDID and
`non_desktop = true`. The remaining decision is whether to send a
regression-test-only patch or to close the upstream submission lane as already
handled by current upstream behavior.

## Primary Evidence

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
| Durable local capture | `Jesssullivan/Dell-7810:data/captures/honey/bigscreen-beyond-edid-2026-04-25.txt` |
| No-quirk KUnit proof | `Jesssullivan/Dell-7810:data/captures/honey/bigscreen-displayid-kunit-2026-04-25.txt` |
| KUnit base | `drm-misc-next` commit `03af6c3afc48` |
| KUnit result | `drm_test_connector_edid_displayid_hmd_primary_use` passed |

The current evidence proves the device identity, the DisplayID primary-use
claim, and the upstream parser result for this EDID in a no-quirk kernel-tree
test. It does not yet prove a live connector-property result from an
unmodified upstream kernel booted on this hardware.

## Structural EDID Preflight

A local byte-level preflight of the captured EDID produced the following
results:

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

This preflight showed that the captured EDID satisfies the structural
assumptions that current `drm-misc-next` appears to require before
`update_displayid_info()` can observe DisplayID version `0x20` and primary use
`0x07`. The subsequent KUnit proof confirms that parser expectation in-tree.

## Prior-Art Record

The relevant public history is a May 2024 `dri-devel` thread and the associated
freedesktop issue:

- Sefa Eyeoglu submitted a `drm_edid.c` quirk adding `BIG/0x1234` to the
  non-desktop table on `2024-05-17`.
- Jani Nikula requested that the issue include EDID evidence and possibly
  `drm.debug=14` dmesg so that the quirk would remain explainable later.
- Sefa submitted a revised patch referencing freedesktop issue 39.
- Philipp Zabel observed that the EDID's DisplayID block already describes the
  primary use as a head-mounted virtual reality display and that
  `update_displayid_info()` should use this to set `non_desktop`.
- Sefa noted EDID conformance failures in the DisplayID data blocks.
- Jani stated that the DisplayID header primary-use value should be sufficient
  for classification.

Source links:

- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454216.html>
- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454226.html>
- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454244.html>
- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454248.html>
- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454255.html>
- <https://lists.freedesktop.org/archives/dri-devel/2024-May/454416.html>
- <https://gitlab.freedesktop.org/drm/misc/kernel/-/work_items/39>

## Technical Implication

The proposed upstream artifact cannot be framed as a novel EDID quirk. The
review record establishes a stronger expected invariant:

```text
DisplayID version 2.0
+ primary-use field HEAD_MOUNTED_VR
=> drm_display_info.non_desktop = true
```

Current `drm-misc-next` contains the intended decision point in
`update_displayid_info()` in `drivers/gpu/drm/drm_edid.c`. The DisplayID
iterator path in `drivers/gpu/drm/drm_displayid.c` exposes the extension
version and primary-use byte. The relevant constants are
`DISPLAY_ID_STRUCTURE_VER_20` and `PRIMARY_USE_HEAD_MOUNTED_VR`.

The parser-path result is now positive. The technical question is no longer
whether a quirk is needed for this EDID in current `drm-misc-next`; it is
whether a small regression test is valuable upstream documentation for this
previously disputed hardware case.

## Candidate Paths

### Path A: Parser Or Regression-Test Submission

This is the preferred technical route.

1. Current `drm-misc-next` has been evaluated against the captured Bigscreen
   Beyond EDID by KUnit on `honey`.
2. Because upstream sets `non_desktop`, retire the local quirk lane and
   document the downstream cleanup.
3. If submitting upstream, prefer a regression-test-only patch with references
   to the 2024 review thread and freedesktop issue 39.
4. Do not submit a parser fix unless a separate failure is found.
5. Submit any patch with references to the 2024 review
   thread and freedesktop issue 39.

### Path B: Quirk With Explicit Rebuttal

This path is not preferred. It is acceptable only if Path A produces evidence
that the parser path cannot classify the connector correctly.

The submission would need to include:

- full EDID evidence;
- the upstream failure mode;
- the downstream result;
- a direct explanation of why the DisplayID header should not be relied upon
  for this EDID;
- `drm.debug=14` dmesg if the failure mode is not self-evident.

### Path C: Prior-Art Coordination

Before any public patch that supersedes or reopens the 2024 work, contact Sefa
Eyeoglu if feasible. Ask whether they prefer to resend, co-author, review, or
be credited. Add credit trailers only with explicit consent.

Path C can run in parallel with Path A. It should precede any public v1 that
uses Sefa's prior submission as a foundation.

## Verification Routes

### Offline Parser Proof

Use the captured 256-byte EDID as a fixed test vector. This route is complete
for the current question: `drm_test_connector_edid_displayid_hmd_primary_use`
passed against `drm-misc-next` commit `03af6c3afc48` without any `BIG/0x1234`
quirk.

Required output:

- kernel tree and commit;
- test vector hash or stored EDID path;
- function or test target exercised;
- observed `non_desktop` result: true;
- whether any new patch is required.

### Live Kernel Proof

Boot or run an unmodified upstream-equivalent kernel on a host with the
headset attached.

Required output:

- kernel build identity;
- connector path;
- raw EDID;
- connector property result;
- dmesg excerpt if the result differs from the parser expectation.

### Runtime Context Proof

This route is explanatory rather than necessary for the kernel decision. It may
show why the classification matters to Monado, DRM leasing, and XoxdWM, but it
must not be used as a substitute for the DRM parser proof.

## Hardware Required

- Original Bigscreen Beyond headset reporting `BIG/0x1234`.
- Linux host with a DisplayPort path to the headset.
- GPU and DRM stack exposing the headset connector through `/sys/class/drm`
  and `/dev/dri`.
- Ability to read EDID and connector properties without changing compositor or
  service state.
- Optional OpenXR/Monado stack for runtime context after the kernel property is
  verified.

## Submission Rules

- Do not send the current quirk-only patch before the `2026-04-27` decision
  gate.
- Do not omit the 2024 thread from the patch rationale.
- Do not use `Reported-by`, `Suggested-by`, `Reviewed-by`, or
  `Co-developed-by` without explicit permission.
- Do not include the Bigscreen Beyond 2e product ID `0x5095` unless separate
  evidence is captured.
- Do not claim unpatched upstream runtime behavior until it has been measured.
- Do not include lab-private topology, credentials, or host-access details in
  public kernel email.

## Current Conclusion

The strongest submission path remains Path A, with Path C running in parallel
if a public patch is sent. Path A now says current upstream parser behavior is
correct for the captured EDID. A quirk-only v1 would repeat the prior public
patch and would likely receive the same technical objection. The next useful
artifact is either a regression-test-only patch or a documented decision to
retire the downstream quirk carry.
