---
name: skill-routing-eval
description: Run this repo's skill-routing eval — checks whether a fresh session correctly routes task descriptions to the right skill under .claude/skills/ (see this file's Stage 1 for the current, canonical list of options) or a direct edit, per CLAUDE.md's own carve-out. Use when asked to run/check the skill-routing eval, after editing CLAUDE.md or a SKILL.md (evals/README.md's table lists every trigger), or after adding a new skill (add a scenario for it first).
---

# Skill-routing eval

Given a task description, does a fresh session pick the skill this repo
intends, or a direct edit? The scenarios are in
[`evals/skill-routing/scenarios.md`](../../../evals/skill-routing/scenarios.md);
read `evals/README.md` for the grading philosophy (some scenarios are
ambiguous by design) before running this the first time.

## Stage 0 — Scope the run

All scenarios by default, and after an edit with broad effect (`CLAUDE.md`'s
general framing, an instruction every skill references). Run **only the
scenarios plausibly affected** when the trigger is narrower: if only
`add-topic`'s `SKILL.md` changed, only scenarios whose Expected answer
depends on it. Say which you're running and why.

A prompt that names real content (a topic, a sentence, an entry that must or
mustn't exist) declares that as a `<!-- premise: … -->` comment in
`scenarios.md`, and `npm run check:eval-premises` (part of `verify`) fails
when it stops holding. Add one when a new or refreshed prompt relies on live
content, and refresh the prompt when the check fails.

## Stage 1 — Run each in-scope scenario

**The instruction below is the single source of truth for the list of valid
routing targets.** When a skill is added or removed, change it here; the full
list lives only here, since copies of it went stale twice. The SDLC reminder
hook (`.claude/hooks/nudge-sdlc.js`) names the content skills for its own
reminder, so check it too when a content skill changes.

For each scenario, spawn a **fresh** `general-purpose` agent (never `fork`:
it must not inherit this session's context or its guess at the answer). Give
it only the scenario's prompt, verbatim, inside this instruction:

> You are a fresh Claude Code session that has just started working in
> this repository. You have no other context beyond what's normally
> available (CLAUDE.md, docs/, .claude/skills/, etc. — read what you
> need). A user has just sent you this message as their very first
> request: "<scenario prompt>". Do NOT implement anything yet, and do
> NOT read anything under the evals/ directory (irrelevant and would
> bias you). Your only job: decide which skill, if any, you'd invoke —
> /feature, add-topic, add-case-study, add-dsa-entry, docs-audit, content-audit,
> skill-routing-eval, content-review-eval, feature-review-eval,
> or neither (direct). Explore the codebase as
> needed to inform that judgment. Report your routing decision and a
> one-sentence reason why. Keep it under 100 words.

Run independent scenarios in parallel (one message, several `Agent` calls).
Record each routing decision and its one-sentence reason.

## Stage 2 — Grade and log

Grade each against the scenario's **Expected**:

- **PASS**: matches Expected, or one of the acceptable answers listed for an
  ambiguous scenario, with defensible reasoning.
- **FAIL**: doesn't match, or matches with reasoning that shows the right
  rule wasn't applied (the right answer for the wrong reason: note it as a
  near-miss).
- **AMBIGUOUS**: you can't tell from the response. Say why; don't force a
  grade.

Log the run in `evals/skill-routing/results/README.md`: add a row to its
trend table (date, trigger, counts, one-line note) and replace its "Latest
run" section with this run's log: date, run by, trigger, a table of ID,
routing decision, one-line reasoning and grade, then notes on anything that
stood out. Git history keeps older logs.

## Stage 3 — A new skill or a real misroute? Add a scenario first

If a _new_ skill triggered this run, or a session's routing surprised you in
real use, first add a scenario to `scenarios.md` in the existing format (the
exact prompt, **Expected**, **Why**, **Fails if**) and include it. A scenario
from something that actually happened beats several hypothetical ones.

## Stage 4 — Report

Summarize for the user: which scenarios ran, the grades, and anything
surprising (a near-miss, reasoning that shows the rule wasn't applied even
though the label matched). Run `npm run format:check` on the results file.
Ask before committing.
