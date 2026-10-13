---
name: content-review-eval
description: Run this repo's content-review eval — checks whether the Stage 3 review of add-topic and add-case-study actually catches a deliberately planted content-quality violation (undefined jargon, AI-patterned tone, over-explained figurative language, an unverified technical claim, a wrong estimate, a decision that names no alternative, a claim compression made false) rather than rubber-stamping a draft, including false-positive controls. Use when asked to run/check the content-review eval, after editing docs/content-review.md or the Writing Standard (evals/README.md's table lists every trigger), or after a real content review misses something in actual use (add a scenario for it first).
---

# Content-review eval

Once a content skill's Stage 3 review actually runs, does it catch a real
planted problem instead of rubber-stamping the draft, and leave a clean draft
alone? (`skill-routing-eval` checks the step before: whether the right skill
is chosen.) The scenarios are in
[`evals/content-review/scenarios.md`](../../../evals/content-review/scenarios.md).
Follow the stages in
[evals/README.md, "Running any eval"](../../../evals/README.md#running-any-eval);
this file adds what is specific to this eval.

## Stage 0 — Scope

All scenarios (`CR-*` for `add-topic`, `CS-*` for `add-case-study`) by
default, and after an edit to something they all
depend on: the Writing Standard, `docs/NON_NEGOTIABLES.md`, or the shared
Stage 3 instruction in `docs/content-review.md`. An edit to one skill's
checklist needs only that skill's scenarios; a Writing Standard edit that only
touches tone needs only `CR-02`. The drafts are fabricated, but a scenario can
still rely on live content (a case study the draft links to, no published item
with the draft's slug); declare it as a premise.

## Stage 1 — What the reviewer gets

For each scenario, read fresh:

- the Stage 3 instruction from `docs/content-review.md`, verbatim, with
  `<kind>` and `<checklist>` filled in from the reviewing skill's `SKILL.md`
  (`add-topic` for `CR-*`, `add-case-study` for `CS-*`), replacing a checklist item that doesn't apply to the draft with
  "none", as a real run would (`CR-*` drafts link nothing, and only a
  `systems-and-infrastructure` draft gets add-topic's item 2);
- `docs/writing-standard.md`;
- the existing items for the near-duplicate check: the scenario's
  **Section**'s topics (`ls src/content/<section>/`) for `CR-*`, the case
  studies for `CS-*`. If a published item shares the draft's slug, leave
  it out and tell the reviewer the draft is a rewrite of that item and that it
  must not open the published file (comparing the two would expose the planted
  line); otherwise a true near-duplicate finding confounds every grade.

Build the draft as `scenarios.md` says (a `CS-*` scenario is its
base plus the scenario's replacements). Give the agent, in this order: the
draft's files, verbatim, exactly as the skill's Stage 3 would; the Writing
Standard; the path of `docs/NON_NEGOTIABLES.md`; the existing items; and the
instruction. Record each review's finding text.

## Stage 2 — Grading specifics

Against the scenario's **Expected finding**:

- **PASS**: a finding substantively names the planted violation. For a
  control (`CR-05`, `CS-03`): nothing flagged, or only findings true
  of the text (a real polish gap, a scope or placement observation).
- **FAIL**: nothing flagged when a violation was planted, or only something
  unrelated; for a control, a reported defect that isn't true of the draft (a
  fabricated claim, a misreading, a correct statement called wrong).

Log in `evals/content-review/results/README.md`, with columns ID, planted
violation, whether the review caught it, and grade.

## Stage 3 — New scenarios

Triggered by a real content review missing something, or by a new
content-reviewing skill. Format: **Section** or base, **Planted violation**,
the fabricated draft, **Expected finding**, **Fails if**.
