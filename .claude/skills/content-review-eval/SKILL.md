---
name: content-review-eval
description: Run this repo's content-review eval — checks whether add-topic's Stage 3 review agent actually catches a deliberately planted content-quality violation (undefined jargon, AI-patterned tone, over-explained figurative language, an unverified technical claim) rather than rubber-stamping a draft, including a false-positive control. Use when asked to run/check the content-review eval, after editing add-topic/SKILL.md's Stage 3 prompt or CLAUDE.md's Writing Standard, or after a real add-topic review misses something in actual use (add a scenario for it first).
---

# Content-review eval

Wraps the procedure in
[`evals/content-review/HOW_TO_RUN.md`](../../../evals/content-review/HOW_TO_RUN.md)
as an invokable skill for the same reason `skill-routing-eval` is a skill
and not just a markdown file someone has to remember exists: a procedure
sitting in passive documentation only gets run if someone already knows
to go find it, while a skill is surfaced to every session through the
normal skill listing. Read `evals/README.md` for the general eval
philosophy and
[`evals/content-review/scenarios.md`](../../../evals/content-review/scenarios.md)
before running this the first time.

This eval is the sibling to `skill-routing-eval`, testing a different
failure surface: not "does a fresh session pick the right skill," but
"once `add-topic`'s Stage 3 review actually runs, does it catch a real
planted problem instead of rubber-stamping the draft."

## Stage 0 — Scope the run

Running all scenarios (`CR-01`..`CR-05`) is the default when asked to
"run the content-review eval" with no further qualifier, or after editing
something the scenarios depend on (`add-topic/SKILL.md`'s Stage 3
prompt, or `CLAUDE.md`'s Writing Standard).

Run only the scenarios plausibly affected when the trigger is narrower —
e.g. a Writing Standard edit that only touches the tone criteria only
needs `CR-02` re-checked, not the correctness or false-positive
scenarios.

## Stage 1 — Run each in-scope scenario

For each scenario, follow `evals/content-review/HOW_TO_RUN.md`'s
procedure exactly: read `add-topic/SKILL.md`'s current Stage 3
instruction and `CLAUDE.md`'s current Writing Standard fresh (never a
cached copy — this eval exists specifically to test the real, current
prompt), glob the scenario's declared section's current sibling topics,
then spawn a **fresh** `general-purpose` agent (never `fork` — it must
not inherit this session's knowledge of what problem was planted) given
the fabricated draft and that real Stage 3 instruction, framed as a real
`add-topic` review rather than an eval.

Run independent scenarios in parallel (one message, multiple `Agent`
calls) rather than sequentially.

## Stage 2 — Grade and log

Compare each result to `scenarios.md`'s Expected finding (PASS / FAIL /
AMBIGUOUS, per `HOW_TO_RUN.md`'s grading rules). Append a new
dated/labeled section to today's file under
`evals/content-review/results/` (create it if this is the first run
today) — never overwrite a prior run. Use the result-log template in
`HOW_TO_RUN.md`.

## Stage 3 — New violation type or reviewing skill? Add a scenario first

If this run was triggered by a real `add-topic` review missing something
in actual use, or by a new content-reviewing skill being added to the
repo, add a scenario for it to `scenarios.md` first (a fabricated draft
with that exact planted problem, in the existing format), then include
it in Stage 1 — the same way each `content-review` scenario is built around one
planted violation category.

## Stage 4 — Report

Summarize for the user: which scenarios ran, the grades, anything
surprising (a planted violation caught for the wrong reason, a near-miss,
a finding that suggests `add-topic`'s Stage 3 prompt itself needs
tightening — report that as a finding, don't silently patch it
mid-eval). Format-check the results file (`npm run format:check`) before
considering this done. Ask before committing, same as always.
