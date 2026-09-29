---
name: add-topic
description: Add a new topic markdown file to an existing section in this til repo, with an independent review against the Writing Standard before it's considered done. Use when the user asks to add a topic, write up a til entry, or add an entry about some subject to an existing section — not for adding a brand-new section (that's a registry.ts change; follow the "Adding a new section" steps in docs/content.md, or use /feature if it should get full review) and not for anything touching app code.
---

# Add a topic

A new topic file is the most common change in this repo, and the least
code-shaped: there's no behavior to spec or TDD against, just prose held to
the [Writing Standard](../../../docs/writing-standard.md) and the frontmatter
contract in [docs/content.md](../../../docs/content.md). Running it through the full `/feature` pipeline (spec, TDD,
fresh implementer) would be ceremony with nothing behind it — but skipping
review entirely means the repo's most frequent change gets _less_ scrutiny
than a one-line code fix, which is the gap this skill exists to close. See
[docs/SDLC.md](../../../docs/SDLC.md) for the general reasoning behind
where this repo does and doesn't spend a separate agent.

## Stage 0 — Scope check

This skill is for a topic file in an **existing** section only. If the
request also needs a new section (a `registry.ts` change), a change to
`content.ts`/`frontmatter.ts`, or any other app code, stop — that's a
`/feature`-shaped change (or, if it's genuinely just the 3-step "Adding a
new section" process in docs/content.md with no ambiguity, just do that
directly). Don't stretch this skill to cover code changes.

## Stage 1 — Draft the topic

Write the file yourself, directly — drafting prose has no adversarial bias
to guard against (the same reasoning `docs/SDLC.md` gives for keeping spec-writing
with the orchestrating session), so there's no reason to burn a subagent on
a first draft. Follow the contract in docs/content.md ("Content architecture") and
docs/writing-standard.md exactly:

- File at `src/content/<section-slug>/<topic-slug>.md`, slug kebab-case,
  matching an existing section folder.
- Frontmatter: `title`, one-sentence `summary` (the scannable hook, not a
  summary of the body), `date` (today).
- Body: define terms before using them, build up from first principles,
  use concrete examples over abstract description, and write it so a
  reader with zero prior background on the subject can actually follow it.

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
  `## Where you'll meet this` section.** docs/content.md has the convention, the
  reference systems and the rules; `src/content/where-youll-meet-this.test.ts`
  fails without it. General claims only: never how a specific company builds
  something.

If anything about scope or angle is genuinely ambiguous (which section it
belongs in, how deep to go), ask the user — don't guess on something only
they'd know.

## Stage 2 — Self-check

```bash
npm run verify
```

`content.test.ts`, `registry.test.ts`, `system-design.test.ts` (a dead
link from a case study), `catalog-gaps.test.ts` (which also fails on a dead
link between systems topics) and `where-youll-meet-this.test.ts` already
catch structural problems (missing frontmatter field, section/registry
mismatch, a systems topic without its closing "Where you'll meet this"
section) — this stage is just confirming
those still pass, not
writing new tests. A topic file
never needs its own test.

## Stage 3 — Independent review

Spawn a **fresh** `general-purpose` agent (never `fork` — it must not
inherit your own read of the draft). Give it: the new file's full content,
`docs/writing-standard.md`, the path of
`docs/NON_NEGOTIABLES.md` (a violation there is always a real finding), and
the titles/slugs of the other
topics already in the same section (so it can check for a near-duplicate).
If Stage 1 also added a link from a System Design case study, give it that
paragraph too and have it check that the link sits where the case study
uses the concept.
If the topic is in `systems-and-infrastructure`, also have it check the
closing `## Where you'll meet this` section: general kinds of systems only,
every sentence true of the generic system, and no re-teaching of the topic.
Instruction, close to verbatim:

> Review this new til topic adversarially against the Writing Standard
> below — assume nothing about it is fine until you've checked it
> yourself. Read docs/NON_NEGOTIABLES.md first; a violation of any line
> there is always a real finding. Read docs/writing-standard.md and check
> the topic against every bullet in it, tone, figurative language and
> verified technical claims included. Also check it isn't
> a near-duplicate of an existing topic in this section (listed below). For each finding, quote the text, or name a realistic trigger (for app
> behavior, real inputs or content; for a guard or check, an edit an author
> following docs/content.md or docs/case-studies.md could plausibly make, or a
> shape a doc says the check covers); label anything else "theoretical".
> Re-raise a decision listed below as already made only with new evidence. Do
> not edit the file — review only. Report findings ranked by severity, or
> say explicitly you found nothing worth flagging.

- No findings, or only cosmetic ones → done, go to Stage 4.
- Real findings → finding triage, then fix. Confirm each against the file yourself
  (a finding about code or a check goes to a fresh agent), and give it one of
  `/feature` Stage 4's outcomes; record each Reject and Known limitation with
  a one-line reason in the handoff, and give the re-review that list. A Reject
  must quote the text or source that disproves the finding. Fix the rest
  yourself (no separate fix agent for a content edit), then re-run this
  stage on the updated file. Cap at 2 rounds, matching `/feature`'s
  fix-loop cap — if findings persist after that, stop and surface them to
  the user rather than continuing to iterate alone.

## Stage 4 — Final gate

Re-run the Stage 2 verification suite on the final version, confirm it's
green, and summarize the topic and the review outcome for the user. Append a
row for this run to [docs/pipeline-log.md](../../../docs/pipeline-log.md)
(its header defines the columns; Retro is `n/a`, since this skill has no
retrospective stage; Gate failures counts failed `verify` runs). Then run
`npx prettier --write docs/pipeline-log.md` and `npm run check:pipeline-log`.
The row goes in the topic's commit. Ask
before committing or pushing, same as always — this skill leaves the
working tree ready, it doesn't ship it.
