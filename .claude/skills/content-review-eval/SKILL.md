---
name: content-review-eval
description: Run this repo's content-review eval — checks whether the Stage 3 review of add-topic, add-case-study and add-dsa-entry actually catches a deliberately planted content-quality violation (undefined jargon, AI-patterned tone, over-explained figurative language, an unverified technical claim, a wrong estimate, a one-sided deep dive, a code bug the tests miss, a walkthrough that only narrates) rather than rubber-stamping a draft, including false-positive controls. Use when asked to run/check the content-review eval, after editing the shared Stage 3 prompt (docs/content-review.md) or a content skill's checklist, the Writing Standard (docs/writing-standard.md) or docs/NON_NEGOTIABLES.md, or after a real content review misses something in actual use (add a scenario for it first).
---

# Content-review eval

Once a content skill's Stage 3 review actually runs, does it catch a real
planted problem instead of rubber-stamping the draft, and leave a clean draft
alone? (`skill-routing-eval` checks the step before: whether the right skill
is chosen.) The scenarios are in
[`evals/content-review/scenarios.md`](../../../evals/content-review/scenarios.md);
read `evals/README.md` for the general eval philosophy.

## Stage 0 — Scope the run

All scenarios (`CR-*` for `add-topic`, `CS-*` for `add-case-study`, `DS-*`
for `add-dsa-entry`) by default, and after an edit to something they all
depend on: the Writing Standard, `docs/NON_NEGOTIABLES.md`, or the shared
Stage 3 instruction in `docs/content-review.md`. An edit to one skill's
checklist needs only that skill's scenarios; a Writing Standard edit that only
touches tone needs only `CR-02`. Say which you're running and why.

## Stage 1 — Run each in-scope scenario

The reviewer instruction is never stored in the eval: a snapshot would test a
review that no longer exists the moment the real prompt changes. So for each
scenario, read fresh, never from a cached copy:

- the Stage 3 instruction from `docs/content-review.md`, verbatim, with
  `<kind>` and `<checklist>` filled in from the reviewing skill's `SKILL.md`
  (`add-topic` for `CR-*`, `add-case-study` for `CS-*`, `add-dsa-entry` for
  `DS-*`), replacing a checklist item that doesn't apply to the draft with
  "none", as a real run would (`CR-*` drafts link nothing, and only a
  `systems-and-infrastructure` draft gets add-topic's item 2);
- `docs/writing-standard.md`;
- the existing items for the near-duplicate check: the scenario's
  **Section**'s topics (`ls src/content/<section>/`) for `CR-*`, the case
  studies for `CS-*`, the entries for `DS-*`.

Build the draft as `scenarios.md` says (a `CS-*` or `DS-*` scenario is its
base plus the scenario's replacements). Then spawn a **fresh**
`general-purpose` agent (never `fork`: it must not know a problem was
planted) and give it, in this order: the draft's files, verbatim, exactly as
the skill's Stage 3 would; the Writing Standard; the path of
`docs/NON_NEGOTIABLES.md`; the existing items; and the instruction, with its
framing intact, so it believes it's doing a real review. Run independent
scenarios in parallel (one message, several `Agent` calls). Record each
review's finding text, not a paraphrase.

## Stage 2 — Grade and log

Grade each against the scenario's **Expected finding**:

- **PASS**: a finding substantively names the planted violation. For a
  control (`CR-05`, `CS-03`, `DS-03`): nothing flagged, or only findings true
  of the text (a real polish gap, a scope or placement observation).
- **FAIL**: nothing flagged when a violation was planted, or only something
  unrelated; for a control, a reported defect that isn't true of the draft (a
  fabricated claim, a misreading, a correct statement called wrong).
- **AMBIGUOUS**: a finding brushes near the planted issue without clearly
  naming it. Say why; don't force a grade.

Log the run in `evals/content-review/results/README.md`: add a row to its
trend table (date, trigger, counts, one-line note) and replace its "Latest
run" section with this run's log: date, run by, trigger, a table of ID,
planted violation, whether the review caught it and the grade, then notes on
anything that stood out. Git history keeps older logs.

## Stage 3 — A real miss or a new skill? Add a scenario first

If this run was triggered by a real content review missing something, or by a
new content-reviewing skill, first add a scenario to `scenarios.md` in the
existing format (**Section** or base, **Planted violation**, the fabricated
draft, **Expected finding**, **Fails if**), one planted problem each, and
include it. A scenario sourced from a real miss is worth more than several
speculative ones.

## Stage 4 — Report

Summarize for the user: which scenarios ran, the grades, and anything
surprising (a violation caught for the wrong reason, a near-miss, a sign the
Stage 3 prompt itself needs tightening; report that as a finding, don't patch
it mid-eval). Run `npm run format:check` on the results file. Ask before
committing.
