# Public-data constellation opt-in carrier

Authority: user authorized public-data-only opt-in, unchanged default production;
R-HOOK-CONVERGENCE-20261004, R-N12 advisory worktree finding, R-N13 durability.
Lane 4; existing TIN-2413/TIN-603 and media companion TIN-2414. No tracker writes.

Carrier: `candidate/public-data-constellation-20261005`, based on signed preserved
`0911ae2adebfb0b29e75395e6c145e167e797658`, whose parent is production main
`930233d5f356a84c0c3ea6f9fa8562c24ac95e24`. Originals remain unchanged.

The previous source receipt's unsigned/uncommitted description predates the
signed 0911ae2 commit. Its qualification limits still apply: installed sanitizer
was 3.4.13 although source and locks pin 3.4.16. New qualification must resolve
the actual pinned graph; this source change does not claim that proof.

## Behavior contract

- Homepage loader and default Latest/Pulse/Archive return to exact main behavior.
- Experiment SSR is absent. onMount resolves the fail-closed helper; only an
  enabled result starts public broker/Pulse GETs. No private-network probe,
  authentication signal, actor traffic, or permission prompt is added.
- `/?flags=constellation` enables and remembers the public UI; `/?flags=none`
  removes its preference and disables it. An absent flag with no preference is
  off. Private data is never present in this public bundle.
- Public hydration affects experimental nodes only, not the default sections.
  Abort is bounded to ten seconds and component cleanup cancels requests.
- Routeable/held filtering uses the existing homeProjection helper. Tree uses
  existing archive/year grouping. No second graph engine or duplicated tag
  generator is introduced; sidebar tag SVG remains untouched.
- Full reviewed Pulse details and media reuse PulseFeed. Markdown/SVX guards,
  allowlisted components, security pins and projection ownership are preserved.

## Qualification and flagged publication recipe

1. Root's sole heavy owner installs/resolves repo-managed locked dependencies
   and verifies actual DOMPurify 3.4.16 before compiled/type/browser claims.
2. Run normal repo Bazelisk check/test/e2e targets on the exact integrated SHA,
   including flag unit tests, updated document-root off/on/none/year-tree tests,
   Markdown/SVX regressions, and qualified paired acceptance when available.
3. Confirm default/no-JS emits zero experiment nodes and adds zero homepage
   broker/Pulse requests. Confirm explicit on renders routeable public nodes,
   stored-on resumes, none disables, and unavailable public endpoints keep
   reviewed static fallback. Browser proof is still required, not source grep.
4. Root coordinates push/review/merge. Production publisher accepts only an
   exact current-main SHA, canonical CI and private-CV proof, typed dispatch and
   the live publication switch. This note does not bypass those contracts.
5. After authorized publication, inspect normal production homepage separately
   from `https://transscendsurvival.org/?flags=constellation`; test none/off in
   a fresh browser context and verify loaded public data/media. Shadows do not
   substitute for production. Report source SHA and serving evidence separately.

Public Pulse returned 503 in the read-only audit on 2026-10-05 around 21:04 UTC.
That is a single observation, not authorization for an unflagged repair.

Worktree creation reported >3 linked trees. Explicit isolated-carrier authority
and R-N12 allowed creation; no existing tree/session was removed or signalled.
Source whitespace validation passed. Builds, installs, browser checks, remote
CI, push and publication remain root-coordinated and are not claimed here.
