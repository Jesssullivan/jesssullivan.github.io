# Blog Editorial Taxonomy

Date: 2026-07-03

Status: TIN-2412 contract slice. This is a reader/content contract, not a new
package, new chrome layer, or ActivityPub delivery claim.

## Strata

`pulse`

- Source: Tinyland Pulse public snapshot / broker data.
- Current public kinds: `note` and `bird_sighting`.
- Use for small stream items such as runs, observations, short life updates, and
  public-safe notes.
- Do not write `editorial_tier: pulse` on blog posts. Pulse is not blog
  frontmatter.

`less-noteworthy`

- Source: blog post frontmatter: `editorial_tier: less-noteworthy`.
- Use for recipes, small project release notes, life updates, and posts worth
  showing without presenting them as durable technical publications.
- This does not change `category`, `tags`, `published`, `visibility`, broker
  display membership, or ActivityPub delivery state.

`noteworthy`

- Source: blog post frontmatter: `editorial_tier: noteworthy`.
- Use for long-form essays, reverse-engineering writeups, deep technical
  accomplishments, and durable portfolio/archive pieces.
- Future reader/search work may give these stronger visual treatment or search
  ranking, but the field is not an authorization or publication gate.

## Frontmatter

```yaml
editorial_tier: less-noteworthy
```

Allowed values for blog posts:

- `less-noteworthy`
- `noteworthy`

The field is optional for the legacy archive while migration is in progress.
Missing `editorial_tier` means "not classified yet"; reader work must not infer
private status, Fediverse delivery, or authoring authority from its absence.

`content_stratum` is generated/search metadata. Do not hand-write it in blog
frontmatter.

## Broker Boundary

Tinyland-managed broker posts may carry `editorialTier` in the public display
stream. The TransScend blog maps that into `editorial_tier` and
`content_stratum` on the runtime `Post` shape.

The broker stream remains display/projection only:

- `publicFediverseDelivery` stays `false`;
- private, unlisted, removed, and draft content must not appear;
- `pulse` remains the Pulse snapshot stratum, not a blog post tier.

## Migration Notes

- Existing posts do not need immediate churn.
- Add `editorial_tier: less-noteworthy` first to recipes, weeknotes, small
  release notes, and short update posts.
- Add `editorial_tier: noteworthy` to posts that should receive durable
  long-form treatment in the future reader IA.
- Keep `category` as topical taxonomy (`hardware`, `software`, `personal`, and
  so on). Do not overload it for reader weight.
