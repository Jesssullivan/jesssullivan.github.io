# Repository Operator Notes

These rules apply before the writing-style guidance below.

## Production DNS, Cloudflare, And Secrets

- Read [docs/runbooks/dns-cutover-and-rollback.md](docs/runbooks/dns-cutover-and-rollback.md) before changing DNS, Cloudflare Pages custom domains, redirects, or production-health checks.
- Do not mutate production DNS from ad hoc shell snippets. The repo uses a declare-then-verify loop: edit `infra/cloudflare/zone.json` in review, apply the matching live change deliberately, then run the read-only drift and production-health checks.
- Never request or use a Cloudflare Global API Key for this repo. Cloudflare documents Global API Keys as legacy, full-permission user credentials. Use least-privilege API tokens with `Authorization: Bearer ...`.
- Never run broad secret decrypts such as `sops -d`, `sops --decrypt`, or `sops ... | grep`. Extract exactly one secret by path with `sops --extract`, assign it to an environment variable without echoing it, and unset it after use.
- Never print token values, API keys, certificates, cookies, or full authorization headers. Logs may include key names, API endpoint paths, status codes, object IDs, and Cloudflare Ray IDs only.
- If a secret value is exposed in a transcript, stop production changes and rotate that credential before continuing. Update SOPS and CI secrets only after rotation.
- Do not change tests to match a broken live state. If `npm run test:production-health` is red, either fix live DNS/serving to match the declared posture or update the declared posture in review before changing assertions.
- Current repo contract (post-2026-06-23 cut): apex and `www` serve Cloudflare Pages via proxied `CNAME` records to `transscendsurvival-org.pages.dev` (production). GitHub Pages is retained through `static/CNAME` only as an explicitly manual, disabled-by-default rollback target, not a CI/CD or normal `www` path.

## Repo Shape And Authority

- This repo builds `transscendsurvival.org`, a static SvelteKit blog with mdsvex, Shiki, Mermaid rendering, image optimization, Pagefind, Tinyland snapshots, and public Tinyland broker hydration.
- Production serving authority is Cloudflare Pages for `https://transscendsurvival.org` and `https://www.transscendsurvival.org`. GitHub Pages is only the explicitly manual rollback target, not the normal production route or a continuously updated mirror.
- Content authority is split deliberately. Canonical authoring and reviewed display data live in Tinyland; checked-in `src/posts`, snapshots, and generated data are first-paint, no-JS, rollback, and regression fixtures.
- Blog and Pulse broker streams are display/projection contracts only. Do not treat them as public Fediverse delivery, and do not weaken broker hydration tests just because prerendered fallback still paints.
- `static/cv` is synced from the private `spear_resumes` repository. Preserve that boundary and use the existing sync/test path instead of hand-editing generated resume artifacts.

## Cross-Repo Delivery Ownership

The current delivery and authority surfaces are enumerated against canonical CI
and the v2 workflow set. Credentialed lanes fail closed on their own scoped
contracts, not one universal trigger shape: production and rollback bind an
exact current-`main` SHA; shadow publication binds an exact live-PR SHA; cache
purge binds one canonical non-root production path and carries no source SHA;
private-CV verification accepts an exact current-`main` push or typed dispatch
and has no kill switch; production health may use ntfy credentials for failure
alerts or an operator-requested smoke, but cannot mutate serving state. The
publication, rollback, shadow-publish, and purge switches default false and are
re-read immediately before their credentialed mutation.

| Surface | Workflow | Trigger class | Kill switch |
|---|---|---|---|
| CI proof (check/test/e2e authority) | `.github/workflows/ci.yml` | push to `main`/`dev` + same-repo PR | none; read-only proof consumed by the exact-source production and rollback lanes |
| Post date validation | `.github/workflows/validate-blog-dates.yml` | same-repo PR to `main` touching `src/posts/**` | none; secretless read-only proof with no serving-state authority |
| Production publish (Cloudflare Pages) | `.github/workflows/cloudflare-pages-production-v2.yml` | dispatch-gated (`cloudflare-pages-production-v2`, `deploy=true`, exact current-`main` SHA proven by canonical CI + private-CV authority); its `workflow_run` lane from CI is build-only | repo var `CLOUDFLARE_PAGES_PRODUCTION_ENABLED` (default false), revalidated immediately before publish |
| TSS shadow publish (Cloudflare Pages, `tss.tinyland.dev`) | `.github/workflows/tss-shadow-publish-v2.yml` | dispatch-gated (`tss-shadow-publish-v2`, `deploy=true`, exact current-`main` SHA or open same-repo PR head proven by canonical CI incl. `bazel-remote-gates`); publishes the site-wide-noindex shadow build to the dedicated TSS Pages project only (production project name is rejected) | repo vars `BLOG_TSS_PUBLISH_ENABLED` (default false, revalidated immediately before publish) + `CLOUDFLARE_PAGES_TSS_PROJECT_NAME` (required; `CLOUDFLARE_PAGES_TSS_BRANCH` optional, default `main`) |
| Exact-PR parity build | `.github/workflows/cloudflare-pages-parity-v2.yml` | dispatch-gated (`cloudflare-pages-parity-v2`), build-only against an exact open same-repo PR head | none needed; `permissions: {}`, secretless, no deploy step |
| Cache purge (one production URL) | `.github/workflows/cloudflare-cache-purge-v2.yml` | dispatch-gated (`cloudflare-cache-purge-v2`), one canonical non-root path per run; path-only, with no source SHA | repo var `CLOUDFLARE_CACHE_PURGE_ENABLED`, revalidated immediately before credential use |
| Rollback (GitHub Pages) | `.github/workflows/github-pages-rollback-v2.yml` | dispatch-gated (`github-pages-rollback-v2` + `confirm_rollback=true`, exact current-`main` SHA with successful canonical CI) | repo var `BLOG_GITHUB_PAGES_ROLLBACK_ENABLED` (default false) + `github-pages` environment, revalidated at publish time |
| Shadow source build | `.github/workflows/shadow-source-build-v2.yml` | dispatch-gated (`shadow-source-build-v2`), unprivileged build of an exact open same-repo PR head | none needed; `permissions: {}`, cannot publish packages, mint App tokens, or dispatch infrastructure |
| Shadow source publish (GHCR) | `.github/workflows/shadow-source-publish-v2.yml` | `workflow_run` consumer of `Build shadow source v2`; runs default-branch code only and independently revalidates provenance, never executing PR code | repo var `BLOG_SHADOW_SOURCE_PUBLISH_ENABLED` (default false), revalidated at package-write time |
| Private CV consistency | `.github/workflows/private-cv-authority-v2.yml` | exact current-`main` push + typed dispatch (`private-cv-verify-v2`) | none; credentialed verify-only lane that never commits or publishes, and is itself a required proof for production publish |
| Production health monitor | `.github/workflows/production-health-v2.yml` | cron health check every 30 minutes (ntfy alert on failure) + typed dispatch (`production-health-v2`, optional ntfy smoke) | none; notification credentials carry no serving-state mutation authority, and a red scheduled run is production evidence |

- This repo owns blog source, the static build, shadow source-image
  publication to `ghcr.io/jesssullivan/jesssullivan-github-io-shadow-tailnet`,
  and the production Cloudflare Pages contract for the
  `transscendsurvival-org` project.
- `Jesssullivan/jesssullivan-infra` owns the private tailnet acceptance
  environment. Shadow apply is unavailable from this repo in the v2 world: no
  v2 workflow carries a GitHub App key, private sender, or cross-repo dispatch
  call, and publishing a shadow source digest transfers no apply authority.
- `tinyland-inc/GloriousFlywheel` supplies runner, Nix/toolchain, Bazel
  cache/RBE, and validation substrate. Passing GF checks or running on GF
  runners transfers no application deployment ownership.
- `tinyland-inc/tinyland.dev` owns the mothership content, broker, and
  federation contracts this spoke consumes.
- The `substrate-boundary` job in `.github/workflows/ci.yml` enforces that
  code surfaces reach the blahaj substrate only through the named,
  provenance-carrying interfaces in
  `config/substrate-boundary-allowlist.json`.
- Never infer application ownership from the cluster hosting a pod, the repo
  escrowing a credential, or the runner executing a build. Ownership follows
  this register.

## Build, Test, And Deploy

- Normal local development is npm/SvelteKit: `npm ci`, `npm run build`, `npm run lint`, and focused scripts from `package.json`.
- Production behavior changes require `npm run test:production-health`. That check covers public DNS, apex/`www` HTTPS, canonical redirects, slash variants, Tinyland broker contract, and browser hydration.
- CI has two lanes. `build-and-test` runs hosted checks such as gitleaks, production dependency audit, lint, npm build, bundle reporting, and Lighthouse. `bazel-remote-gates` is the check/test/e2e authority.
- Credentialed Cloudflare publication comes only from the default-branch-owned `.github/workflows/cloudflare-pages-production-v2.yml`; it publishes only on the exact typed repository-dispatch request for a current `main` SHA proven by canonical CI and private-CV consistency, plus the live kill switch. Exact-PR parity is secretless in `.github/workflows/cloudflare-pages-parity-v2.yml`. Review-shadow PR code builds without package or secret authority in `.github/workflows/shadow-source-build-v2.yml`; the default-branch `.github/workflows/shadow-source-publish-v2.yml` independently revalidates provenance before any package write. Shadow apply is unavailable: no v2 workflow carries an App key, private sender, or dispatch call. GitHub Pages is not CI/CD: `.github/workflows/github-pages-rollback-v2.yml` is a disabled-by-default, exact-main, explicitly confirmed repository-dispatch rollback path only.
- `.github/workflows/production-health-v2.yml` runs every 30 minutes and sends ntfy alerts on failure. Treat a red scheduled monitor as production evidence, not noise.
- Hosted-runner exception, recorded 2026-08-28: the v2 workflow estate pins `runs-on: ubuntu-latest` at 17 sites. That is a recorded exception to TIN-3914 (no `ubuntu-latest` since `ci-templates` v3.0.0), not compliance with it. Closing it means adopting `spoke-ci.yml@v3.1.0` in the week of 2026-09-01, which first needs a `jesssullivan-blog-nix` ARS in `Jesssullivan/jesssullivan-infra` plus a governed apply, `tinyland.repo.json`, and `.github/lanes.json`. Do not hand-migrate individual `runs-on` lines ahead of that adoption. (Count as of 2026-08-28 before the TSS shadow lane; the invariant is that a GitHub-hosted label is used only where no self-hosted pool serves that job class — assert it, do not re-count by hand.)

## Bazel And GloriousFlywheel

- GloriousFlywheel-backed validation runs through `scripts/bazel-cache-backed.sh`. This repository is registered as `shared-cache-backed`; the remote scripts must fail closed when `BAZEL_REMOTE_CACHE` or that expected substrate mode is missing. CI must clear generic-runner executor hints. Executor-backed mode remains an explicit opt-in only after a reviewed GloriousFlywheel consumer-registry promotion.
- `npm run remote:check`, `npm run remote:test`, and `npm run remote:e2e` retain the full developer/private-CV graph. PR CI uses the corresponding `:public` commands with `--ignore_dev_dependency`; private CV consistency runs separately from default-owned `.github/workflows/private-cv-authority-v2.yml`. Public GF checks still mint a signed tenant-scoped cache-read credential through OIDC; they are not credential-free, but server policy denies PR cache write and execution.
- `package-lock.json` is the npm authority. `pnpm-lock.yaml` is the generated `rules_js` lock consumed by Bazel; do not casually hand-edit it.
- Shared-cache CI provisions the package-lock-pinned Playwright Chromium outside Bazel actions and passes its absolute path explicitly. Browser-backed RBE uses the pinned worker Chromium path; do not add lifecycle downloads or host-local browser assumptions inside the RBE action path.
- Broad `bazel query //...` and `bazel test //...` must not traverse agent scratch trees. `.bazelignore` intentionally excludes `.claude`, `.gstack`, `.worktrees`, build outputs, caches, and `workers/dns-guard/.wrangler`.
- If you touch Bazel structure, scratch-tree ignores, or broad query behavior, run `npm run test:bazel-graph-hygiene` and, when possible, `bazelisk --output_user_root=/tmp/jess-ghio-bazel-codex test //:bazel_graph_hygiene`.

## Agent Scratch And Worktrees

- Do not inspect, index, or modify `.claude/`, `.gstack/`, or `.worktrees/` unless the user explicitly asks. They may contain nested checkouts, generated plans, local MCP state, or other agent artifacts that are not part of this repo's source graph.
- Keep scratch outputs out of commits. If a tool creates local state, either leave it ignored or clean only the files you created and understand.
- Before committing, check `git status --short` and stage only the files for the current task. This repo often has user-authored draft posts or worker artifacts in flight.

# Writing Style Guide: Jess Sullivan

This guide captures the voice and lexical patterns of jesssullivan.github.io blog posts. Use it when writing, editing, or reviewing blog content to match the author's established style.

---

## Core Identity

An enthusiastic, self-deprecating maker-hacker-naturalist who gets genuinely excited about things and doesn't hide it. Technical depth wrapped in warmth and humor. Never postures as an expert -- always presents as a curious person who happened to figure something out.

---

## Sentence Rhythm ("The Lilting Quality")

The signature is **wildly uneven sentence length**. Short declarative punches alternate with long, clause-laden, parenthetical sprawls. This asymmetry IS the style.

### DO

- Alternate between very short (1-5 word) and very long (30-50 word) sentences
- Use single-word or single-phrase sentences for emphasis: "Great horned owls." or "Food. Clothes. Art."
- Let long sentences accumulate clauses, dashes, and parentheticals before snapping back to brevity
- End sections with a short, satisfied declaration

### DON'T

- Write sequences of uniformly medium-length sentences
- Let every sentence be grammatically complete and balanced
- Smooth out the rhythm -- the unevenness IS the style

### Example

> NVMe drives. These things are everywhere- in your laptop, your USB enclosure, that sketchy Amazon no-name SSD you bought for $30 (we've all done it). And apparently, they can just... decide to stop accepting writes. No errors. No warnings. Just quietly dropping your data on the floor like a cat pushing a glass off a table.

---

## Punctuation

### Dashes as Thought-Interrupts (Heavy Use)

The primary connective tissue. Not semicolons. Not colons. Dashes.

- **Mid-sentence interrupts:** "the drive was fine- or so I thought"
- **Tangent launchers:** "I had a great friend a few years back- nicest fellow in town."
- **Emphatic breaks:** "this is the definitive quarterback of frisbee for crying out loud-"

### Leading Ellipsis (Signature Device)

Used as a **launch pad** into the next idea, not for trailing off:

- "...So then I tried wipefs"
- "...And that's when things got weird"
- "...So I am building a CNC mill"

### Parenthetical Asides (Frequent)

Create intimacy -- the author whispering to the reader:

- Self-deprecation: "(this cost me half a day to figure out, and I am not proud of it)"
- Definitions for beginners: "(computer numerical control=does stuff by itself)"
- Wry commentary: "(obviously)"
- Quick corrections: "(if there even is an environment that welcomes oversized killing machines...?)"

### Avoid

- Semicolons (the author almost never uses them)
- Colons for introducing lists in prose (use dashes instead)
- Purely informational parentheticals -- they should have personality

---

## Vocabulary

### Use

- **"lil"** instead of "little" in casual contexts
- **Self-deprecating qualifiers:** "sorta," "kinda," "dubious," "questionable"
- **Casual intensifiers:** "superduper," "super," "enormous"
- **Exclamations:** "for crying out loud," "huzzah!"
- **Mixed register:** formal technical jargon and casual slang in the same sentence
- **Playful compounds and neologisms** when they fit

### Avoid

- Formal academic connectors: "Furthermore," "Moreover," "It is worth noting that"
- Passive voice when active voice carries personality
- "utilize" (use "use")
- "significant" (use "huge" or "enormous")
- "This is critically important to understand" (say "Ok so this is the big one-")
- "In this post, we will discuss..."

---

## Openings

Pick one of these patterns:

1. **Scene-with-surprise:** Start with what you were doing, pivot to the unexpected. This is the strongest pattern: "I was doing routine cleanup on a Lenovo Yoga laptop..." or "I'd been running molecule tests against Windows targets for months at this point-"
2. **Casual entrance:** "Letsee...." or "So here's the thing-"
3. **Self-deprecating pitch:** "A questionable experiment in firmware hacking that somehow worked."
4. **Fragment splash (use sparingly):** "NVMe drives. USB bridges. Silent failures." — these work when they're organic and few (2-3 words each). They do NOT work when they feel like a headline pitch: "Ansible. Windows Server 2022. Molecule." is too blunt and forced. The fragments should feel like the author settling into a topic, not presenting bullet points.

Never open with formal thesis statements, definitions, or "In this post, we will..."

---

## Titles

Titles should feel like discoveries, not headlines. They should intrigue rather than announce.

### DO

- Technical and specific but with a narrative hook: "WinRM Quotas, Hidden Plugin Layers, and Why PSRP Has Been the Answer Since 2018"
- Discovery framing: "From Bricked to Recovered: The Story of Hacking an NVMe SSD Back to Life"
- Question or observation: "Aperture and the Tagged-Device Identity Gap"

### DON'T

- Blunt imperative headlines: "How Ansible Molecule Locks You Out of Active Directory"
- Clickbait patterns: "You Won't Believe What WinRM Does to Your AD Account"
- Colon-heavy report titles: "WinRM Forkbomb: A Comprehensive Analysis of Connection Exhaustion"

---

## Person and Narration

**Always first person singular.** Even collaborative work is narrated as "I"- "I was running tests," "I found this," "I stumbled onto." The author is always the narrator, always present in the story.

Never "we" unless referring to a named team or organization in a specific context. The default is always "I."

---

## Closings

- End with a brief, warm sign-off
- Include **"-Jess"** at the very end
- Optionally a smiley or a brief summary sentence

Never end with "In conclusion" or a formal summary paragraph.

---

## Technical Explanation Pattern

### DO

- Introduce concepts through narrative: "When I first tried this, I got back..."
- Provide definitions as parenthetical asides, not lead-in paragraphs
- Frame failures as discoveries: "That was suspicious. A real NVMe format takes minutes, not milliseconds."
- Show your confusion before your understanding: "I sat there for a long moment."
- Be specific about what failed and how long it took: "This part cost me half a day."

### DON'T

- Start sections with textbook definitions
- Present knowledge as if you always had it
- Remove the discovery narrative from reference material
- Write as if from a position of authority -- write as if sharing what you found

---

## The Energy Arc

Within each section or post, energy should:

1. **Start casual/fragmentary** -- short punchy sentences, scene setting
2. **Build through accumulation** -- longer sentences, more dashes and parentheticals, stacking details
3. **Peak at a discovery or insight** -- emphatic, possibly bold, exclamation marks permitted
4. **Drop to a brief resolution** -- short sentence, satisfied tone

This arc repeats at both the paragraph level and the post level. Each section has its own mini-lilt. The whole post has an overall lilt.

---

## What Makes It Sound Like Jess

- Personal stakes: "I needed to wipe it and repurpose it"
- Time investment honesty: "Each dead end cost a day or more"
- Delight in discovery: "I was reading the bridge chip's brain"
- Hardware affection: treating devices as having personality
- Community acknowledgment: crediting other people's work enthusiastically
- The "yak shaving" philosophy: embracing that one project leads to fifteen others

## What Makes It NOT Sound Like Jess

- Uniform sentence length
- Passive voice throughout
- No humor or self-deprecation
- Opening with definitions
- Formal academic transitions ("Furthermore," "Moreover")
- No dashes or ellipsis
- No "-Jess" sign-off
- Treating technical content as separate from personal narrative

---

## Reference Posts (Voice Calibration)

### Gold standard: The NVMe Recovery Post (2026-03-04)

`src/posts/2026-03-04-from-bricked-to-recovered-the-story-of-hacking-an-nvme-ssd-back-to-life.md` is the author's mature voice at its peak. 784 lines that never feel rambly because every section earns its place in the narrative arc. Key patterns to replicate:

- **Long investigative arc**: six weeks of dead ends, eureka moments, and hard-won understanding -- told chronologically with genuine uncertainty preserved
- **Discovery as structure**: "I blinked, ran it again." → "Unless the disk itself is the liar." → "I sat there for a long moment." The reader discovers alongside the author.
- **Hardware affection and anthropomorphism**: the drive "lies," the bridge has "opinions," commands are "swallowed"
- **Time investment honesty**: "This part cost me half a day." "Each dead end cost a day or more."
- **Mixed register in the same sentence**: formal NVMe spec language next to "like a cat pushing a glass off a table"
- **Technical appendix pattern**: the narrative tells the story, then a clean appendix provides the recipe for practitioners
- **Philosophical cappers**: "Sometimes the obstacle is the path." -- earned by the narrative, not dropped in as decoration

### Good reference: The Aperture Post (2026-02-26)

`src/posts/2026-02-26-aperture-tagged-devices-and-the-tsnet-escape-hatch.md` is a shorter (200-line) problem-discovery-solution arc. Good structural model for medium-length technical posts. Key patterns:

- Light humor for frustration: "This created a fun bootstrapping problem"
- Absurdity played for laughs: "I couldn't even fix the config because the broken config prevented me from accessing the API."
- Numbered takeaway sections
- Mermaid diagrams
- Dashes as thought-interrupts

### Weak reference: The 2019 Chapel Post

`src/posts/2019-02-20-installing-chapel-language-on-mac-and-linux.md` is the old voice -- flat, tutorial-style, README-mirror. Too procedural, no narrative, no personality. Do NOT write like this.

## Anti-Slop Checklist

AI-assisted drafts tend toward specific failure modes. Catch and fix these:

- **"We" when it should be "I"** -- the author is always the narrator, always present. "We" only for named teams in specific contexts.
- **Artificial cliffhangers** -- "But that's for Part 2" or "The solution turned out to be surprisingly elegant." If you have the resolution, deliver it. Withholding is not the same as building tension.
- **Template transitions** -- "Here's what we missed." "Let's dive in." "Setting the scene." These are generic AI connective tissue. Replace with specific, surprising, or punchy alternatives -- or cut them entirely.
- **Uniform sentence length** -- the single fastest tell. If every sentence is 15-25 words, it's wrong. Alternate between 3-word punches and 40-word parenthetical sprawls.
- **Hedging without personality** -- "It's worth noting that" or "It should be mentioned that." Either say it directly or cut it.
- **Overly clean structure** -- real Jess posts have sections that accumulate energy and surprise. If the outline looks like a five-paragraph essay, rethink it.
- **Missing sign-off** -- posts end with `-Jess`. Not optional.

## Voice Evolution

The voice has matured significantly from 2017-2019 (nature observations, tutorial dumps, README mirrors) through 2020-2021 (emerging personality, mixed register) to 2026 (full narrative voice with technical depth). New posts should target the 2026 register -- the NVMe and Aperture posts, the week notes -- not the earlier flat style. The 2026 voice retains the enthusiasm and curiosity of the early posts but wraps it in structure, humor, and genuine investigative narrative.
