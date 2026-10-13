---
name: feature-review-eval
description: Run this repo's feature-review eval — checks whether /feature's Stage 4 reviewer actually catches a deliberately planted defect in a diff (see evals/feature-review/scenarios.md for the current set) instead of rubber-stamping it, including a clean control it must not invent findings for. Use when asked to run/check the feature-review eval, after editing /feature's Stage 4 reviewer (evals/README.md's table lists every trigger), or after a defect escaped a /feature review (add a scenario for it first).
---

# Feature-review eval

Once `/feature`'s Stage 4 review runs, does it catch a real planted defect
instead of rubber-stamping the diff, without inventing defects in a clean
one? It is the `/feature` counterpart of `content-review-eval`. The scenarios
are in [`evals/feature-review/scenarios.md`](../../../evals/feature-review/scenarios.md).
Follow the stages in
[evals/README.md, "Running any eval"](../../../evals/README.md#running-any-eval);
this file adds what is specific to this eval.

## Stage 0 — Scope

All scenarios (every `FR-*` in `scenarios.md`; FR-06 and FR-07 test finding triage) by
default, and always after an edit to Stage 4's reviewer or triage
instruction or to `docs/NON_NEGOTIABLES.md`. Before running after such an
edit, rotate one scenario's planted defect as `scenarios.md` asks, and say
which.

When `check:eval-premises` fails, update the diff's context and hunk
headers, or the premise, to the current code, keeping the same planted
defect. A diff that
still applies can drift too, when the code gains what it adds (FR-04
duplicated `reading-time.ts` once that landed), so read each diff against the
current code as well. A drifted control is worse than none.

## Stage 1 — What the reviewer gets, twice

Copy Stage 4's current "Review the diff below against the spec above,
adversarially..." block from `.claude/skills/feature/SKILL.md`. Give the
agent, in this order: the scenario's **Spec** as "the spec", its **Diff** as
"the diff", the path of `docs/NON_NEGOTIABLES.md`, and the reviewer
instruction, plus one line: "The diff is not applied to the working tree;
read the current files for context, don't read anything under evals/, and
don't start the dev server." (The UI step can't run on an unapplied diff; no
planted defect needs it.)

**Triage scenarios (FR-06, FR-07):** copy Stage 4's finding-triage
instruction (the "For each finding below, confirm or dispute it..." block)
and its four outcomes, verbatim. The agent gets the scenario's **Spec**,
**Diff** (as the output of `npm run review:diff`) and **Finding**, the
instruction, the outcomes, and one line: "Propose one outcome for each
finding; don't read anything under evals/."

Run each scenario **twice**. Reviews are nondeterministic; two runs that
disagree usually mean the scenario or the grading is ambiguous, and that gets
fixed rather than averaged.

## Stage 2 — Grading specifics

- **PASS**: a finding substantively names the planted defect at medium
  severity or higher (high for a defect that breaks a non-negotiable, such as
  `FR-02` and `FR-08`). For
  `FR-04`: nothing flagged, or only findings true of the diff (one labelled
  theoretical passes if it's true and not presented as blocking). A planted
  defect labelled theoretical is a FAIL. For a triage scenario: the proposed
  outcome matches **Expected outcome**, backed by evidence from real files.
- **FAIL**: the planted defect is missed, or only mentioned as low or
  cosmetic; for `FR-04`, a reported defect that isn't there; for a triage
  scenario, as the scenario says.
- **AMBIGUOUS** also covers a triage outcome that is hedged though the
  evidence is right.

Log in `evals/feature-review/results/README.md`, with columns ID, run,
finding summary and grade.

## Stage 3 — Escaped defect

If an **Escaped defect** cell in `docs/pipeline-log.md` triggered this run,
add a scenario that plants the same kind of defect before running.

## Stage 4 — Report

Also report disagreements between the two runs of a scenario, and a severity
that undersells a defect. Run `npm run check:eval-premises` after rotating a
diff too.
