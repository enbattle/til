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

(These are three roles. A role can run as several agents when its content is
too large for one context, as the 2026-09 case-study summaries run did with 16
studies and about 110,000 words; the feature skill says how.)

**A separate agent is worth its cost only where independence prevents a
specific, identifiable bias**, not because a step has its own name. Even in
orgs with a strong review culture, a small feature is usually one engineer
handling spec, implementation, tests and docs, plus one _different_ person
reviewing.

Applying that test to each step:

- **Spec** stays with the orchestrating session, working with the user. It
  benefits from context and back-and-forth, and the user's approval is the
  independent check on it: no agent knows better than the user what the
  user wants.
- **Tests, written before the implementation exists**, need a separate,
  fresh agent, for an LLM-specific reason: a context about to write the
  implementation, even in a later turn, already holds it in mind, and the
  tests quietly get shaped to fit it. A fresh agent with no implementation
  plan is the only way to make tests reflect the spec.
- **Implementation** is separate from both of the above, and specifically
  from review — the one rule enforced almost universally in real
  engineering orgs: the author of a change doesn't approve their own
  change. A fresh agent for review also sidesteps a second LLM-specific
  problem beyond bias: performance degrades as a context fills, not only
  once it's full, so a reviewer that inherited the entire spec-to-
  implementation conversation is working with more degraded attention
  than one that opens fresh with just the diff and the spec. That is also why
  `/code-review` isn't the pipeline's reviewer: invoked through the `Skill`
  tool it forks from the calling session and inherits the implementer's
  framing.
- **UI verification** is folded into review: it exists for the same reason
  (a perspective that isn't the implementer's), so a separate agent would add
  cost without independence. A human reviewer clicks through a UI change
  themselves.
- **Documentation** stays with the implementer, as docs-as-code normally
  works. Docs aren't a correctness check, so independence has nothing to
  protect.

That leaves three worker agents with real, distinct jobs — a
test-writer, an implementer, and an adversarial reviewer — plus the
orchestrating session handling spec and coordination throughout. Three
single-purpose agents join only when a stage calls for one: a finding triager and a
fixer when review finds something, and a reader of process edits at the
retrospective.

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
   has a rendered surface. Before any fix comes finding triage (below);
   the ones worth fixing go back for a fix (with a fresh test-writer's
   failing test first, where the finding could recur), then back for
   re-review, capped at two rounds so a stuck loop surfaces to a human
   instead of running forever.
5. **Final gate.** Every check green on the actual final diff, summarized
   for the user, who decides whether and when to commit and push. No stage
   in this process commits or pushes on its own. Findings the review made
   that the change didn't cause are listed separately, so they aren't
   mistaken for regressions or lost.
6. **Retrospective.** Part of the same handoff. Look back over the run for
   friction that actually happened and fix each real issue at the strongest
   level that fits, after first asking whether something could be deleted
   or simplified instead: a mechanical check, then a correction to the doc
   that already covers it, then new guidance only if neither does. A retro
   aims for no net added words in process files. A run with no
   friction reports "nothing to change" and changes nothing but its log row. It also checks
   whether a [deferred practice's](DEFERRED_PRACTICES.md) revisit condition has
   come true. Edits to a process file get one independent read first, by an
   agent that never saw the author's reasoning, and then go to the user as
   proposals in their own commit. Every run also appends a row to
   [pipeline-log.md](pipeline-log.md), so friction a retro may leave for later
   (the skill's severity test says which) can still show up as a pattern across runs; `docs-audit`
   Stage 2b periodically reads the log as a set and proposes structural
   fixes, deletions first. The exact steps are in the skill.

## Why finding triage comes before any fix

An adversarial reviewer is told to assume nothing is correct, which is right
for finding problems and wrong for deciding what to do about them: left
unchecked, each round turned theoretical edge cases into permanent tests and
rules. So a finding is confirmed against the current repo before anyone fixes
it, by a fresh agent in the implementer role: not the reviewer, who would
defend its findings, and not the orchestrator, who wants the run finished.
The orchestrator assigns outcomes from that evidence but may not reject or
defer a finding the triager confirmed reachable without asking the user; a
finding is contested when the triager disputes one the reviewer rated High,
or the orchestrator wants to overrule the triager. In the content skills'
shared review ([content-review.md](content-review.md)) the orchestrator may
confirm prose findings itself, but a rejection must quote the text or source that disproves the finding. The outcome weighs impact against likelihood rather than history alone, so a
severe class that hasn't happened yet still gets fixed, and every rejected or
deferred finding is written down with its reason so the next review doesn't
raise it again. A regression test is added only where the problem could
recur, and it exercises the real output, since a test that re-implements the
code it checks passes whether or not the code is right. The same reasoning
is why a check over content reads the rendered output or the shared parser's
tree: the case-study summary check cost a fix round for each markdown shape it
didn't anticipate (a split or nested list, a list in a blockquote, a
reference-style link, a line folded into the item above).

## `docs/NON_NEGOTIABLES.md`

The standing constraints every stage is held to (accessibility, security,
the process rules above), in one short numbered list that points to where
each detail lives. The spec is checked against it before approval, and every
reviewer of a change is given it (the file's own opening lists which stages
those are). When a spec and a line there conflict, the line wins
unless the user amends the file; a stage that finds the conflict stops and
asks rather than choosing.

## `docs/specs/`

Every feature that went through this process leaves a spec file behind —
a running record of what was built and why, independent of git history
(which shows _what_ changed, not the requirements and alternatives that
were weighed to get there).

## Verifying the process itself

None of the above checks that sessions keep following it; a session can
build something well with the wrong process, and that drift stays invisible
until checked. `evals/` holds scenario-based checks for it: given a task
description, does a fresh session route it to the skill this document and
`CLAUDE.md` intend, or a direct edit (`skill-routing`) — and, once the
right skill runs, does its review step actually catch what it's supposed
to catch instead of rubber-stamping the work (`content-review`, for the
content skills' Stage 3; `feature-review`, for
`/feature`'s Stage 4)? Run via the `skill-routing-eval`,
`content-review-eval` and `feature-review-eval` skills — see
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
