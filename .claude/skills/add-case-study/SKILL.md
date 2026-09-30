---
name: add-case-study
description: Add a new System Design case study (a "design X" write-up under src/system-design/case-studies/, with its D2 diagrams) to this til repo, with an independent review against the Writing Standard and a case-study checklist before it's considered done. Use when the user asks to add, write or draft a System Design case study ("design a news feed", "a chat app case study", "add the next case study") — not for a catalog topic under src/content/ (that's add-topic), not for editing an existing case study's prose quality (content-audit), and not for changes to the case-study page, loader or diagram tooling (that's app code: /feature).
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
[docs/SDLC.md](../../../docs/SDLC.md) for why content gets this lighter
process.

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

## Stage 3 — Independent review

Spawn a **fresh** `general-purpose` agent (never `fork`: it must not inherit
your own read of the draft). Give it: the case study's full content; the full
content of each of its `.d2` sources (and the paths of the rendered SVGs, if
it can view images); `docs/writing-standard.md`; the path of
`docs/NON_NEGOTIABLES.md`; the titles and slugs of the existing case studies
(for a near-duplicate check); and this instruction, close to verbatim:

> Review this new System Design case study adversarially against the
> Writing Standard below and the case-study checklist after it; assume
> nothing about it is fine until you've checked it yourself. Read
> docs/NON_NEGOTIABLES.md first; a violation of any line there is always a
> real finding. Writing Standard: are terms defined before they're used,
> would a reader with zero prior background follow it, does it use concrete
> worked examples rather than staying abstract, is the frontmatter `summary`
> one scannable sentence, does the prose read as something a knowledgeable
> person wrote rather than generically AI-patterned, is any figurative
> phrase over-explained, and is every substantive technical claim actually
> true rather than confidently stated. Case-study checklist: (1) recompute
> every estimate yourself, line by line, and flag any arithmetic error or
> any figure that doesn't follow from the stated requirements or a stated
> assumption; (2) check that each deep dive compares at least two options
> and says what each costs, and flag one that just picks an answer; (3)
> check that every diagram matches the prose (same components, same
> connections, same names) and flag any disagreement; (4) check that every
> catalog link sits where the concept is actually used, and that the case
> study doesn't re-teach a linked topic's mechanism; (5) flag any claim
> about how a specific named company builds its system; (6) check the
> `At a glance` section against the body: every figure in it must match the
> body exactly, each decision and follow-up must be what the body argues
> (not a new claim), each in-page link must point to the section that
> actually covers it, and it must stay about 250–400 words. Also check it isn't
> a near-duplicate of an existing case study (listed below). For each finding, quote the text, or name a realistic trigger (for app
> behavior, real inputs or content; for a guard or check, an edit an author
> following docs/content.md or docs/case-studies.md could plausibly make, or a
> shape a doc says the check covers); label anything else "theoretical".
> Re-raise a decision listed below as already made only with new evidence. Do not edit any file; review only. Report findings ranked by severity, quoting the
> text and saying what's wrong and what's true, or say explicitly that you
> found nothing worth flagging.

- No findings, or only cosmetic ones → done, go to Stage 4.
- Real findings → finding triage, then fix. Confirm each against the files yourself
  (a finding about code or a check goes to a fresh agent), and give it one of
  `/feature` Stage 4's outcomes; record each Reject and Known limitation with
  a one-line reason in the handoff, and give the re-review that list. A Reject
  must quote the text or source that disproves the finding. Fix the rest
  yourself (re-render with `npm run diagrams` if a diagram changed), then
  re-run this stage with a new fresh agent on the updated files. **Cap at 2 rounds**, matching `add-topic` and `/feature`'s
  fix loops. If findings persist after the second round, stop and surface
  them to the user rather than continuing to iterate alone.

## Stage 4 — Final gate

Re-run `npm run verify` on the final version and confirm it's green. Confirm
`git status --porcelain -- src/content` prints nothing (a case study never
edits or adds a catalog topic; unlike a diff, this also shows untracked files
and ignores changes already committed on the branch). Summarize the case study and the review outcome for the
user. Append a row for this run to
[docs/pipeline-log.md](../../../docs/pipeline-log.md) (its header defines the
columns; Retro is `n/a`, since this skill has no retrospective stage; Gate
failures counts failed `verify` runs), then run
`npx prettier --write docs/pipeline-log.md` and `npm run check:pipeline-log`.
The row goes in the case study's commit, together with the `.md`, the `.d2`
sources, the rendered SVGs and `public/diagrams/manifest.json`. Ask before
committing or pushing: this skill leaves the working tree ready, it doesn't
ship it.
