---
name: skill-routing-eval
description: Run this repo's skill-routing eval — checks whether a fresh session correctly routes task descriptions to the right skill under .claude/skills/ (see this file's Stage 1 for the current, canonical list of options) or a direct edit, per CLAUDE.md's own carve-out. Use when asked to run/check the skill-routing eval, after editing CLAUDE.md/a SKILL.md/docs/SDLC.md (what nudge-sdlc.js reminds about), or after adding a new skill (add a scenario for it first).
---

# Skill-routing eval

Wraps the procedure in
[`evals/skill-routing/HOW_TO_RUN.md`](../../../evals/skill-routing/HOW_TO_RUN.md)
as an invokable skill for the same reason `docs-audit` is a skill and not
just a markdown file someone has to remember exists: a procedure sitting
in passive documentation only gets run if someone already knows to go
find it, while a skill is surfaced to every session through the normal
skill listing. Read `evals/README.md` for the full grading philosophy
(some scenarios are ambiguous by design) before running this the first
time.

## Stage 0 — Scope the run

Running all scenarios is the default when asked to "run the eval" with no
further qualifier, or after editing something with broad effect (e.g.
`CLAUDE.md`'s general framing, a shared instruction all skills reference).

Run **only the scenarios plausibly affected** when the trigger is
narrower — e.g. only `add-topic`'s own `SKILL.md` changed, so only
scenarios whose Expected answer depends on that file need re-checking.
State which scenarios you're running and why before starting, the same
way past runs in `evals/skill-routing/results/` explain their trigger.

## Stage 1 — Run each in-scope scenario

**The instruction below is this repo's single source of truth for the
current list of valid routing targets.** `evals/skill-routing/HOW_TO_RUN.md`
and `evals/README.md` both reference this list rather than restating it —
when a skill is added or removed, this is the only place the list itself
needs to change (this list has already gone stale twice from being
hand-duplicated elsewhere, which is why nothing else repeats the full list now).

For each scenario in `evals/skill-routing/scenarios.md`, spawn a
**fresh** `general-purpose` agent (never `fork` — it must not inherit
this session's context or its guess at the expected answer). Give it
only the scenario's prompt, verbatim, plus this instruction:

> You are a fresh Claude Code session that has just started working in
> this repository. You have no other context beyond what's normally
> available (CLAUDE.md, docs/, .claude/skills/, etc. — read what you
> need). A user has just sent you this message as their very first
> request: "<scenario prompt>". Do NOT implement anything yet, and do
> NOT read anything under the evals/ directory (irrelevant and would
> bias you). Your only job: decide which skill, if any, you'd invoke —
> /feature, add-topic, docs-audit, content-audit, skill-routing-eval,
> content-review-eval, feature-review-eval, system-design-navigation-eval,
> or neither (direct). Explore the codebase as
> needed to inform that judgment. Report your routing decision and a
> one-sentence reason why. Keep it under 100 words.

Run independent scenarios in parallel (one message, multiple `Agent`
calls) rather than sequentially.

## Stage 2 — Grade and log

Compare each result to `scenarios.md`'s Expected (PASS / FAIL /
AMBIGUOUS, per the grading rules in `evals/README.md` and
`HOW_TO_RUN.md`). Append a new dated/labeled section to today's file
under `evals/skill-routing/results/` (create it if this is the first run
today) — never overwrite a prior run, the point is seeing drift across
runs over time. Use the result-log template in `HOW_TO_RUN.md`.

## Stage 3 — New skill? Add a scenario first

If this run was triggered by a _new_ skill being added to the repo,
add a scenario for it to `scenarios.md` (a prompt that should route to
it, per the format the existing scenarios use) before or as part of this
run, then include that new scenario in Stage 1 — the same way `SR-09` was
added the same day `docs-audit` was created.

## Stage 4 — Report

Summarize for the user: which scenarios ran, the grades, anything
surprising (a near-miss, reasoning that reveals the rule wasn't actually
applied even though the label happened to match). Format-check the
results file (`npm run format:check`) before considering this done. Ask
before committing, same as always.
