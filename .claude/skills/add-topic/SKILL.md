---
name: add-topic
description: Add a new topic markdown file to an existing section in this til repo, or rewrite an existing topic to the catalog standard (including merging two topics or moving one between sections), with an independent review against the Writing Standard before it's considered done. Use when the user asks to add a topic, write up a til entry, add an entry about some subject to an existing section, or rewrite, merge or move catalog topics to the catalog standard (one topic or a batch) — not for adding a brand-new section (that's a registry.ts change; follow the "Adding a new section" steps in docs/content.md, or use /feature if it should get full review), not for a DSA entry under src/dsa/ (that's add-dsa-entry), and not for anything touching app code.
---

# Add a topic

A new topic file is the most common change in this repo, and the least
code-shaped: prose held to the
[Writing Standard](../../../docs/writing-standard.md) (its "Catalog topics"
section sets the budget, voice, closing rule of thumb and title) and the
frontmatter contract in [docs/content.md](../../../docs/content.md), drafted
directly and then reviewed by a fresh agent. The review stages, and why content
gets this lighter process, are in
[docs/content-review.md](../../../docs/content-review.md).

## Stage 0 — Scope check

This skill is for a topic file in an **existing** section only. If the
request also needs a new section (a `registry.ts` change), a change to
`content.ts`/`frontmatter.ts`, or any other app code, stop — that's a
`/feature`-shaped change (or, if it's genuinely just the 3-step "Adding a
new section" process in docs/content.md with no ambiguity, just do that
directly). Don't stretch this skill to cover code changes.

**Rewrite mode.** Rewriting an existing topic to the catalog standard also
follows this skill, with the same stages. Treat the old text as research notes,
not a draft to trim: keep what's true and teaches the idea, and rebuild it
around one running example. The topic keeps its file and slug, and the rewrite
removes its entry from `PENDING` in `src/content/topic-structure.test.ts` in
the same change (docs/content.md, "The catalog standard and its rollout"). A
merge folds one topic into another and deletes the old file; a move changes a
topic's section or slug. Both follow docs/content.md's "Moving, merging or
renaming a topic" (`git mv`, repointed links, a `REDIRECTS` entry).

## Stage 1 — Draft the topic

Write the file yourself, directly — drafting prose has no adversarial bias
to guard against (the same reasoning `docs/SDLC.md` gives for keeping spec-writing
with the orchestrating session), so there's no reason to burn a subagent on
a first draft. Follow the contract in docs/content.md ("Content architecture") and
docs/writing-standard.md exactly:

- File at `src/content/<section-slug>/<topic-slug>.md`, slug kebab-case,
  matching an existing section folder.
- Frontmatter: `title` (the title pattern in the Writing Standard's "Catalog
  topics"), one-sentence `summary` (the scannable hook, not a summary of the
  body), `date` (today; a rewrite keeps the original date).
- Body: define terms before using them, build up from first principles,
  carry one concrete running example, and write it so a reader with zero
  prior background on the subject can actually follow it. End with the
  `**Rule of thumb.**` paragraph.
- **Budget**: run `npx vitest run src/content/topic-structure.test.ts` rather
  than estimating: it fails, naming the count, when the prose is over budget,
  and also checks the title and the rule-of-thumb paragraph.

- **If a System Design case study already leans on the new topic's idea,**
  you may add a link to it there, at the point the case study uses it (a
  link-only edit to `src/system-design/case-studies/<slug>.md`; list it for
  the Stage 3 reviewer). This is optional: case studies have no coverage
  requirement, and a topic needs no case study.
- **Link existing topics to the new one where they already lean on it.** If
  other topics use the new topic's central term without explaining it, link
  that term's first mention in each to the new topic. Keep these edits
  link-only; any other prose change to an existing topic is its own change.
  List them for the Stage 3 reviewer.
- **If the section is `systems-and-infrastructure`, end the topic with a
  `## Where you'll meet this` section**, after the rule-of-thumb paragraph.
  docs/content.md has the convention, the reference systems and the rules;
  `src/content/where-youll-meet-this.test.ts` fails without it. General claims
  only: never how a specific company builds something.

If anything about scope or angle is genuinely ambiguous (which section it
belongs in, how deep to go), ask the user — don't guess on something only
they'd know.

## Stage 2 — Self-check

```bash
npm run verify
```

`content.test.ts`, `registry.test.ts`, `topic-structure.test.ts` (the catalog
standard, and `PENDING` entries that should be gone), `redirects.test.ts` (a
move or merge), `system-design.test.ts` (a dead
link from a case study), `catalog-gaps.test.ts` (which also fails on a dead
link in any topic or case-study body) and `where-youll-meet-this.test.ts` already
catch structural problems (missing frontmatter field, section/registry
mismatch, a systems topic without its closing "Where you'll meet this"
section) — this stage is just confirming
those still pass, not
writing new tests. A topic file
never needs its own test.

## Stages 3–4 — Review and final gate

Follow [docs/content-review.md](../../../docs/content-review.md) with:

- **`<kind>`**: til topic.
- **Existing items**: the other topics in the same section.
- **Files**: the topic in full; the `git diff` of each case study or topic
  Stage 1 linked to it; for a `systems-and-infrastructure` topic, the "Where
  you'll meet this" rules in docs/content.md; in rewrite mode, the old version
  (`git show HEAD:<path>`) of each rewritten or merged topic.
- **`<checklist>`**: (1) each link added from a case study or another topic
  sits where that text uses the concept, and its diff is link-only; (2) the
  closing "Where you'll meet this" section names general kinds of systems
  only, every sentence is true of the generic system, and it doesn't re-teach
  the topic; (3) the Writing Standard's "Catalog topics" section holds: one
  running example carried through, the lecturer voice, a closing rule of
  thumb that follows from the body, and a title in the pattern; (4) in rewrite
  mode, nothing true and needed from the old version (or a merged-away topic)
  was lost, and no claim was made false by compression.
- **Commit**: the topic and its link edits (in rewrite mode, its `PENDING`
  removal and any redirect), with the log row.

## Batch mode

Several topics can be added or rewritten at once. A drafter's Stage 2 is
`npx vitest run src/content src/lib/catalog-gaps.test.ts` and Prettier on its
files. Plan merges and moves before drafting so no two drafters edit the same
file; one drafter owns each merge. The integration step removes the batch's
`PENDING` entries and adds its `REDIRECTS` entries, once for the batch, since
every drafter would otherwise edit those two files. Until then,
`topic-structure.test.ts` fails on a rewritten topic's own `PENDING` entry
("already passes every check"), which is expected and the only failure a
drafter may leave.
