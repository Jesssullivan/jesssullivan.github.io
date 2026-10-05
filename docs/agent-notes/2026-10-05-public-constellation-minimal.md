# Main-based public constellation landing

Authority: user authorized public-data opt-in with unchanged default production;
R-HOOK-CONVERGENCE-20261004, R-N12 advisory worktree finding, R-N13 durability.
Lane 4, existing TIN-2413/TIN-603; media companion TIN-2414. No tracker write.

Parent: `930233d5f356a84c0c3ea6f9fa8562c24ac95e24`, exact live blog main read
on 2026-10-05. Carrier `candidate/public-constellation-minimal-20261005`.
Original signed 0911ae2, 418e602, 4fe09e7 and their worktrees remain preserved.
No merge/cherry-pick of the broad 0911ae2 implementation is in this landing.

Selected source only: fail-closed preference helper, ReaderConstellation with
existing archive/year-tree and PulseFeed reuse, experimental routeability
model, isolated unit/browser tests, and gated homepage integration. No new
graph engine. Homepage load, Markdown/SVX renderer/sanitizer, redirect map,
locks, profile, sidebar, actor, provider and workflow surfaces remain main.

Default SSR and browser with no preference emit no experimental DOM and start
no added homepage broker requests. `?flags=constellation` opts in to public
broker/Pulse GETs and persists locally; `?flags=none` clears and disables. The
URL-reactive effect handles same-route SvelteKit navigation, aborts old loads,
rejects late responses, clears experimental state and starts only enabled loads.
Public broker results affect experimental nodes only, never default sections.
Held/broker-only dead links are filtered in both experimental static fallback
and broker success. No private network probes, cookies or authentication gates.

Root's sole heavy owner must resolve the locked DOMPurify 3.4.16 graph before
compiled/browser qualification; prior 3.4.13 diagnostics do not qualify this.
Run repo-managed Bazelisk check/test/e2e on this exact source. Added browser
tests cover absent default, explicit on, year tree, actual same-route off with
same-document sentinel, cleared preference, no added off requests and no-JS.
Whitespace and selected source invariance checks are source proof only.

Production recipe: root coordinates exact-source push/review/merge, canonical
CI and private-CV proof, then normal typed exact-current-main publication with
the live publication switch. Do not bypass workflow contracts. Validate normal
production separately from `https://transscendsurvival.org/?flags=constellation`
and `/?flags=none` in fresh browser contexts, recording served evidence and
source SHA separately. Shadow checks cannot stand in for production proof.

Public Pulse returned one observed 503 around 2026-10-05 21:04 UTC. No default
production repair is authorized by this landing. Worktree creation's linked
tree-count advisory was recorded; no existing tree/session was removed or
signalled. Builds, installs, browsers, pushes and deploys were not run by this
source worker and remain root-coordinated.
