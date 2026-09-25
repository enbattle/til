# Development process

How a feature or change moves from idea to ready-to-commit in this repo.
The operational version Claude Code follows automatically is
[`.claude/skills/feature/SKILL.md`](../.claude/skills/feature/SKILL.md),
invoked with `/feature <description>`; this document is the narrative
version, with the reasoning behind each stage.

## Why a process at all

For a one-line fix, none of this applies — just make the change. A bug of
unknown size is triaged first (reproduce it and find the cause), and the
cause decides the route: a localized fix is direct with a regression test,
anything wider comes here. For
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
  change. A fresh agent for review also sidesteps a second LLM-specific
  problem beyond bias: performance degrades as a context fills, not only
  once it's full, so a reviewer that inherited the entire spec-to-
  implementation conversation is working with more degraded attention
  than one that opens fresh with just the diff and the spec.
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

That leaves three worker agents with real, distinct jobs — a
test-writer, an implementer, and an adversarial reviewer — plus the
orchestrating session handling spec and coordination throughout. Two
single-purpose agents join only when a stage calls for one: a fixer when review
finds something, and a reader of process edits at the retrospective.

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
   in this process commits or pushes on its own. Findings the review made
   that the change didn't cause are listed separately, so they aren't
   mistaken for regressions or lost.
6. **Retrospective.** Part of the same handoff. Look back over the run for
   friction that actually happened and fix each real issue at the strongest
   level that fits: a mechanical check, then a correction to the doc that
   already covers it, then new guidance only if neither does. A run with no
   friction reports "nothing to change" and changes nothing but its log row. It also checks
   whether a [deferred practice's](DEFERRED_PRACTICES.md) revisit condition has
   come true. Edits to a process file get one independent read first, by an
   agent that never saw the author's reasoning, and then go to the user as
   proposals in their own commit. Every run also appends a row to
   [pipeline-log.md](pipeline-log.md), so friction that is too small to act
   on in one run can still show up as a pattern across runs. The exact steps
   are in the skill.

## `docs/NON_NEGOTIABLES.md`

The standing constraints every stage is held to (accessibility, security,
the process rules above), in one short numbered list that points to where
each detail lives. The spec is checked against it before approval, and each
change reviewer (`/feature` Stage 4, `add-topic` Stage 3, `content-audit`) is
given it. When a spec and a line there conflict, the line wins
unless the user amends the file; a stage that finds the conflict stops and
asks rather than choosing.

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
description, does a fresh session route it to the skill this document and
`CLAUDE.md` intend, or a direct edit (`skill-routing`) — and, once the
right skill runs, does its review step actually catch what it's supposed
to catch instead of rubber-stamping the work (`content-review`, for
`add-topic`'s Stage 3; `feature-review`, for `/feature`'s Stage 4), and — for the System Design section — does a
reader starting from a symptom reach the right question and topics
(`system-design-navigation`)? Run via the `skill-routing-eval`,
`content-review-eval`, `feature-review-eval` and
`system-design-navigation-eval` skills — see
`evals/README.md`. All are run
manually/periodically, not on every commit — after the changes the table in
`evals/README.md` names (the canonical list of which eval each change
calls for); `.claude/hooks/nudge-sdlc.js` reminds a session about most of
them.

## Completeness audit, after a large effort

Reviews check that each change is correct; none of them checks that a whole
plan was carried out. After an effort that spans many commits (a batch of
process changes, a multi-feature branch), and before merging it, give one
fresh `general-purpose` agent (never `fork`) the plan or specs and the branch
diff, and nothing from the conversation that built it. Ask for a table
mapping every planned item to evidence (file and line), marked implemented,
deliberately changed (and whether the reason holds), partial or missing, plus
a check that the docs still describe what the branch does. On 2026-09-23/24
this found real gaps that every per-change review had passed, including a
flaky test that `verify` depended on and a planned change that was never
made. It is expensive, so it runs once per large effort, not per change.
