# Independent profile v2 consumer review — 2026-09-26

Scope: `jess/profile-v2-map`, Goal 4 implementation in the dedicated blog worktree. Reviewed the applicable AGENTS, implementation record, working diff, consumer schema/loading, map/history components, About preservation, static asset declarations, CSP, and installed accessibility-plugin implementation. This review does not authorize publication. The orchestrator owns the notes index.

## Finding: P2 — valid multiple-PR data breaks the About refresh

`src/lib/profile/ProfileExplorer.svelte:79` keys the embedded upstream list by `item.repo`, although `src/lib/profile/schema.ts:218–220` permits distinct PR numbers from the same repository. The embedded heading promises the latest verified merge by project, but it renders every supplied PR. The full Projects view already handles this correctly through `upstreamHistory` in `src/lib/profile/history.ts`.

Independent reproduction against the existing static build, using local Chrome and a locally served `build/` (no external publication):

1. Read `static/profile/profile.v1.json` and append `{...doc.merged_upstream[0], number: 999999}` to its upstream records. This is synthetic test input only, not a factual claim or an artifact change.
2. `parseProfileV1(doc)` accepts all 16 records.
3. Intercept the exact live endpoint with that JSON and load `/about`.
4. Browser emits `https://svelte.dev/e/each_key_duplicate`; the rendered source remains `saved` and the list retains 15 rows. The valid refresh does not complete cleanly.

Use the existing latest-per-project projection for the embedded list as well, and exercise a schema-valid multiple-PR live response in a browser regression. Merely changing the key would avoid the exception but would leave the latest-per-project promise unfulfilled.

## Other reviewed behavior

- No P0 or P1 found. Existing fallback is schema-validated at import; live data is parsed before adoption; malformed, unavailable, timed-out, and older fetched snapshots retain the displayed evidence. Freshness labels use fetched time rather than confusing it with data-change time.
- CSP adds only the exact intended HTTPS service origin. URL and structural schema validation remain intact. No private repository identifiers or new authored claims were introduced by the consumer rendering code reviewed.
- Filtering uses supplied coordinates without refitting or category-based repositioning. Map methods disclose the shared similarity, dissimilarity, neighborhood union, and limits of the two-dimensional projection. This review did not repeat the prior numerical-engine audit.
- Language history preserves unavailable observations and partial lower bounds; activity distinguishes unknown days from observed zero and boundary days. The upstream full view selects each project's latest merge rather than presenting merge totals as impact.
- Native project/history selectors, keyboard controls, and server-rendered tables provide alternatives to pointer interaction. Existing browser receipts cover both routes at 390/1440 widths in both themes, plus no-JavaScript coverage in the checked-in e2e spec. The only additional browser run here was the focused failing refresh reproduction above.
- About retains its approved identity/roles/ventures, offline-year paragraph, Beyond Code prose, publications, community, owned-image sections, and existing anchors. The new timeline is a copied producer artifact, not browser-generated career geometry.
- Raw JSON imports are parsed at the application boundary and do not bypass the profile schema. Bazel explicitly includes the public profile files needed by these imports; no private source module was added.
- Inspected installed `@tummycrypt/vite-plugin-a11y` transform: its returned code only injects development diagnostic comments. The wrapper still invokes its validation and preserves plugin lifecycle hooks while discarding that code mutation. No corrective accessibility transformation is silently removed by this workaround.

Initial verdict: one reproducible P2 required correction and focused recheck. Existing implementation receipts are evidence of local builds and controlled endpoint responses, not proof that the live profile service has been deployed. No broad build, merge, deployment, or external message was performed by this reviewer.

## Independent repair recheck — 2026-09-26

PASS: the sole P2 above is resolved. `ProfileExplorer.svelte` now derives
`upstreamHistory(profile.merged_upstream).points` and uses its canonical PR
URL. Reviewed the new browser regression, which deliberately supplies three
same-repository records out of chronological order and checks date selection,
one row, live adoption and no page errors. Its static-build receipt passes.
Independently reran the original failing synthetic duplicate-repository
probe against the rebuilt static output: `errors: []`, `source: live`,
`rows: 15`. This closes the concrete schema/consumer mismatch without
weakening the schema or inventing geometry. No unresolved P0/P1/P2 finding
remains from this bounded review; production rollout and Jess's review
remain separate gates.
