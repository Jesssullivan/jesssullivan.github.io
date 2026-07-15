# Content Federation Truth Reconciliation - 2026-07-14

## Purpose

This document reconciles the current blog, Tinyland content, Pulse, and
ActivityPub work against live behavior, current source, GitHub, Linear, the
`prompts-enqueue` library, and prior agent workflow artifacts.

It exists because those records have repeatedly collapsed different delivery
stages into one word such as "done," "shipped," or "federated." That has
produced false memories and unsafe sequencing decisions.

This is an as-of-2026-07-14 audit. Live behavior and open pull requests can
change after this snapshot.

## Evidence Order

When records conflict, use this order:

1. Current live behavior, including the deployed image or commit when known.
2. Current source on the repository default branch.
3. Current package registry and consumer pin state.
4. Current GitHub pull request, issue, and check state.
5. Current Linear issue and initiative state, including recent comments.
6. Ratified decision documents and merged architecture records.
7. Prompt files, workflow journals, plans, and agent memories.

The last category is historical evidence. It is not runtime authority.

## Completion Vocabulary

A capability can pass through all of these stages independently:

1. **Planned** - an issue, prompt, or implementation plan exists.
2. **Authored** - source exists on a branch or pull request.
3. **Merged** - source is on a default branch.
4. **Released** - a package version or image was published.
5. **Adopted** - the consumer pins and wires the released version.
6. **Deployed** - the adopted build is running in the target environment.
7. **Runtime-mutated** - required bootstrap, secret, or operator state changed.
8. **Live-proven** - the intended public behavior was observed end to end.

"Workflow completed" only means the orchestration process returned. A
completed workflow can contain agent errors, blocked verification, plan-only
lanes, or pull requests that were never merged.

## Authority Map

### Blog: `Jesssullivan/jesssullivan.github.io`

This repository builds `transscendsurvival.org`. It is a static reader and
display spoke. Local posts and generated snapshots provide first paint,
no-JavaScript behavior, rollback data, and regression fixtures. The Tinyland
blog and Pulse broker feeds hydrate or add display data.

It is not the durable Tinyland write authority, the Tinyland auth authority,
or the public ActivityPub delivery authority. Its current prerendered
WebFinger file points at `hub.tinyland.dev`, but it ignores the required
`resource` query parameter. That is not a standards-compliant resolver and
does not make either the blog or the static file an ActivityPub authority.

The additive merge in `src/routes/blog` means a broker omission does not
delete a checked-in post. A broker-only post can render through the broker
placeholder path, but the broker remains a display contract.

### Mothership: `tinyland-inc/tinyland.dev`

This is the application and content-control surface. It owns user resolution,
content detail routes, admin/bootstrap flows, package adoption, and deployment
integration. Source merged here is still not live until the relevant image is
built and deployed and any required runtime state is installed.

### Hub: `hub.tinyland.dev`

The hub currently serves dynamic blog and Pulse projection data and hosts the
delegated ActivityPub actor document. The blog and AP demo manifests explicitly
say public Fediverse delivery is disabled; the Pulse snapshot exposes no
delivery-policy field. The actor outbox, followers, and following collections
are currently empty.

An inbox accepting POST-shaped traffic and a valid actor document prove
endpoint shape. They do not prove signed delivery, remote receipt, follower
lifecycle, or moderation behavior.

### Package Repositories And Registry

`tinyland-auth`, `tinyland-invitation`, `tinyland-content`,
`tinyland-content-types`, `tinyland-security`, and `tinyland-activitypub` are
reusable source and release authorities. The registry repository is
`tinyland-inc/bazel-registry`.

A package release is not mothership adoption. A mothership pin is not a
deployment. Neither proves live behavior.

### Operator And Secret State

Kubernetes Secrets, GitHub Actions secrets, attended bootstrap operations,
SOPS custody, and key rotation are separate authorities. Pull requests cannot
claim those mutations unless the operator action and resulting live
fingerprint or behavior were verified.

## Live Snapshot

Observed on 2026-07-14:

| Surface | Current result | Interpretation |
| --- | --- | --- |
| `transscendsurvival.org/blog/week-notes-scroll-wheels-and-chasing-the-sun` | 200 | The production blog serves the post. |
| `tinyland.dev/blog/week-notes-scroll-wheels-and-chasing-the-sun` | 404 | The mothership detail fix is not live. |
| `tinyland.dev/@jesssullivan/notes/2026-04-26-cardinals-before-dawn` with browser HTML Accept | 404 `User not found` | The redirect loop is absent, but user authority still does not resolve. |
| The same note with ActivityPub Accept | 404 `Author not found` | The redirect loop is absent, but actor/user authority still does not resolve. |
| `tinyland.dev/@jesssullivan` with ActivityPub Accept | 200 | The mothership exposes an actor-shaped response. |
| `tinyland.dev/@jesssullivan/outbox` | 404 | The mothership is not the working public outbox authority. |
| `hub.tinyland.dev/@jesssullivan` with ActivityPub Accept | 200 | This is the delegated actor endpoint. |
| Hub outbox, followers, and following | 200 with zero items | Endpoint shape exists; public federation is not demonstrated. |
| Hub inbox GET | 405 with POST/OPTIONS allowed | Shape only; not delivery proof. |
| Hub blog broker | Dynamic, 140 posts | Live display authority is healthy. |
| Hub Pulse broker | Dynamic, 6 items | Pulse projection is live. |
| Hub AP demo stream | Three-item demo dated 2026-05-10 | Controlled, stale demo data; not public delivery. |
| `transscendsurvival.org/stream` | 404 | No production stream route. |
| `tss.tinyland.dev/stream` | 200, `noindex,nofollow` | Shadow surface only. |

The blog broker and AP demo manifests report
`publicFediverseDelivery:false`. The Pulse public snapshot carries no outbound
delivery-policy field; that absence is not evidence of enabled or disabled
delivery. The blog's production-health suite passed its DNS, HTTPS, broker,
and hydration checks. That does not contradict the ActivityPub findings
because those checks prove display projection, not public Fediverse delivery.

A later live check during this audit observed a terminal 404 for both note
representations, with no `Location` header or 307 loop. That supports TIN-2787
being Done for its narrow redirect-loop defect. It does not make the note route
live: `Author not found` and `User not found` are the remaining TIN-2788
authority failure. The mothership blog-detail URL still returns `Blog post not
found`, so TIN-2786 remains live-incomplete.

The trusted `main` run after pull request #227 (run `29326131530`, commit
`6deec66`) was red while production health was green. Its hosted lane passed,
but `Remote check` launched six Tectonic actions into one cold resource cache;
relay fetches stalled while three otherwise unrelated test targets timed out.
This was a workflow-capacity defect, not a Playwright assertion failure or a
broker outage. Pull request #228 is the bounded shared-cache correction:
serial Tectonic warmup, one local Bazel action at a time, and one local test
action at a time inside the ARC runner container. Run `29352692909`
proved the first memory split too restrictive: the pod survived, but Bazel's
1024 MiB heap reached 5,854 of 5,858 actions and then threw a Java heap OOM.
Run `29357986080` reproduced the Bazel-heap failure at 1536 MiB while the live
runner remained below 3.6 GiB RSS. The corrected head assigns 2560 MiB to Bazel
and 1024 MiB to its one serialized Node action, and restarts the Bazel server
between workflow phases so retained analysis state cannot accumulate across
the entire job. Capacity run `29359644809` then passed every phase in 45m22s;
the complete runner pod peaked at 6,640 MiB and fell below 1 GiB after Bazel
shutdown. Exact-head run `29362660354` passed every required check on commit
`7a4cfcd`, including the initial substrate attachment, four phase-local
credential refreshes, and all 330 Playwright cases. Pull request #228 merged
that head as commit `a97ce361`. Its trusted-`main` run `29364671782` then
passed hosted build, substrate-boundary, and the complete remote gate on the
merge commit, exercising the separate cache-write path through check, test,
and e2e. The scheduled production-health workflow remained green on the prior
base commit, including run `29347653781`. Merge, deployment, production
health, and whole-repository CI remain independent signals.

## Ratified Decisions

The following decisions have durable evidence:

- **Hybrid ActivityPub gate (TIN-2511):** `admin.federation.deliver` is the
  ratified product authorization gate. Token and allowlist checks remain a
  safety rail. This is policy truth, not current runtime wiring: TIN-2680
  records that `canDeliverPulseFederation` still has no production call site,
  so the live worker remains handle-allowlist-gated.
- **Tinyland user authority (TIN-2788):** Option A, the sanctioned admin-user
  record/bootstrap path, was selected. Merging the bootstrap source did not
  execute the attended runtime bootstrap.
- **Blog editorial taxonomy:** Pulse, noteworthy, and less-noteworthy are
  reader and display strata. They are not auth, privacy, or delivery gates.
- **Blog architecture:** Tinyland content can project into the static blog;
  the blog remains a reader/spoke rather than a durable write or ActivityPub
  authority.
- **Pulse M1 boundary:** the completed milestone covers scaffold, static or
  broker projection, and shadow behavior. It explicitly does not prove public
  federation.

The following were not ratified or not completed:

- **TIN-2648 ActivityPub key custody:** the decision packet recommends a
  hardened split, but remains in progress and unratified. Pull request #702 is
  a draft decision packet, not an implemented custody system.
- **Public Fediverse delivery:** no live evidence demonstrates a signed post
  reaching a real remote follower.
- **TIN-2731 key rotation:** normalized SPKI SHA-256 comparison found pull
  request #719's proposed public key
  (`5f9279a949939b0e7b53bf28f1520191875258714deffd0a71523b58d84d48ac`)
  differs from the live actor key
  (`cd4a49fe889ffa997ec0100a8bfa3cbeebefd815c131c4c1550af25fb5b53737`).
  The audit did not inspect private material, and the recorded session-only
  scratch custody could not be verified. Hold the rotation until matching
  private custody and an atomic cutover are established.

## Critical Contradiction Ledger

| Prior claim or shorthand | Current evidence | Disposition |
| --- | --- | --- |
| "The blog is federated" | Blog and Pulse feeds are display projections. Blog and AP demo manifests report public delivery disabled; Pulse exposes no delivery-policy field. | Use "broker projection" unless remote signed delivery is proven. |
| "The blog is the AP authority" | The blog has no delivery or durable-write authority. Its static WebFinger file points at the hub but is not resource-aware. | False. |
| "Workflow completed" means the product goal completed | Historical workflows include errored, blocked, and plan-only lanes. | Treat workflow status as orchestration status only. |
| A merged package fix is live | Content and invitation fixes were released, but mothership pins and deployment lagged. | Track release, adoption, deploy, and live proof separately. |
| TIN-2787 Done means the note route works | Current live requests terminate without the former 307 loop, but still return `Author not found` or `User not found`. | Keep TIN-2787 Done narrowly; route availability remains TIN-2788. |
| TIN-2786 blog detail is fixed in production | Package source/release exists; the live mothership detail URL is 404. | Live-incomplete. |
| TIN-2788 bootstrap merged means the user exists | Pull request #720 merged; the attended bootstrap was not run. | Runtime-incomplete. |
| TIN-2648 Option B is ratified | Linear is in progress; #702 says merge would be the ratification event. | False. |
| TIN-1119's Done state proves public ActivityPub delivery | Its acceptance explicitly leaves live peer delivery, follower custody, moderation, and operator proof open. On 2026-07-14 it was returned to Done only as a superseded planning record, with a banner stating that its acceptance was not met. | False. TIN-2416 is the sole urgent proof gate. |
| Tailnet-valued `ORIGIN` / `PUBLIC_BASE_URL` prove AP identity drift | AP builders use the separate `TINYLAND_FEDERATION_ORIGIN` contract, and the live actor advertises hub-only IDs. The confirmed public defect is stale `stonewallunderground.com` output from `tinyland.dev`'s static sitemap and robots files. | Narrowed under TIN-2874; do not block the AP proof on an unobserved identity failure. |
| Pull request #719 is ready to merge | Its normalized public-key fingerprint differs from live, and matching private custody was not verifiable from the recorded session-only handoff. | Unsafe. Prove durable matching custody and an atomic cutover; generate a new pair if that proof cannot be recovered. |
| Pull request #701 is the package-adoption keystone | Pull request #731 supersedes its package pins; only the shared rate-limit-store slice remains unique. | Extract or re-author the unique slice on the current base. Do not merge stale pins. |
| Pulse M1 completion means federation shipped | The milestone explicitly excludes real delivery. | False. |
| GitHub Pages is production | Cloudflare Pages is production; this audit corrects the stale README diagram while preserving GitHub Pages as rollback. | False. Keep the diagram, runbook, and declared DNS posture aligned. |
| tinyland.dev issue #664 proves current broker drift | The 140 published spoke slugs and 140 live broker slugs now match exactly. | Closed the one-shot alarm as resolved; a new drift needs new evidence. |
| Runner cancellation proves a code failure | Several heavy jobs ended through ARC pod loss after prior steps passed. | Classify each run from job and step evidence before rerunning or debugging. |
| The blog WebFinger route is a valid fixed single-user resolver | It ignores the required `resource` parameter, returns Jess for missing and foreign resources, and cannot vary by query while prerendered. RFC 7033 requires 400 for an absent or malformed resource and 404 for an unknown resource. | False. TIN-2880 tracks a query-aware fail-closed edge handler or removal of the advertised discovery surface. |
| #217 streams both live broker feeds | Its shadow route uses posts plus the checked Pulse snapshot. | Keep "shadow blended reader" wording; remove "live-streamed ingestion." |

## Pull Request Disposition

### Blog

- **#228:** merged after exact-head CI proved the bounded shared-cache contract
  and all browser tests. Its separate trusted-`main` run passed and is the
  cache-write proof; the pull-request run alone did not exercise that path.
- **#217:** remains a shadow-only tiered reader and blended stream experiment.
  All required checks on head `bc08910b1` are green, but its pull-request body
  still says not to merge and its live inputs still lack reviewed tier/salience
  values. Green CI is not product promotion. Keep it shadow-only and do not
  describe it as production federation.
- **#216:** merged at `0907bb6e` on 2026-07-14. Main now carries the
  node-backend shadow-spoke scaffold, but merge is not runtime promotion and
  does not make the blog an ActivityPub or Tinyland write authority.
- **#224 and #225:** separate content/ops lanes, not federation completion
  evidence. #224 remains open; #225 merged at `084ca03b` on 2026-07-14.
- **#140 and #72:** stale drafts. Review for unique value before closing.
- **#75:** closed, superseded ActivityPub-shaped Pulse viewer. It never had
  inbox processing, signatures, followers, delivery, or live fetch. Do not
  revive it as evidence that federation was implemented.
- **#208:** merged and then reverted by #211 because the apex proxy was the
  wrong architecture. Canceled tickets derived from that path do not count as
  progress.

### Mothership And Packages

- **tinyland.dev #731:** current adoption candidate, but security-held by
  atomic bootstrap (TIN-2821/TIN-2828/TIN-2829), fail-closed RBAC (TIN-2822),
  invitation principal binding, visibility fail-close (TIN-2651/TIN-2656),
  and consumer-containment work. It must also be rebuilt for the planned auth
  0.8 and invitation 0.3 contracts. Its green CI is necessary but not
  sufficient.
- **tinyland.dev #701:** package adoption is superseded by #731. Preserve only
  the unique shared rate-limit-store work and rebase it independently.
- **tinyland.dev #719:** hold. The proposed public-key fingerprint differs from
  live, and the audit could not verify matching private custody from the
  session-only handoff. No private key was read during this comparison.
- **tinyland.dev #721:** draft digest-safe staging deploy work. Treat it as
  image/deploy durability, not federation completion.
- **tinyland.dev #737 and #738:** draft citation and proof-runbook work for
  TIN-2416. #737 head `c251074f1` now emits TIN-2416 as the sole current gate,
  while TIN-1119 remains solely as dated history or roster provenance. #738
  head `6dc94a6` now hashes normalized SPKI DER, closing that earlier review
  finding, but the runbook is still not executable: the advertised inbox
  reaches the generic handler rather than the follower-store/moderation proof
  plane, its routing decision is unimplemented, TIN-2801 remains frozen, and
  key convergence is still gated. Neither draft is merged behavior or a
  completed live signed-peer proof.
- **tinyland.dev #702 / TIN-2648:** decision packet only; no ratification or
  live custody implementation.
- **tinyland-auth #41 and #42, tinyland-invitation #12 and #14:** draft
  security prerequisites for the adoption wave.
- **tinyland-auth #36:** draft productization documentation, not runtime work.

## Federation Tracker Disposition

- **tinyland.dev #93:** closed as not planned on 2026-07-14 because Linear now
  owns the program. This is tracker supersession, not product completion; its
  closing comment's TIN-1119 Done wording is true only for tracker disposition,
  not for the issue's unmet acceptance criteria.
- **tinyland.dev #100:** Reply, Like, and Boost controls remain disabled across
  several current-main surfaces. The issue is still reproducible.
- **tinyland.dev #116:** also closed as not planned in favor of Linear
  TIN-1429/TIN-2416. Its own closing record says the external Mastodon follow,
  moderation/Accept decision, follower state, and proof packet remain open.
- **TIN-1119:** Done only as a superseded planning record. Its description now
  explicitly says the live-delivery acceptance was not met and points at
  TIN-2416 as the sole execution gate.
- **TIN-2416:** the newer urgent delivery issue correctly keeps public
  delivery disabled pending a live signed-peer proof.
- **AP Federation Phase 1:** off track for its 2026-07-15 target. The project
  has seven Backlog issues, including TIN-2883 for the newly confirmed stale
  worker manifest/test contract. No replacement date was invented during this
  audit.
- **TIN-2644 and TIN-2645:** both remain urgent Backlog. The delivery,
  moderation, and follower-Accept plane is still hardcoded to `jesssullivan`;
  a second author cannot complete a live Follow/Accept/delivery round trip.
- **TIN-2680:** remains Backlog. The ratified role axis exists as a predicate
  but is not called by the production worker path.

## Package Snapshot

The Bazel registry contains these newer entries:

- `tinyland-auth` 0.7.1
- `tinyland-invitation` 0.2.5
- `tinyland-content` 0.3.2
- `tinyland-content-types` 0.3.1
- `tinyland-security` 0.3.2
- `tinyland-activitypub` 0.3.1

These are versioned, checksum-pinned Bazel-registry entries. They are not yet
an end-to-end immutability proof: TIN-2485's append-only registry guard remains
Backlog and TIN-2783's immutable GitHub Release enforcement remains In
Progress. The entries also do not imply successful publication through every
other channel:

- Invitation 0.2.5 failed its npm and GitHub Packages publication jobs.
- Content 0.3.2 failed clean-tag validation on undeclared first-party imports,
  so its package publication was skipped.
- Auth 0.7.1 completed its GitHub publish workflow but was not present on
  npmjs during this audit.

A fresh public npmjs query found these package heads: auth 0.3.3, invitation
0.2.2, content 0.2.3, content-types 0.2.4, security 0.3.1, and ActivityPub
0.2.5. None matches the corresponding Bazel-registry head listed above.
"Released" therefore needs a named channel; a registry promotion is not an
npm publication.

The available GitHub credential lacks `read:packages`, so direct GitHub
Packages enumeration was not available. Workflow results and npmjs checks set
the claim boundary above.

At audit time, `tinyland-activitypub` had source on its default branch, a
published GitHub Release `v0.3.1`, a Bazel-registry 0.3.1 entry, and a 0.3.1
pin on mothership `main`. The registry marks 0.2.2 through 0.2.5 yanked because
they defaulted actor and object origins to the apex. That named-channel chain
still does not prove deployment or live delivery; public npm remained at
0.2.5. Mothership still pinned older versions for the other adoption wave:
content 0.2.5, content-types 0.2.4, auth 0.6.0, invitation 0.2.3, and security
0.3.1.

## Linear Reconciliation

- The Mothership Beta/Prod initiative is the active implementation umbrella
  and remains at risk.
- The ActivityPub federation and RBE initiative combines three independent
  axes: outbound delivery, streaming/display product, and RBE/spoke CI.
  Progress on any one must not be used as completion evidence for another.
- Each of those initiatives has a completed duplicate parking record with a
  near-identical name. The canonical Mothership initiative is
  `d3995f72-f1a4-415d-818c-cde93df767d3`; the canonical AP/RBE initiative is
  `28bd82da-48b0-41a4-bfcb-73e7d668a077`. Do not attach work to the completed
  duplicates or read their completion as program completion.
- Presence and Narrative is an umbrella. Current execution has moved to the
  Mothership project.
- Pulse Lifecycle MVP is completed only at the M1/M1.5 projection and shadow
  boundary.
- Databaseless Auth is marked complete for the historical package MVP. Current
  production adoption belongs to the Mothership initiative.
- TIN-2649 is a duplicate of TIN-2716.
- TIN-2647 and TIN-2716 remain adoption/onboarding work.
- TIN-2731 remains in progress.
- TIN-2780 and TIN-2781 prove package source/release work, not mothership
  adoption.
- TIN-2784 proves a source fix, not a live signed-Accept interop result.
- TIN-2786 remains live-incomplete. TIN-2787 is correctly Done only for the
  redirect loop; TIN-2788 owns the remaining live user/author-resolution 404.
- TIN-1119 is Done only as a superseded tracker with unmet acceptance.
  TIN-2416 is the current urgent live-proof issue and remains In Progress.
- TIN-2644/TIN-2645 and TIN-2680 remain open, so neither multi-author delivery
  nor the ratified role axis is live-complete.
- TIN-2822 and TIN-2828/TIN-2829 block the current adoption program with
  fail-closed role translation and tenant-atomic bootstrap work. TIN-2651
  separately keeps second-author visibility behind a fail-closed content gate.

Linear issues in this area do not use release associations. Release and
deployment truth currently live in prose and attachments, which makes status
conflation easier.

## Prompt Queue Reconciliation

`prompts-enqueue` is a prompt library, not product or runtime authority. Its
own operator notes say prompt completion does not prove product completion.

| Prompt | Current use | Disposition |
| --- | --- | --- |
| 02 | Draft auth/identity work | Rebaseline before dispatch; version and blocker facts are stale. |
| 09 | Internal OTEL federation | Keep separate from ActivityPub; the word "federation" means telemetry aggregation here. |
| 10 | Historical mothership/federation program | Done and superseded by 67; preserve as history, do not dispatch. |
| 13 | Blog/Pulse spoke work | Architecture boundary is useful, but deployment and WebFinger details are stale. Rebaseline. |
| 48 | Draft workstream | Not dispatch-ready. |
| 51 | Read-side editorial projection | The read projection landed; the editor-to-PR write seam and live deploy remain planned/operator-gated. It is not outbound federation. |
| 67 | Running composite sprint | Rebaseline against current package versions, security holds, and live deployment before further dispatch. |

The local `prompts-enqueue` checkout was behind its remote default branch
during this audit. Remote GitHub content was used for the current snapshot.

## Shadow And Discovery Caveats

- The blog WebFinger endpoint returns the same Jess JRD without inspecting the
  requested `resource`. This is not merely a single-user limitation: it fails
  RFC 7033's required 400 response for a missing or malformed resource and 404
  response for an unknown resource. The static route needs a query-aware edge
  replacement or removal under TIN-2880 before the blog can claim valid
  WebFinger discovery.
- Pull request #217's shadow `/stream` prerenders from posts plus the checked
  Pulse snapshot. It does not fetch both live broker endpoints. "Live-streamed
  ingestion" is therefore too strong.
- The #217 pull-request event remains build-only. The current shadow deploy is
  driven by pushes to the held branch. The pull-request description's
  non-draft deployment explanation does not match the workflow trigger.
- Pulse `salience` and blog `editorial_tier` affect display ordering only.
  During this audit the live blog posts and six live Pulse items were untiered.

## Worktree And Branch Disposition

The audit-owned `/private/tmp/blog-gf-cache-reconcile` worktree was removed
after #228 merged, its checkout was clean, and its exact HEAD matched the
merged pull-request head. No branch was deleted. No operator-owned or unrelated
agent worktree was modified.

Active and meaningful:

- `docs/content-federation-truth-20260714` for this audit (#226).
- `shadow-ui` for blog #217.
- `ws5-node-shadow` for open, operator-gated blog #216.
- `footer-fix` for draft blog #140.
- `blog-chore` for open blog #225 and `kvm-post` for open blog #224. These
  are independently owned content/ops lanes, not federation cleanup residue.

Worktree presence is not pull-request authority. The `blog-chore` and
`kvm-post` checkouts track `origin/main` instead of their actual remote
branches; both actual branches are two commits ahead of the local checkout.
`ws5-node-shadow` correctly tracks its remote branch but is also two commits
behind. Those independently owned lanes were reported, not rewritten.

Retired or prunable after one final unique-commit check:

- Missing `/private/tmp/blog-frontdoor`, whose pull request #218 merged.
- `gates-retry` and `gates-serial`, whose pull requests #221 and #219 merged.
- `gates-fix`, whose pull request #227 merged, and `gates-mem`, whose pull
  request #229 closed after its unique safeguard was folded into #228. They
  remain untouched pending an owner-side final unique-commit check.
- Historical `worktree-wf_*` branches that are already ancestors of `main`
  and have no remote pull request.
- Merged-PR residue under several `codex/*`, `docs/*`, `feat/*`, `fix/*`,
  `infra/*`, `jess/fix-*`, and `posts/*` branches.

Operator classification required before cleanup:

- `.claude/worktrees/agent-a20e1e149a90f570d` was inspected only because the
  user explicitly requested a worktree audit. It remains agent-owned and is
  neither classified nor authorized for cleanup here.
- `docs/apex-cf-pages-cutover-runbook`, `jess/activitypub-pulse-draft`,
  `jess/vite8-native`, and `week-notes-indeterminism-spring`, which retain
  unique commits despite supersession or retirement.
- `shadow-deploy/m1-foundation` and the TIN-596 branch, which have unique
  unmerged commits and no current pull request.

The unrelated untracked `workers/dns-guard/package-lock.json` was not touched.

Branch retention is structural as well as historical. Automatic branch
deletion after merge is disabled across the audited repositories. No exact
duplicate branch tips were found; cleanup should use ancestry and pull-request
disposition rather than branch age alone.

## Repository Inventory

| Repository | Open PRs | Open issues | Branches |
| --- | ---: | ---: | ---: |
| `jesssullivan.github.io` | 7 | 1 | 30 |
| `tinyland.dev` | 25 | 37 | 122 |
| `tinyland-auth` | 3 | 0 | 14 |
| `tinyland-invitation` | 6 | 0 | 9 |
| `tinyland-content` | 0 | 1 | 6 |
| `tinyland-content-types` | 0 | 0 | 5 |
| `tinyland-security` | 4 | 0 | 8 |
| `tinyland-activitypub` | 0 | 0 | 4 |
| `bazel-registry` | 4 | 1 | 30 |

These counts are a point-in-time inventory, not progress metrics. Open and
retained branches include explicit supersessions, security-held drafts, and
merged work whose branch was never automatically deleted.

## Immediate Corrections

1. Hold #719. Prove durable private custody matching the proposed public key
   and prepare an atomic live/public-key cutover. Generate a new pair only if
   that matching custody cannot be recovered.
2. Correct TIN-2731 and TIN-2648 language so unratified custody work cannot be
   read as complete.
3. Keep TIN-2787 narrowly scoped to the resolved redirect loop; track the live
   user/author-resolution 404 under TIN-2788.
4. Keep #731 draft until its security prerequisite pull requests and consumer
   containment checks are satisfied.
5. Extract #701's unique rate-limit-store slice onto the current package base;
   do not land its stale package-adoption diff.
6. Rebaseline prompts 02, 13, and 67 before another orchestration wave.
7. Keep the corrected README deployment diagram aligned with Cloudflare Pages
   production and GitHub Pages rollback. The generated, ignored search index
   was regenerated and matched the live 140-post set; it is not a committed
   fixture and needs no source change.
8. Keep the exact 140-to-140 slug parity proof attached to closed issue #664;
   require a fresh alarm and delta before reopening drift work.
9. Add deployed commit/image identity to the relevant health surface so
   source-complete and live-complete cannot be confused.
10. Add explicit source/release/adopt/deploy/runtime/live fields to the
    Mothership acceptance records rather than encoding the chain in comments.

## Known Audit Gap

The available GitHub credential can read repositories and workflows but lacks
the `read:project` scope. GitHub Projects v2 could not be inspected. No auth
scope was changed during this audit. Project-board claims should remain
unverified until that read scope is available.
