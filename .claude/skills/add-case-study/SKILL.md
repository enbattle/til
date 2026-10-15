---
name: add-case-study
description: Add a new System Design case study (a "design X" write-up under src/system-design/case-studies/, with its D2 diagrams) to this til repo, or rewrite an existing one to the case-study template, with an independent review against the Writing Standard and a case-study checklist before it's considered done. Use when the user asks to add, write or draft a System Design case study ("design a news feed", "a collaborative editor case study", "add the next case study") or to rewrite an existing case study ("rewrite the chat case study from scratch") — not for a catalog topic under src/content/ (that's add-topic), not for checking or revising an existing case study's prose quality without rewriting it (content-audit), and not for changes to the case-study page, loader or diagram tooling (that's app code: /feature).
---

# Add a case study

A case study is content, like a topic, so it gets the same treatment as
[`add-topic`](../add-topic/SKILL.md): no spec or TDD (there's no behavior to
pin down), but an independent review before it's done. It gets its own skill
because it has more ways to be wrong than a topic does: worked estimates whose
arithmetic has to hold, decisions that have to say why the obvious alternative
loses rather than announce a choice, a word budget that compression can make
overclaim, and diagrams that have to agree with the prose. The review below
checks each of those explicitly. See [docs/case-studies.md](../../../docs/case-studies.md) for the file
layout and rules, and
[docs/content-review.md](../../../docs/content-review.md) for the review
stages every content skill shares and why content gets this lighter process.

## Stage 0 — Scope check

This skill adds one case study file plus its diagrams, or rewrites an
existing one (rewrite mode, below). If the request also
needs a change to the case-study page, the loader, the render or check
scripts, or anything else under `src/` outside
`src/system-design/case-studies/` and `src/system-design/diagrams/`, stop:
that's a `/feature`-shaped change. If it needs a new catalog topic the case
study would link to, write that first with `add-topic` (a case study links to
topics; it doesn't substitute for one). Never edit files under `src/content/`
from this skill.

`npm run diagrams` needs d2 on PATH and prints install commands if it's
missing or the wrong version. If it isn't installed, say so and pass those on; don't commit a
`.d2` source without its rendered SVGs, since `check:diagrams` would fail.

## Stage 1 — Draft the case study and its diagrams

Write it yourself, directly, as `add-topic` does. Read
[checklist.md](checklist.md) before drafting and check the draft against it
before Stage 2: it lists the problems reviews most often find. Read
`src/system-design/case-studies/social-feed.md` first: it is the template's
reference example for length, voice, the "Start simple" arithmetic and how
key numbers are laid out. Read the Writing
Standard's "Case studies" section too: it sets the budget and
the voice.

- File at `src/system-design/case-studies/<slug>.md`, slug kebab-case.
  Frontmatter: `title` ("Design a <Thing> (like <familiar product>)"),
  a one-sentence `summary`, `date` (today), `order` (the next free
  positive integer; `ls src/system-design/case-studies/` and read the
  existing orders), and no other key.
- **Template**: use the template's `##` headings, with what each section holds,
  in [docs/case-studies.md](../../../docs/case-studies.md) ("The template is
  enforced"); `social-feed.md` shows it. Recompute every key-numbers line
  before moving on.
- **Budget**: draft the decisions first (their length is in docs/case-studies.md), then fit
  the rest around them. Run
  `npx vitest run src/system-design/case-study-structure.test.ts` rather than
  estimating: it fails, naming the count, when the prose is over the word
  budget (docs/writing-standard.md).
- **Catalog links** go where the prose uses the concept, as
  `[text](/<section>/<slug>)` to a topic that exists
  (`ls src/content/*/`). Don't re-teach a topic's mechanism; say what it buys
  and costs here and link. There's no requirement to link every topic.
- **Claims** describe a plausible design ("like TinyURL"), under the Writing
  Standard's "Named companies" rule.
- **Diagrams**: at least one in `High-level architecture`; add a
  `shape: sequence_diagram` diagram where a request flow is the point. One
  diagram per file at `src/system-design/diagrams/<slug>/<name>.d2`, sized by
  checklist.md item 4 (nodes, participants), no colors (the theme comes from the tokens), laid out for the
  content column (width limit in docs/case-studies.md's diagrams rule). Run `npm run diagrams`, then look at the rendered
  `public/diagrams/<slug>/<name>.light.svg` and `.dark.svg` yourself (open
  them in a browser, or screenshot them) at the column's width: labels readable,
  nothing overlapping, no huge empty areas. Rework the layout until they are.
  Reference each as an inline image,
  `![Alt text describing what the diagram shows](/diagrams/<slug>/<name>.svg)`;
  the alt text says what the diagram shows, since a screen-reader user gets
  only that. Reference-style images work too: the structure test and
  `check:diagrams` both resolve them.

**Rewrite mode** (rewriting an existing case study): keep the file, its
slug, its `order` and all its content: every requirement, number, decision,
rejected alternative and follow-up stays. Restructure and rewrite the prose
rather than cut it, and adjust its diagrams only where the new structure
needs it. Stages 2–4 run as for a new page, with review item 8.

If scope or angle is genuinely ambiguous (which product to model, what scale
to assume, which three decisions matter most), ask the user rather than guess.

## Stage 2 — Self-check

```bash
npm run verify
```

`verify` already runs the structural checks
([docs/case-studies.md](../../../docs/case-studies.md) names each one and what it
catches, `check:diagrams` included). A case study never needs its own test.

## Stages 3–4 — Review and final gate

Follow [docs/content-review.md](../../../docs/content-review.md) with:

- **`<kind>`**: System Design case study.
- **Existing items**: the case studies in `src/system-design/case-studies/`.
- **Files**: the case study and each of its `.d2` sources, in full (plus the
  paths of the rendered SVGs, if the reviewer can view images).
- **`<checklist>`**: (1) recompute every estimate yourself, line by line,
  and flag any arithmetic error or any figure that doesn't follow from the
  stated requirements or a stated assumption; (2) check that each decision
  runs simpler option → where it breaks in this design's numbers → the choice
  → its cost → rule of thumb, in about 150–300 words, and that the rule
  follows from it; flag one that leads with its choice or just announces it;
  (3) check the rules no test enforces: the intro states the question, a one-sentence overview and the
  route; "Start simple" shows the simple design working, then breaking on the
  page's numbers; the architecture is the diagram plus two to five short paragraphs with at most two new terms each; Key numbers size only parts the
  reader has met, each derivation written out; follow-ups introduce no new
  concept without a gloss and a catalog link; (4) check that every diagram
  matches the prose (same components, same connections, same names) and flag
  any disagreement; (5) check that every catalog link sits where the concept
  is actually used, and that the case study doesn't re-teach a linked topic's
  mechanism; (6) flag a claim that compression made false (an absolute
  "never", "always" or "exactly" the design doesn't deliver) and a follow-up
  answer the page doesn't support; (7) say whether a reader who finished it
  could defend the three decisions and guess at a question it never asked,
  and name what's missing if not; flag an edge case or exception that spends
  words without changing a decision; (8) in rewrite mode, compare with the old version
  (`git show HEAD:<path>`) and flag any requirement, number, decision,
  rejected alternative or follow-up it dropped.
- **Fix step**: re-render with `npm run diagrams` if a diagram changed.
- **Scope check**: `git status --porcelain -- src/content` prints nothing (a
  case study never edits or adds a catalog topic).
- **Commit**: the `.md`, the `.d2` sources, the rendered SVGs and
  `public/diagrams/manifest.json`, with the log row.
- **Batch mode**: each drafter stays within the word budget
  (docs/writing-standard.md). A drafter's Stage 2 is the self-check in
  docs/content-review.md's "Batch mode", after `npm run diagrams` and
  `npm run check:diagrams`. The integration step is `npm run diagrams`, run once for the batch
  ([docs/case-studies.md](../../../docs/case-studies.md) has the file rules).
