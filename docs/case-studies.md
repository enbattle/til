# System Design case studies

How case studies and their diagrams are stored, structured, linked and
checked. Read this before adding or changing a case study or its diagrams;
[CLAUDE.md](../CLAUDE.md) routes here, and the `add-case-study` skill follows it.

The header has two tabs: **Catalog** (the topics in [content.md](content.md)) and **System
Design**, a numbered list of worked design case studies ("Design a URL
Shortener (like TinyURL)"). Each one takes a product through the standard
approach and links into the catalog wherever it uses a topic; it never holds a
copy of a topic.

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
(`loadCaseStudyBody`, through the same `createBodyStore`). Frontmatter is the
usual flat `key: value`, plus one more required field:

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
- **The template is enforced.** The body's `##` headings are exactly, in
  order: `At a glance`, `Requirements`, `Back-of-the-envelope estimates`,
  `Data model`, `API design`, `High-level architecture`, two or more
  `Deep dive: <topic>`, `Failure modes and bottlenecks`, `Trade-offs`
  (`src/system-design/case-study-structure.test.ts`), and
  `High-level architecture` contains at least one diagram, written as an inline
  image, `![alt](/diagrams/<slug>/<name>.svg)` (the test doesn't count the
  reference style there, though `check:diagrams` resolves it for other
  diagrams). The page builds its Contents
  list from these headings, parsed with the renderer's own markdown stack and
  heading-id pass (`h2Headings` in `src/lib/headings.ts`), so every entry links
  to the id its heading renders with; still, keep them plain text. The URL shortener
  (`url-shortener.md`) is the reference example to copy.
- **At a glance is a one-screen summary.** It comes after the intro and
  before `Requirements`, about 250–400 words, and holds four paragraphs, each
  opening with a bold lead-in and followed by a list, in this order:
  `**Requirements.**` (4–6 bullets with their numbers), `**Key numbers.**`
  (4–5 figures from the estimates, each with its one-line derivation),
  `**Key decisions.**` (exactly 3, each "decision: one-line reason") and
  `**Likely follow-ups.**` (4–6 interviewer questions, each with a
  one-sentence answer). Every decision and follow-up links to the section that
  argues it in full with an in-page link, `[text](#heading-id)`, using the id
  the heading renders with (`headingId` in `src/lib/headings.ts`: "Deep dive:
  the read path" is `#deep-dive-the-read-path`). It doesn't embed the
  architecture diagram; it ends with a standalone paragraph linking to
  `#high-level-architecture`. Every figure in it must match the body. The
  structure test checks that `## At a glance` is the first `##` heading; that
  the four bold lead-ins appear in that order; that every item (nested items
  included) of every list under `Key decisions` and `Likely follow-ups`,
  including a list inside a blockquote, has its own in-page link; that the
  section's last block is a standalone paragraph linking to
  `#high-level-architecture`; and that every in-page link anywhere in the body
  resolves to the id of a `#` or `##` heading as the page renders it (a `###`
  heading has no id, so a link to one fails). The renderer keeps a `#…` link in
  the same tab.
- **Links are the data.** A case study's catalog links are extracted at build
  time (the `?links` query, running `extractTopicRefs` from
  `src/lib/markdown-links.ts`), and the page's "Go deeper" list and each
  topic page's "Used in these case studies:" list come from them, so there's
  nothing to keep in sync by hand. Link a topic where the prose uses it, as
  `[text](/<section>/<slug>)`; there is no requirement to cover every topic.
  `src/lib/system-design.test.ts` fails on a link to a topic or case study
  that doesn't exist. The extractor only counts plain inline links written as
  `[text](/section/slug)` (a double-quoted title after the URL is fine).
  Anything else, such as a single-quoted or parenthesised title, a trailing
  slash, `<...>` around the destination, nested brackets in the text, or the
  reference style, still renders as a working link but is silently dropped
  from those lists. A link inside inline code or a 4-space-indented block is
  counted even though it isn't a real link, so don't put example links there.
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
  hex color as a value (`"#ff0000"`, e.g. in `vars`), and `check:colors`
  rejects the same hex values (a `#` inside a label, such as `"Issue #123"`, or
  in a comment is fine). A `.d2` can't import another file (`...@x`,
  `x: @../y`): the imported file would escape the source hash and the color
  guard, so both `check:diagrams` and `npm run diagrams` reject it. Changing a `--color-*` token the
  diagrams use means re-running `npm run diagrams` too. Size a diagram by the add-case-study checklist (item 5: nodes, participants, width) and lay it out to fit the ~720px
  content column (`direction: down` usually fits better than `right`), use
  `shape: sequence_diagram` for a request flow, and look at the rendered SVG
  in both themes before committing. Commit the source, both SVGs and
  `manifest.json` together; `npm run check:diagrams` (in `verify`) fails if
  they disagree.
- Use the `add-case-study` skill to write one; see
  [`.claude/skills/add-case-study/SKILL.md`](../.claude/skills/add-case-study/SKILL.md).
