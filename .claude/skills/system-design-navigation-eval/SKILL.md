---
name: system-design-navigation-eval
description: Run this repo's system-design-navigation eval — checks whether a fresh agent given only a symptom (no topic names) reaches the right System Design question and the right catalog topics from the questions' titles and summaries, including ambiguous-by-design cases and a control that no question should cover. Use when asked to run/check the system-design-navigation eval, after adding/renaming/reordering a question under src/system-design/questions/ or editing a question's title, summary or topic links, or after placing a new systems-and-infrastructure topic under a question.
---

# System-design-navigation eval

Wraps the procedure in
[`evals/system-design-navigation/HOW_TO_RUN.md`](../../../evals/system-design-navigation/HOW_TO_RUN.md)
as an invokable skill for the same reason `skill-routing-eval` and
`content-review-eval` are skills and not markdown files someone has to
remember exists. It tests the System Design section's content (question
titles, summaries and topic links), the part the automated tests can't
judge: they prove there are no dead links and every
`systems-and-infrastructure` topic sits under a question, not that a
person with a problem would find the right one. Read `evals/README.md`
for the general eval philosophy and
[`scenarios.md`](../../../evals/system-design-navigation/scenarios.md)
before running this the first time.

## Stage 0 — Scope the run

Default when asked to "run the eval" with no qualifier, or after adding,
renaming or reordering questions: every scenario (`SDN-01`..`SDN-21`).

Run only the scenarios plausibly affected when the trigger is narrower,
e.g. one question's summary was reworded, so only the scenarios whose
Expected is that question or a neighbor that could claim its symptoms.
State which scenarios you're running and why before starting.

Before running anything, check the scenarios themselves are still current:
if the question set changed, follow "When the question set changes" in
`HOW_TO_RUN.md` first (re-derive each scenario's Expected from the current
pages, verify each listed topic is still linked from its question, add a
scenario per new question). Running stale scenarios grades the content
against answers that no longer apply.

## Stage 1 — Run each in-scope scenario

Follow `HOW_TO_RUN.md`'s procedure exactly. Build the landing-page view
(each question's title and summary, in `order`) fresh from
`src/system-design/questions/*.md` at run time, never from a cached list.
For each scenario spawn a **fresh** `general-purpose` agent (never `fork`,
which would inherit this session's knowledge of the expected answer),
given only that view, the scenario's symptom verbatim and the instruction
in `HOW_TO_RUN.md`. It must not read `evals/`.

Run independent scenarios in parallel (one message, multiple `Agent`
calls) rather than sequentially.

## Stage 2 — Grade and log

Compare each result to `scenarios.md`'s Expected (PASS / FAIL /
AMBIGUOUS, per `HOW_TO_RUN.md`). For ambiguous scenarios, grade the
reasoning against the accepted alternatives listed there. Append a new
dated/labeled section to today's file under
`evals/system-design-navigation/results/` (create it if this is the first
run today), never overwriting a prior run. Use the result-log template in
`HOW_TO_RUN.md`.

## Stage 3 — Fixing a miss

A FAIL is usually a content problem, and the fix goes in the content, not
the scenario: a question `summary` or `title` that pulled a reader the
wrong way, or a topic link that's missing from the question a symptom
belongs to. Report it as a finding; don't silently rewrite a question
mid-eval. Only rewrite a scenario when its Expected answer was wrong (say
so in the results notes). A real misroute seen in actual use gets a new
scenario before it gets fixed.

## Stage 4 — Report

Summarize for the user: which scenarios ran, the grades, anything
surprising (a right answer for the wrong reason, a near-miss, a question
whose summary keeps attracting the wrong symptoms). Format-check the
results file (`npm run format:check`) before considering this done. Ask
before committing, same as always.
