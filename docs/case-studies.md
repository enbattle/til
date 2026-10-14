# System Design case studies

How case studies and their diagrams are stored, structured, linked and
checked. Read this before adding or changing a case study or its diagrams;
[CLAUDE.md](../CLAUDE.md) routes here, and the `add-case-study` skill follows it.

The header has two tabs: **Catalog** (the topics in [content.md](content.md))
and **System Design**, a numbered list of worked design case studies ("Design a
URL Shortener (like TinyURL)"). Each case study takes a product through the standard
interview approach in about ten minutes of reading and links into the catalog
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
(`loadCaseStudyBody`, through the same `createBodyStore`; `npm run check:bundle`
fails if a body lands in the main chunk); the prose word count
is eager too (the build-time `?words` view, `proseWordCount` in
`src/lib/markdown.mjs`), so the page's "N min read" label (`readingMinutes` in
`src/lib/reading-time.ts`, at the reading speed in the
[Writing Standard](writing-standard.md#case-studies)) shows
before the body loads, on every case study.
Frontmatter is the usual flat `key: value`, with one more required field,
`order`, and the optional template switch, `template`:

```md
---
title: Design a Social Media Feed (like Instagram)
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
order: 4
template: 3
---
```

- **`order`** is a positive integer, unique across case studies; they are
  listed, numbered and linked prev/next in ascending `order`. `parseCaseStudy`
  throws at load time, naming the file and field, if any of the four fields is
  missing or `order` isn't a positive integer, and `src/lib/system-design.test.ts`
  fails a duplicate `order`.
- **These four keys, `template`, and no others.** `parseCaseStudy` also
  throws at load time on any other key, naming the file and the key
  (`checkFields` in `src/lib/frontmatter.ts`, shared by both loaders), and
  `case-study-structure.test.ts` checks the same allowlist. `template` is
  optional and its only valid value is `3` (the switch below); any other
  value, an empty one included, throws naming the file and `template`. It
  picks the template the structure test checks and is not part of the
  returned metadata.
- **A case study is a ten-minute read.** The whole page is the summary a
  reader takes into an interview, with enough reasoning under each decision to
  defend it and to guess well at a question it never asked. It meets the
  Writing Standard's "Case studies" section: within the
  [word budget](writing-standard.md#case-studies) (diagrams and
  code don't count), one rejected alternative per
  decision, and the voice of a good lecturer. Depth beyond that lives in the
  catalog topics it links.
- **The template is enforced, per page.** A page whose frontmatter has
  `template: 3` follows template 3; a page without the key follows the old
  template, which every page is being moved off ("Migrating (2026-10)" below).
  When the last page is rewritten, a cleanup change removes the switch and
  the old template, as `docs/specs/retire-template-switch.md` did for the
  previous one. Both share the word budget and everything after the
  headings' order below.

  **Template 3** follows the Writing Standard's
  [Teaching progression](writing-standard.md#teaching-progression). Before
  the first heading, an intro states the interview question, a one-sentence
  overview of the design and the route through the page. The body's `##`
  headings are then exactly, in order:
  - `Requirements`: one list of 4–6 bullets, saying what it does (optional
    features marked), with the non-functional targets as numbers (scale, a
    latency percentile, availability), and one sentence on what's out of
    scope (a sentence, not a second list).
  - `Start simple` or `Start simple: <topic>`: the design a reader would
    suggest first, shown working, then breaking on this design's numbers. At
    least one paragraph, and the worked arithmetic in a code block, one
    step per line. It ends on the problem the architecture solves.
  - `High-level architecture`: at least one diagram with alt text, such as
    `![alt](/diagrams/<slug>/<name>.svg)` (the test reads the rendered page, so
    the reference style counts too), then two or three short paragraphs (for
    example the write path, then the read path), each with at most two new
    terms.
  - `Key numbers`: opens with a sentence saying what the numbers size (the
    requests the servers answer, the data the database holds, the memory a
    cache needs), so a reader knows where each one lands. Then 4–5 figures,
    each with a bold lead naming a part the reader has now met, the colon
    inside the bold (`**Reads:**`, not `**Reads**:`), and its derivation from
    a requirement or a stated assumption, written out step by step. Round
    sensibly and say so.
  - `API and data model`: the two or three endpoints and the main table or
    record, with a sentence on the choice in them that matters (the key, the
    index).
  - Exactly three `Decision: <topic>` headings, each about 150–300 words, in
    this order: the simpler option a reader would suggest, where it breaks in
    this design's numbers, the choice, its cost, and a last paragraph opening
    with `**Rule of thumb.**` that states the general rule.
  - `Likely follow-ups`: a list of 4–6 interviewer questions, each in bold,
    with a one- or two-sentence answer. A follow-up introduces no new concept
    without a gloss and a catalog link.

  The social feed (`social-feed.md`) is template 3's reference example to
  copy.

  **The old template** (pages without `template`, being migrated; don't start
  a new page on it): an intro of two to four sentences (the interview
  question and what makes it interesting), then `Requirements`,
  `Key numbers`, `High-level architecture`, `API and data model`, three
  `Decision: <topic>` and `Likely follow-ups`. Its sections hold what
  template 3's do, except: there's no `Start simple`; Key numbers come before
  the architecture, so a figure may name a part with a short gloss and gives
  a one-line derivation; the architecture is one paragraph that follows a
  request through the diagram; and each decision is about 100–150 words: the
  choice, why in this design's numbers, the alternative and why it loses, then
  the rule of thumb. `url-shortener.md` shows it.

  `src/system-design/case-study-structure.test.ts` enforces the templates'
  mechanical parts, not their sentence or word counts per section, or the
  order of ideas within a section (the reviewer checks those): a paragraph
  before the first `##`; the headings of the page's template, in order; on
  template 3, `Start simple` holding at least one paragraph and at least one
  code block; `Requirements` as one list of 4–6
  top-level items; `Key numbers` as a paragraph, then one list of 4–5
  top-level items each opening with a bold `Label:`; each decision ending with
  a `**Rule of thumb.**` paragraph with text after the label; `Likely
follow-ups` as one list of 4–6 items each opening with bold; the diagram;
  and the word budget, counted by `proseWordCount` in
  `src/lib/markdown.mjs`: the body's prose, outside code blocks, image alt
  text, raw HTML and reference definitions. An in-page link,
  `[text](#heading-id)`, uses the id the heading renders with (`headingId` in
  `src/lib/headings.ts`: "Decision: the read path" is
  `#decision-the-read-path`), and the test fails one that resolves to no `#` or
  `##` heading (a `###` heading has no id). The renderer keeps a `#…` link in
  the same tab. The page builds its "On this page" list from these headings,
  parsed with the renderer's own markdown stack and heading-id pass
  (`h2Headings` in `src/lib/headings.ts`), so keep them plain text.

- **Migrating (2026-10).** Pages move to template 3 one at a time, each in
  `add-case-study`'s rewrite mode. To move one: add `template: 3` to its
  frontmatter; restructure it to template 3's headings; rewrite its prose to
  the Teaching progression rules (the route sentence, `Start simple` with its
  arithmetic, the architecture in short paragraphs, every derivation shown,
  each decision from the simpler option to the rule); and keep all its
  content, its slug and its `order`: every requirement, number, decision,
  rejected alternative and follow-up stays. The social feed was the first.

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
