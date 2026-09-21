---
name: add-topic
description: Add a new topic markdown file to an existing section in this til repo, with one independent review pass against CLAUDE.md's Writing Standard before it's considered done. Use when the user asks to add a topic, write up a til entry, or add an entry about some subject to an existing section — not for adding a brand-new section (that's a registry.ts change; follow CLAUDE.md's "Adding a new section" steps, or use /feature if it should get full review) and not for anything touching app code.
---

# Add a topic

A new topic file is the most common change in this repo, and the least
code-shaped: there's no behavior to spec or TDD against, just prose held to
[CLAUDE.md](../../../CLAUDE.md)'s Writing Standard and frontmatter
contract. Running it through the full `/feature` pipeline (spec, TDD,
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
new section" process in CLAUDE.md with no ambiguity, just do that
directly). Don't stretch this skill to cover code changes.

## Stage 1 — Draft the topic

Write the file yourself, directly — drafting prose has no adversarial bias
to guard against (the same reasoning CLAUDE.md gives for keeping spec-writing
with the orchestrating session), so there's no reason to burn a subagent on
a first draft. Follow the contract in CLAUDE.md's "Content architecture"
and "Writing standard" sections exactly:

- File at `src/content/<section-slug>/<topic-slug>.md`, slug kebab-case,
  matching an existing section folder.
- Frontmatter: `title`, one-sentence `summary` (the scannable hook, not a
  summary of the body), `date` (today).
- Body: define terms before using them, build up from first principles,
  use concrete examples over abstract description, and write it so a
  reader with zero prior background on the subject can actually follow it.

- **If the section is `systems-and-infrastructure`, place the topic under a
  System Design question too.** Add a plain
  `[text](/systems-and-infrastructure/<slug>)` link to it, in running prose, in
  the body of the question in `src/system-design/questions/` whose problem it
  helps solve, following CLAUDE.md's "System Design questions" body convention:
  state what the option buys, what it costs and when to pick it there, then
  link, and don't re-explain the topic's mechanism in the question. CLAUDE.md's
  "Links are the data" bullet lists the link forms that aren't counted. If no
  existing question fits, add a new question file with the next free `order`
  instead. `system-design.test.ts`'s coverage check fails the topic until this
  is done. Afterward run `system-design-navigation-eval` (the scenarios that
  touch that question, or the whole set if you added one) to check a reader
  would actually land there. Topics in other sections need no question.
- **If the section is `systems-and-infrastructure`, end the topic with a
  `## Where you'll meet this` section.** CLAUDE.md has the convention, the
  reference systems and the rules; `src/content/where-youll-meet-this.test.ts`
  fails without it. General claims only: never how a specific company builds
  something.

If anything about scope or angle is genuinely ambiguous (which section it
belongs in, which question it goes under, how deep to go), ask the user — don't guess on something only
they'd know.

## Stage 2 — Self-check

```bash
npm run verify
```

`content.test.ts`, `registry.test.ts`, `system-design.test.ts` and
`where-youll-meet-this.test.ts` already catch structural problems (missing
frontmatter field, section/registry mismatch, a `systems-and-infrastructure`
topic no question links, a dead question link, a systems topic without its
closing "Where you'll meet this" section) — this stage is just confirming
those still pass, not
writing new tests. A topic file
never needs its own test.

## Stage 3 — Independent review

Spawn a **fresh** `general-purpose` agent (never `fork` — it must not
inherit your own read of the draft). Give it: the new file's full content,
CLAUDE.md's "Writing standard" section, and the titles/slugs of the other
topics already in the same section (so it can check for a near-duplicate).
If Stage 1 also touched a System Design question, give it that question's
full content too and have it check the added snippet against the Writing
Standard's question-page rule (routes and compares, doesn't re-teach the
mechanism, and no fact is stated in both places).
If the topic is in `systems-and-infrastructure`, also have it check the
closing `## Where you'll meet this` section: general kinds of systems only,
every sentence true of the generic system, and no re-teaching of the topic.
Instruction, close to verbatim:

> Review this new til topic adversarially against the Writing Standard
> below — assume nothing about it is fine until you've checked it
> yourself. Check specifically: are terms defined before they're used, is
> it built up from first principles rather than assuming a mental model
> the reader may not have, does it use concrete examples rather than
> staying abstract, would a reader with zero prior background on this
> subject actually follow it, and is the frontmatter `summary` a single
> scannable sentence rather than a restated paragraph. Also check it
> against the Writing Standard's tone, figurative-language, and
> technical-correctness criteria — does the prose read as generically
> AI-patterned rather than something a knowledgeable person actually
> wrote, is any analogy or casual phrase over-explained instead of
> trusted to land, and is every substantive technical claim actually
> verified rather than just confidently stated. Also check it isn't
> a near-duplicate of an existing topic in this section (listed below). Do
> not edit the file — review only. Report findings ranked by severity, or
> say explicitly you found nothing worth flagging.

- No findings, or only cosmetic ones → done, go to Stage 4.
- Real findings → fix them yourself (this is a content edit, not a
  correctness-critical code change, so no need for a separate fix agent),
  then re-run this stage on the updated file. Cap at 2 rounds, matching
  `/feature`'s fix-loop cap — if findings persist after that, stop and
  surface them to the user rather than continuing to iterate alone.

## Stage 4 — Final gate

Re-run the Stage 2 verification suite on the final version, confirm it's
green, and summarize the topic and the review outcome for the user. Ask
before committing or pushing, same as always — this skill leaves the
working tree ready, it doesn't ship it.
