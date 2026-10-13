---
name: skill-routing-eval
description: Run this repo's skill-routing eval — checks whether a fresh session correctly routes task descriptions to the right skill under .claude/skills/ (see this file's Stage 1 for the current, canonical list of options) or a direct edit, per CLAUDE.md's own carve-out. Use when asked to run/check the skill-routing eval, after editing CLAUDE.md or a SKILL.md (evals/README.md's table lists every trigger), or after adding a new skill (add a scenario for it first).
---

# Skill-routing eval

Given a task description, does a fresh session pick the skill this repo
intends, or a direct edit? The scenarios are in
[`evals/skill-routing/scenarios.md`](../../../evals/skill-routing/scenarios.md).
Follow the stages in
[evals/README.md, "Running any eval"](../../../evals/README.md#running-any-eval),
and read its grading philosophy (some scenarios are ambiguous by design)
before running this the first time; this file adds what is specific to this
eval.

## Stage 0 — Scope

All scenarios by default, and after an edit with broad effect (`CLAUDE.md`'s
general framing, an instruction every skill references). When the trigger is
narrower, run only the scenarios plausibly affected: those whose Expected
answer, or a wrong answer they guard against, names the changed skill.

## Stage 1 — The instruction

**The instruction below is the single source of truth for the list of valid
routing targets.** When a skill is added or removed, change it here; the full
list lives only here, since copies of it went stale twice. The SDLC reminder
hook (`.claude/hooks/nudge-sdlc.js`) names the content skills for its own
reminder, so check it too when a content skill changes.

Give each agent only the scenario's prompt, verbatim, inside this instruction:

> You are a fresh Claude Code session that has just started working in
> this repository. You have no other context beyond what's normally
> available (CLAUDE.md, docs/, .claude/skills/, etc. — read what you
> need). A user has just sent you this message as their very first
> request: "<scenario prompt>". Do NOT implement anything yet, and do
> NOT read anything under the evals/ directory (irrelevant and would
> bias you). Your only job: decide which skill, if any, you'd invoke —
> /feature, add-topic, add-case-study, docs-audit, content-audit,
> skill-routing-eval, content-review-eval, feature-review-eval,
> or neither (direct). Explore the codebase as
> needed to inform that judgment. Report your routing decision and a
> one-sentence reason why. Keep it under 100 words.

Record each routing decision and its one-sentence reason.

## Stage 2 — Grading specifics

Against the scenario's **Expected**:

- **PASS**: matches Expected, or one of the acceptable answers listed for an
  ambiguous scenario, with defensible reasoning.
- **FAIL**: doesn't match, or matches with reasoning that shows the right
  rule wasn't applied (the right answer for the wrong reason: note it as a
  near-miss).

Log in `evals/skill-routing/results/README.md`, with columns ID, routing
decision, one-line reasoning and grade.

## Stage 3 — New scenarios

Triggered by a new skill or a session's routing surprising you in real use.
Format: the exact prompt, **Expected**, **Why**, **Fails if**.
