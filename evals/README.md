# Evals for this repo's AI-native tooling

`docs/SDLC.md` and the skills under `.claude/skills/` define how a Claude
Code session is supposed to build changes in this repo — spec → TDD →
implementation → review for a real feature, a lighter draft → review
loop for a new topic or case study, direct edits for anything genuinely small. This
directory answers a different question: **does that machinery actually
work, and does a fresh session actually follow it?**

That's not something `npm run test:run` can check — those tests verify
the _app_. This verifies the _process that builds the app_, the same way
you'd want to know a CI pipeline still triggers correctly after editing
the workflow file, not just that the code it builds still compiles.
Concretely, each category plants a known-bad case (a task that should
route a specific way, a topic draft with a specific violation) and checks
whether the real machinery actually catches it — the same fault-injection
idea behind chaos-engineering practices elsewhere, aimed at this repo's
own safety nets instead of a running service.

## What's here

- `skill-routing/` — does a fresh session, given a task description,
  correctly decide whether to invoke the right skill under
  `.claude/skills/` (see `skill-routing-eval/SKILL.md`'s Stage 1 for the
  current, canonical list — not repeated here on purpose, since it's
  already drifted from being hand-duplicated in more than one place) or
  just make the change directly per `CLAUDE.md`'s own carve-out? This is
  the first eval category, chosen because routing is the thing most
  likely to silently drift as `CLAUDE.md` and the skills themselves
  change over time — a session can build something _well_ while still
  having picked the wrong process for it. Run via the `skill-routing-eval`
  skill rather than by hand.
- `content-review/` — once `add-topic`'s or `add-case-study`'s Stage 3
  review actually runs, does it catch a deliberately planted content-quality
  violation (undefined jargon, AI-patterned tone, over-explained figurative
  language, an unverified technical claim, and for a case study a wrong
  estimate or a deep dive that doesn't compare options), or rubber-stamp the
  draft? A
  different failure surface than `skill-routing`: that category checks
  whether the right skill gets chosen, this one checks whether the
  chosen skill's review step actually works, including a false-positive
  control (a clean draft that should draw no findings). Run via the
  `content-review-eval` skill.

- `feature-review/` — once `/feature`'s Stage 4 review runs, does it catch a
  planted defect in a diff (the current set is in its `scenarios.md`)
  instead of rubber-stamping it, and does
  it leave a clean diff alone? The `/feature` counterpart of
  `content-review`. Each scenario runs twice, since one review of a
  nondeterministic agent says little, and a planted defect is rotated whenever
  the reviewer instruction changes so the instruction can't learn the answers.
  Run via the `feature-review-eval` skill.

- `docs-audit/` — not an eval. `results/` holds a dated log of each docs
  audit, written by the `docs-audit` skill's Stage 4, so whether an audit
  ran after a batch of changes can be checked later.

## How this is run

**Manual/periodic, on purpose** — not wired into CI. Running a scenario
means starting a fresh session (or, as a practical stand-in, a fresh
subagent with no prior context) with no memory of this repo's history and
observing what it actually does, which costs real time and tokens per
scenario. That's a deliberate, judged expense for a personal site, not
something to run on every commit. Use the `skill-routing-eval` skill to
run it — see `skill-routing/HOW_TO_RUN.md` for the underlying procedure
the skill wraps. The other categories work the same way, each through its
own skill (`content-review-eval`, `feature-review-eval`).

**Re-run whenever it matters**, not on a fixed schedule: after any change
the table below names; `.claude/hooks/nudge-sdlc.js` reminds a session
about most of them.
Drift here is invisible until someone actually checks, so the point of
running it isn't ceremony — it's catching the case where a documentation
edit that read fine on its own quietly made the routing rule worse.

Which eval to run depends on what changed:

| You changed                                                                                                          | Run                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` or a doc its routing table points to, any `SKILL.md`, `docs/SDLC.md`, `.claude/hooks/`, or added a skill | `skill-routing-eval`                                                                                                                           |
| The Writing Standard, `add-topic`'s or `add-case-study`'s Stage 3 review prompt, or `docs/NON_NEGOTIABLES.md`        | `content-review-eval`                                                                                                                          |
| `/feature`'s Stage 4 reviewer instruction, `docs/NON_NEGOTIABLES.md`, or a defect escaped a `/feature` review        | `feature-review-eval`                                                                                                                          |
| Added or widened a `check:*` script                                                                                  | re-read `evals/feature-review/scenarios.md`: rotate any planted defect a check now catches mechanically, since it no longer tests the reviewer |

## Grading philosophy

Not every scenario has exactly one right answer — `evals/skill-routing/scenarios.md`
marks some as **ambiguous by design** (e.g., a new section where `docs/content.md` itself allows either
the plain 3-step process or the full pipeline). Grade those against
whether the session's reasoning was defensible, not against a single
fixed string. A useful eval scenario set includes real judgment calls,
not only cases with an unambiguous correct answer — otherwise it only
ever tests pattern-matching, not the routing judgment it's meant to
verify.
