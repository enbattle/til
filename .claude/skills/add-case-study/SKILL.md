---
name: add-case-study
description: Add a new System Design case study (a "design X" write-up under src/system-design/case-studies/, with its D2 diagrams) to this til repo, with an independent review against the Writing Standard and a case-study checklist before it's considered done. Use when the user asks to add, write or draft a System Design case study ("design a news feed", "a collaborative editor case study", "add the next case study") — not for a catalog topic under src/content/ (that's add-topic), not for editing an existing case study's prose quality (content-audit), and not for changes to the case-study page, loader or diagram tooling (that's app code: /feature).
---

# Add a case study

A case study is content, like a topic, so it gets the same treatment as
[`add-topic`](../add-topic/SKILL.md): no spec or TDD (there's no behavior to
pin down), but an independent review before it's done. It gets its own skill
because it has more ways to be wrong than a topic does: worked estimates whose
arithmetic has to hold, deep dives that have to compare options rather than
announce one, and diagrams that have to agree with the prose. The review below
checks each of those explicitly. See [docs/case-studies.md](../../../docs/case-studies.md) for the file
layout and rules, and
[docs/content-review.md](../../../docs/content-review.md) for the review
stages every content skill shares and why content gets this lighter process.

## Stage 0 — Scope check

This skill adds one case study file plus its diagrams. If the request also
needs a change to the case-study page, the loader, the render or check
scripts, or anything else under `src/` outside
`src/system-design/case-studies/` and `src/system-design/diagrams/`, stop:
that's a `/feature`-shaped change. If it needs a new catalog topic the case
study would link to, write that first with `add-topic` (a case study links to
topics; it doesn't substitute for one). Never edit files under `src/content/`
from this skill.

`npm run diagrams` needs d2 v0.9.x on PATH (`d2 --version`). If it isn't
installed, say so and give the install command docs/verification.md lists; don't commit a
`.d2` source without its rendered SVGs, since `check:diagrams` would fail.

## Stage 1 — Draft the case study and its diagrams

Write it yourself, directly, as `add-topic` does. Read
[checklist.md](checklist.md) before drafting and check the draft against it
before Stage 2: it lists the problems reviews most often find. Read
`src/system-design/case-studies/url-shortener.md` first: it is the reference
example for depth, tone and how estimates are laid out.

- File at `src/system-design/case-studies/<slug>.md`, slug kebab-case.
  Frontmatter: `title` ("Design a <Thing> (like <familiar product>)"),
  a one-sentence `summary`, `date` (today), and `order` (the next free
  positive integer; `ls src/system-design/case-studies/` and read the
  existing orders).
- **Headings and At a glance**: the `##` heading template and the At a glance
  format (lead-ins, item counts, length, in-page links, closing link) are in
  [docs/case-studies.md](../../../docs/case-studies.md) ("The template is
  enforced", "At a glance is a one-screen summary"); `url-shortener.md` shows
  both. Write At a glance last, once the body is final, copying every figure
  from the body rather than recomputing it.
- **Requirements**: functional (what it does, with optional features marked),
  an explicit out-of-scope list, and non-functional targets as numbers
  (scale, latency percentile, availability).
- **Estimates**: worked arithmetic, one step per line, every figure
  following from a stated requirement or a stated assumption. Round
  sensibly and say so. Recompute every line before moving on.
- **Deep dives**: each compares at least two real options, with what each
  costs, then picks one and says why for this design's numbers.
- **Catalog links** go where the prose uses the concept, as
  `[text](/<section>/<slug>)` to a topic that exists
  (`ls src/content/*/`). Don't re-teach a topic's mechanism; say what it buys
  and costs here and link. There's no requirement to link every topic.
- **Claims** describe a plausible design ("like TinyURL"), never how a
  specific company builds its system.
- **Diagrams**: at least one in `High-level architecture`; add a
  `shape: sequence_diagram` diagram where a request flow is the point. One
  diagram per file at `src/system-design/diagrams/<slug>/<name>.d2`, sized by
  checklist.md item 5 (nodes, participants, width), no colors (the theme comes from the tokens), laid out for the
  ~720px content column. Run `npm run diagrams`, then look at the rendered
  `public/diagrams/<slug>/<name>.light.svg` and `.dark.svg` yourself (open
  them in a browser, or screenshot them) at 720px wide: labels readable,
  nothing overlapping, no huge empty areas. Rework the layout until they are.
  Reference each as an inline image,
  `![Alt text describing what the diagram shows](/diagrams/<slug>/<name>.svg)`;
  the alt text says what the diagram shows, since a screen-reader user gets
  only that. The architecture diagram must be written this inline way: the
  structure test only counts an inline image in `High-level architecture`.
  Other diagrams may use reference-style images, which `check:diagrams` also
  resolves.

If scope or angle is genuinely ambiguous (which product to model, what scale
to assume, which deep dives matter most), ask the user rather than guess.

## Stage 2 — Self-check

```bash
npm run verify
```

`case-study-structure.test.ts` (heading template, the At a glance lead-ins,
in-page links that resolve, a diagram in the architecture section),
`system-design.test.ts` (frontmatter, unique `order`,
dead links), `check:diagrams` (sources rendered, SVGs and tokens current,
SVGs safe, no color named and no file imported in a `.d2`, every referenced diagram present) and
`check:bundle` (the body stays out of the main chunk) catch the structural
problems. A case study never needs its own test.

## Stages 3–4 — Review and final gate

Follow [docs/content-review.md](../../../docs/content-review.md) with:

- **`<kind>`**: System Design case study.
- **Existing items**: the case studies in `src/system-design/case-studies/`.
- **Files**: the case study and each of its `.d2` sources, in full (plus the
  paths of the rendered SVGs, if the reviewer can view images).
- **`<checklist>`**: (1) recompute every estimate yourself, line by line,
  and flag any arithmetic error or any figure that doesn't follow from the
  stated requirements or a stated assumption; (2) check that each deep dive
  compares at least two options and says what each costs, and flag one that
  just picks an answer; (3) check that every diagram matches the prose (same
  components, same connections, same names) and flag any disagreement; (4)
  check that every catalog link sits where the concept is actually used, and
  that the case study doesn't re-teach a linked topic's mechanism; (5) flag
  any claim about how a specific named company builds its system; (6) check
  the `At a glance` section against the body: every figure in it must match
  the body exactly, each decision and follow-up must be what the body argues
  (not a new claim), each in-page link must point to the section that
  actually covers it, and it must stay about 250–400 words.
- **Fix step**: re-render with `npm run diagrams` if a diagram changed.
- **Scope check**: `git status --porcelain -- src/content` prints nothing (a
  case study never edits or adds a catalog topic).
- **Commit**: the `.md`, the `.d2` sources, the rendered SVGs and
  `public/diagrams/manifest.json`, with the log row.
- **Batch mode**: each drafter stays within [checklist.md](checklist.md)'s
  length. A drafter's Stage 2 is `npm run diagrams`, `npm run check:diagrams`,
  `npx vitest run src/system-design src/lib/system-design.test.ts`, and
  Prettier on its files. The integration step is `npm run diagrams`, run once for the batch
  ([docs/case-studies.md](../../../docs/case-studies.md) has the file rules).
