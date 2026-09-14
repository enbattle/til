# Development process

How a feature or change moves from idea to ready-to-commit in this repo.
The operational version Claude Code follows automatically is
[`.claude/skills/feature/SKILL.md`](../.claude/skills/feature/SKILL.md),
invoked with `/feature <description>`; this document is the narrative
version, with the reasoning behind each stage.

## Why a process at all

For a one-line fix, none of this applies — just make the change. For
anything with real scope (new functionality, a change to an existing
convention, anything touching more than a file or two), skipping straight
to code trades a small amount of upfront thinking for a much larger amount
of potential rework. The stages below are what that upfront thinking looks
like made concrete, not ceremony for its own sake.

## Why three agents, not one per step

It's tempting to give every named step in a process like this its own
agent — a spec agent, a test agent, an implementation agent, a review
agent, a UI-checking agent, a docs agent. That's not what this repo does,
and it's worth being explicit about why: **a separate agent is worth its
cost only where independence prevents a specific, identifiable bias** —
not because a step has its own name in a diagram. Even at engineering
orgs with a strong review culture, a small feature usually isn't five
different people; it's one engineer handling spec, implementation, tests,
and docs together, plus one _different_ person reviewing.

Applying that test to each step:

- **Spec** stays with the orchestrating session, working with the user
  directly. This isn't a blind step — it benefits from context and
  back-and-forth — and the user's own approval is the independent check
  on it. No agent can validate "is this what the user actually wants"
  better than the user.
- **Tests, written before the implementation exists**, do need a
  genuinely separate, fresh agent — but for an LLM-specific reason, not
  because human TDD usually involves two people (it doesn't). If the same
  context that's about to write the implementation also writes "the tests
  first," it's already holding that implementation in mind, and the tests
  quietly get shaped to fit it. A fresh agent, with no implementation plan
  yet, is the only way to actually force tests to reflect the spec instead
  of a foregone conclusion.
- **Implementation** is separate from both of the above, and specifically
  from review — the one rule enforced almost universally in real
  engineering orgs: the author of a change doesn't approve their own
  change.
- **UI verification** is folded into the review stage rather than given
  its own agent. It exists for the identical reason review does — a
  perspective that isn't the implementer's own — so splitting it out
  buys no additional independence, only additional cost. A human reviewer
  at most companies clicks through a UI change themselves as part of
  reviewing it; they don't hand it to a separate person first.
- **Documentation** stays with the implementer, as part of finishing the
  change, the same way docs-as-code normally works: whoever built the
  feature documents it in the same change. There's no bias to guard
  against here — docs aren't a correctness check, so independence has
  nothing to protect.

That leaves exactly three worker agents with real, distinct jobs — a
test-writer, an implementer, and an adversarial reviewer — plus the
orchestrating session handling spec and coordination throughout.

## The stages

1. **Spec.** Requirements and the intended approach, written down before
   any code — including acceptance criteria specific enough to become test
   cases, not just a restated feature name. Reviewed and approved by the
   user before implementation starts. Saved to `docs/specs/<slug>.md` as a
   durable record, the same way an ADR captures _why_ a decision was made,
   not just what changed.
2. **Tests first (red).** Written against the spec, by an agent that never
   sees or writes the implementation.
3. **Implementation (green) + docs.** Written to satisfy the tests from
   stage 2, by a separate agent that never edits a test file — the failing
   tests are the specification it's building against, not something to
   bend to fit whatever it happens to build. This agent also updates any
   project conventions the change affects.
4. **Adversarial review (code + UI).** An independent pass over the diff —
   no visibility into either prior stage's reasoning, only the spec and
   the code as it stands — that also drives the feature in a browser if it
   has a rendered surface. Confirmed findings go back for a fix, then back
   for re-review, capped at two rounds so a stuck loop surfaces to a human
   instead of running forever.
5. **Final gate.** Every check green on the actual final diff, summarized
   for the user, who decides whether and when to commit and push. No stage
   in this process commits or pushes on its own.

## `docs/specs/`

Every feature that went through this process leaves a spec file behind —
a running record of what was built and why, independent of git history
(which shows _what_ changed, not the requirements and alternatives that
were weighed to get there).

## Verifying the process itself

Everything above describes how a session is supposed to build a change.
None of it checks whether that actually keeps happening — a session can
build something well while still having picked the wrong process for it,
and that kind of drift is invisible until someone checks for it directly.
`evals/` holds scenario-based checks for exactly that: given a task
description, does a fresh session route it to `/feature`, `add-topic`, or
a direct edit, the way this document and `CLAUDE.md` intend? See
`evals/README.md`. It's run manually/periodically, not on every commit —
most usefully right after editing this file, `CLAUDE.md`, or any
`SKILL.md`, which is also when `.claude/hooks/nudge-sdlc.js` reminds a
session to check it.
