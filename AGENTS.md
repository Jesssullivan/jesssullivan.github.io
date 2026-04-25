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
