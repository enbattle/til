# System Design case studies

How case studies and their diagrams are stored, structured, linked and
checked. Read this before adding or changing a case study or its diagrams;
[CLAUDE.md](../CLAUDE.md) routes here, and the `add-case-study` skill follows it.

The header has three tabs: **Catalog** (the topics in [content.md](content.md)),
**System Design**, a numbered list of worked design case studies ("Design a
URL Shortener (like TinyURL)"), and **DSA** ([dsa.md](dsa.md)). Each case study takes a product through the standard
interview approach in about five minutes of reading and links into the catalog
wherever it uses a topic; it never holds a copy of a topic.

```
src/system-design/
  case-studies/<slug>.md              # one case study
  diagrams/<slug>/<name>.d2           # its diagrams' D2 sources
public/diagrams/
  <slug>/<name>.light.svg, .dark.svg  # rendered by `npm run diagrams`
  manifest.json                       # tokens + source/SVG hashes + sizes (the lock file)
```

Case studies live outside `src/content/` on purpose: everything under
`src/content/` is a catalog section, and `registry.test.ts` requires one
registry entry per folder there. They have their own loader
(`src/lib/system-design.ts`) and are not registered in `SECTIONS`. Like topics,
frontmatter is eager (`?meta`) and the body is its own lazy chunk
(`loadCaseStudyBody`, through the same `createBodyStore`); the prose word count
is eager too (the build-time `?words` view, `proseWordCount` in
`src/lib/markdown.mjs`), so the page's "N min read" label (`readingMinutes` in
`src/lib/reading-time.ts`, at the reading speed in the
[Writing Standard](writing-standard.md#case-studies-and-dsa-entries)) shows
before the body loads, on every case study.
Frontmatter is the usual flat `key: value`, with one more required field,
`order`:

```md
---
title: Design a URL Shortener (like TinyURL)
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
order: 1
---
```

- **`order`** is a positive integer, unique across case studies; they are
  listed, numbered and linked prev/next in ascending `order`. `parseCaseStudy`
  throws at load time, naming the file and field, if any of the four fields is
  missing or `order` isn't a positive integer.
- **These four keys and no others.** `case-study-structure.test.ts` fails a
  case study whose frontmatter has any other key, or lacks one of the four,
  naming the file and the key.
- **A case study is a five-minute read.** The whole page is the summary a
  reader takes into an interview, with enough reasoning under each decision to
  defend it and to guess well at a question it never asked. It meets the
  Writing Standard's "Case studies and DSA entries" section: within the
  [word budget](writing-standard.md#case-studies-and-dsa-entries) (diagrams and
  code don't count), one rejected alternative per
  decision, and the voice of a good lecturer. Depth beyond that lives in the
  catalog topics it links.
- **The template is enforced.** An intro of two to four sentences (the
  interview question and what makes it interesting) comes before the first
  heading. The body's `##` headings are then exactly, in order:
  - `Requirements`: one list of 4–6 bullets, saying what it does (optional
    features marked), with the non-functional targets as numbers (scale, a
    latency percentile, availability), and one sentence on what's out of
    scope (a sentence, not a second list).
  - `Key numbers`: opens with a sentence saying what the numbers size (the
    requests the servers answer, the data the database holds, the memory a
    cache needs), so a reader knows where each one lands. Then 4–5 figures,
    each with a bold lead naming the part it sizes, the colon inside the bold
    (`**Reads:**`, not `**Reads**:`), and its one-line derivation from a requirement or a
    stated assumption. Round sensibly and say so.
  - `High-level architecture`: at least one diagram with alt text, such as
    `![alt](/diagrams/<slug>/<name>.svg)` (the test reads the rendered page, so
    the reference style counts too), then one paragraph that follows a request
    through it.
  - `API and data model`: the two or three endpoints and the main table or
    record, with a sentence on the choice in them that matters (the key, the
    index).
  - Exactly three `Decision: <topic>` headings, each about 100–150 words:
    the choice, why in this design's numbers, the alternative a reader would
    suggest and why it loses here, and a last paragraph opening with
    `**Rule of thumb.**` that states the general rule.
  - `Likely follow-ups`: a list of 4–6 interviewer questions, each in bold,
    with a one- or two-sentence answer.

  `src/system-design/case-study-structure.test.ts` checks: a paragraph before
  the first `##`; the headings; `Requirements` as exactly one list of 4–6
  top-level items; `Key numbers` as a paragraph, then one list of 4–5
  top-level items each opening with bold text that begins with a label and a
  colon; each decision ending with a `**Rule of thumb.**` paragraph with text
  after the label; `Likely follow-ups` as one list of 4–6 items each opening
  with bold; the diagram; and the word budget (`proseWordCount` in
  `src/lib/markdown.mjs`: the body's prose, outside code blocks, image alt
  text, raw HTML and reference definitions). An in-page link,
  `[text](#heading-id)`, uses the id the heading renders with (`headingId` in
  `src/lib/headings.ts`: "Decision: the read path" is
  `#decision-the-read-path`), and the test fails one that resolves to no `#` or
  `##` heading (a `###` heading has no id). The renderer keeps a `#…` link in
  the same tab. The page builds its "On this page" list from these headings,
  parsed with the renderer's own markdown stack and heading-id pass
  (`h2Headings` in `src/lib/headings.ts`), so keep them plain text. The URL
  shortener (`url-shortener.md`) is the reference
  example to copy.

- **Links are the data.** A case study's catalog links are extracted at build
  time (the `?links` query, running `extractTopicRefs` from
  `src/lib/markdown.mjs`), and the page's "Go deeper" list and each
  topic page's "Used in these case studies:" list come from them, so there's
  nothing to keep in sync by hand. Link a topic where the prose uses it, as
  `[text](/<section>/<slug>)`; there is no requirement to cover every topic.
  `src/lib/system-design.test.ts` fails on a link to a topic or case study
  that doesn't exist. The extractor parses the body with the site's own
  markdown stack, so it counts exactly the links the page renders: inline or
  reference-style (`[text][ref]` plus `[ref]: /section/slug`), with any title.
  A link inside code (inline, fenced or indented) isn't a link and doesn't
  count. The destination must be exactly `/section/slug` (a `#fragment` is
  fine); a trailing slash drops it from those lists.
- **Diagrams are D2, rendered at build time.** Write one diagram per file at
  `src/system-design/diagrams/<slug>/<name>.d2` (lowercase kebab-case, one
  folder deep; both diagram scripts reject anything else), run `npm run diagrams`
  (it needs d2 v0.9.x; install commands in [verification.md](verification.md)), and
  reference it in markdown as
  `![Alt text describing what the diagram shows](/diagrams/<slug>/<name>.svg)`.
  The renderer picks the `.light` or `.dark` file for the current theme, sizes
  it and links it full size (on a phone it keeps a readable minimum size and
  scrolls sideways in its own box). A `.d2` file names no colors: the render
  script derives the D2 theme from the `--color-*` tokens in `src/index.css`
  (and checks text contrast on every fill); `check:diagrams` rejects a `.d2`
  that sets `fill`, `stroke`, `font-color` or a theme by any syntax or uses a
  hex color as a value (`"#ff0000"`, e.g. in `vars`); a `#` inside a label,
  such as `"Issue #123"`, or in a comment is fine. A `.d2` can't import another file (`...@x`,
  `x: @../y`): the imported file would escape the source hash and the color
  guard, so both `check:diagrams` and `npm run diagrams` reject it. Changing a `--color-*` token the
  diagrams use means re-running `npm run diagrams` too. Size a diagram by the add-case-study checklist (item 4: nodes and participants). The
  content column is about 720 px and a diagram is never scaled below 0.75, so
  every rendered SVG stays at or below 960 px wide, target ~950
  (`check:diagrams` fails a wider width in `manifest.json`; the limit is
  `MAX_WIDTH` in `scripts/check-diagrams.mjs`). Lay it out to fit the column
  (`direction: down` usually fits better than `right`), use
  `shape: sequence_diagram` for a request flow, and look at the rendered SVG
  in both themes before committing. Commit the source, both SVGs and
  `manifest.json` together; `npm run check:diagrams` (in `verify`) fails if
  they disagree.
- Use the `add-case-study` skill to write one; see
  [`.claude/skills/add-case-study/SKILL.md`](../.claude/skills/add-case-study/SKILL.md).
