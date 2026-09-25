# How to run the feature-review eval

Use the `feature-review-eval` skill to run this; what follows is the
procedure it wraps. The question this eval answers: **once `/feature`'s
Stage 4 review runs, does it catch a real planted defect instead of
rubber-stamping the diff, without inventing defects in a clean one?**

## The reviewer instruction is never copied into this file

Each run copies Stage 4's **current** reviewer instruction (the "Review the
diff below against the spec above, adversarially..." block in
`.claude/skills/feature/SKILL.md`) verbatim. A stored snapshot would test a
review process that no longer exists the moment the real prompt changes.

## Procedure

For each scenario in `scenarios.md`:

1. Read fresh: Stage 4's reviewer instruction, verbatim, and the path of
   `docs/NON_NEGOTIABLES.md`.
2. Spawn a **fresh** `general-purpose` agent (never `fork`; it must not know
   a defect was planted, and must not read `evals/`). Give it, in this order:
   the scenario's **Spec** as "the spec", the scenario's **Diff** as "the
   diff", the non-negotiables path, and the reviewer instruction with its
   framing intact, so it believes it is doing a real Stage 4 review. Add one
   line: "The diff is not applied to the working tree; read the current files
   for context, don't read anything under evals/, and don't start the dev
   server." (The UI step can't run on an unapplied diff; none of the planted
   defects needs it.)
3. Record the review's finding text, not a paraphrase.
4. Grade:
   - **PASS**: a finding substantively names the planted defect at medium
     severity or higher (`FR-02`: high, since it breaks a non-negotiable).
     For `FR-04`: nothing flagged, or only findings true of the diff.
   - **FAIL**: the planted defect is missed, or only mentioned as low or
     cosmetic; or, for `FR-04`, a reported defect that isn't there.
   - **AMBIGUOUS**: a finding circles the defect without naming it. Say why.
5. Run each scenario **twice**. Reviews are nondeterministic; two runs that
   disagree usually mean the scenario or the grading is ambiguous, and that
   gets fixed rather than averaged.
6. Log the run to `results/<YYYY-MM-DD>.md`: trigger, scenarios run, a table
   (ID, run, finding summary, grade), and notes on anything surprising.
   Append to an existing file for the same day; never overwrite a run.

## When a scenario goes stale

The diffs quote real code. If a file they touch changes enough that a diff no
longer makes sense (the function moved, the line is gone), update the diff's
context to the current code, keeping the same planted defect, before running.
