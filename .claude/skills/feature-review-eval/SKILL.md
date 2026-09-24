---
name: feature-review-eval
description: Run this repo's feature-review eval — checks whether /feature's Stage 4 reviewer actually catches a deliberately planted defect in a diff (see evals/feature-review/scenarios.md for the current set) instead of rubber-stamping it, including a clean control it must not invent findings for. Use when asked to run/check the feature-review eval, after editing Stage 4's reviewer instruction in feature/SKILL.md or docs/NON_NEGOTIABLES.md, or after a defect escaped a /feature review (add a scenario for it first).
---

# Feature-review eval

Wraps [`evals/feature-review/HOW_TO_RUN.md`](../../../evals/feature-review/HOW_TO_RUN.md)
as a skill, for the same reason the other eval runners are skills: a
procedure in passive documentation only runs if someone remembers it exists.
It is the `/feature` counterpart of `content-review-eval`: that one checks
`add-topic`'s review, this one checks Stage 4's.

## Stage 0 — Scope the run

All scenarios (`FR-01`..`FR-04`) by default, and always after an edit to
Stage 4's reviewer instruction or to `docs/NON_NEGOTIABLES.md`. Before
running after such an edit, rotate one scenario's planted defect as
`scenarios.md` asks, and say which.

## Stage 1 — Run each scenario, twice

Follow `HOW_TO_RUN.md` exactly: copy Stage 4's current reviewer instruction
fresh, and give each run a **fresh** `general-purpose` agent (never `fork`)
that doesn't know a defect was planted. Run independent scenarios in
parallel (one message, several `Agent` calls).

## Stage 2 — Grade and log

Grade each run against `scenarios.md`'s Expected finding using
`HOW_TO_RUN.md`'s rules, and append the run to
`evals/feature-review/results/<YYYY-MM-DD>.md`. Never overwrite a previous
run.

## Stage 3 — Escaped defect? Add a scenario first

If this run was triggered by a defect that escaped a real `/feature` review
(an **Escaped defect** cell in `docs/pipeline-log.md`), add a scenario that
plants the same kind of defect before running, and include it.

## Stage 4 — Report

Summarize for the user: the grades, disagreements between the two runs of a
scenario, and anything surprising (a finding that names the defect for the
wrong reason, a severity that undersells it). Run
`npm run format:check` on the results file. Ask before committing.
