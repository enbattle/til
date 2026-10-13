# Evals for this repo's AI-native tooling

`docs/SDLC.md` and the skills under `.claude/skills/` define how a Claude
Code session is supposed to build changes in this repo — spec → TDD →
implementation → review for a real feature, a lighter draft → review
loop for a new topic or case study, direct edits for anything genuinely small. This
directory answers a different question: **does that machinery actually
work, and does a fresh session actually follow it?**

That's not something `npm run test:run` can check — those tests verify
the _app_. This verifies the _process that builds the app_, the same way
you'd want to know a CI pipeline still triggers correctly after editing
the workflow file, not just that the code it builds still compiles.
Concretely, each category plants a known-bad case (a task that should
route a specific way, a topic draft with a specific violation) and checks
whether the real machinery actually catches it — the same fault-injection
idea behind chaos-engineering practices elsewhere, aimed at this repo's
own safety nets instead of a running service.

## What's here

- `skill-routing/` — does a fresh session, given a task description,
  correctly decide whether to invoke the right skill under
  `.claude/skills/` (see `skill-routing-eval/SKILL.md`'s Stage 1 for the
  current, canonical list — not repeated here on purpose, since it's
  already drifted from being hand-duplicated in more than one place) or
  just make the change directly per `CLAUDE.md`'s own carve-out? This is
  the first eval category, chosen because routing is the thing most
  likely to silently drift as `CLAUDE.md` and the skills themselves
  change over time — a session can build something _well_ while still
  having picked the wrong process for it. Run via the `skill-routing-eval`
  skill rather than by hand.
- `content-review/` — once a content skill's Stage 3 review
  ([docs/content-review.md](../docs/content-review.md)) actually runs, does
  it catch a deliberately planted content-quality violation (the current set
  is in its `scenarios.md`: topics and case studies), or
  rubber-stamp the draft? A different failure surface than `skill-routing`:
  that category checks whether the right skill gets chosen, this one checks
  whether the chosen skill's review step actually works, including
  false-positive controls (clean drafts that should draw no findings). Run
  via the `content-review-eval` skill.

- `feature-review/` — once `/feature`'s Stage 4 review runs, does it catch a
  planted defect in a diff (the current set is in its `scenarios.md`)
  instead of rubber-stamping it, and does
  it leave a clean diff alone? The `/feature` counterpart of
  `content-review`. Each scenario runs twice, since one review of a
  nondeterministic agent says little, and a planted defect is rotated whenever
  the reviewer instruction changes so the instruction can't learn the answers.
  Run via the `feature-review-eval` skill.

- `docs-audit/` — not an eval. `results/README.md` logs each docs
  audit, written by the `docs-audit` skill's Stage 4, so whether an audit
  ran after a batch of changes can be checked later.

## How this is run

**Manual/periodic, on purpose** — not wired into CI. Running a scenario
means starting a fresh session (or, as a practical stand-in, a fresh
subagent with no prior context) with no memory of this repo's history and
observing what it actually does, which costs real time and tokens per
scenario. That's a deliberate, judged expense for a personal site, not
something to run on every commit. Each category runs through its own skill
(`skill-routing-eval`, `content-review-eval`, `feature-review-eval`), which
holds what's specific to it; the stages they share are in
[Running any eval](#running-any-eval). Each folder here holds the scenarios
and results.

**Re-run whenever it matters**, not on a fixed schedule: after any change
the table below names; `.claude/hooks/nudge-sdlc.js` reminds a session
about some of them (CLAUDE.md, the skills, the hooks and the process docs it
names), but not edits to docs such as content.md or verification.md.
Drift here is invisible until someone actually checks, so the point of
running it isn't ceremony — it's catching the case where a documentation
edit that read fine on its own quietly made the routing rule worse.

Which eval to run depends on what changed:

| You changed                                                                                                                     | Run                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` or a doc its routing table points to, any `SKILL.md`, `docs/SDLC.md`, `.claude/hooks/`, or added or removed a skill | `skill-routing-eval`                                                                                                                           |
| The Writing Standard, `docs/content-review.md`, a content skill's Stage 3 checklist, or `docs/NON_NEGOTIABLES.md`               | `content-review-eval`                                                                                                                          |
| `/feature`'s Stage 4 reviewer or finding-triage instruction, `docs/NON_NEGOTIABLES.md`, or a defect escaped a `/feature` review | `feature-review-eval`                                                                                                                          |
| Added or widened a `check:*` script, or made lint stricter                                                                      | re-read `evals/feature-review/scenarios.md`: rotate any planted defect a check now catches mechanically, since it no longer tests the reviewer |

## Running any eval

Every eval skill runs these stages. The skill adds only what is its own:
which instruction it copies, what the agent is given, what each grade means
for it, its results table's columns, and any run-twice rule.

**Stage 0 — Scope the run.** All scenarios by default; after a narrower
change, only the scenarios plausibly affected (the skill says how to tell).
Say which you're running and why.

Scenarios quote live content (a sentence in a topic, an entry that mustn't
exist yet, a diff against real code), and that content changes under them. A
scenario states each such fact as an HTML comment in its `scenarios.md`, in
one of four forms: `<!-- premise: <path> contains "<text>" -->`,
`… lacks "<text>"`, `<!-- premise: <path> exists -->` or `… missing`, with
`<path>` relative to the repository root. `npm run check:eval-premises` (in
`verify`) fails when one stops holding, when a `premise:` comment matches no
form, and when a `diff` block in `feature-review/scenarios.md` no longer
passes `git apply --check`. When a new or refreshed scenario relies on live
content, declare it as a premise. When the check fails, fix the scenario (the
prompt, draft or diff) so it still tests what it says it tests, not the check.

**Stage 1 — Run each in-scope scenario.** The instruction under test is never
stored in the eval: a snapshot would test a prompt that no longer exists the
moment the real one changes. Copy it verbatim from its source on every run.
For each scenario, spawn a **fresh** `general-purpose` agent, never `fork`
([why](../docs/SDLC.md#why-a-fresh-agent-never-a-fork)): it must not inherit
this session's context, its guess at the answer, or the knowledge that
something was planted. The skill-routing and feature-review instructions also
tell it not to read anything under `evals/`; the content reviewer isn't told,
since naming the folder would hint that the draft is an eval. Give it the instruction with its framing
intact, so it believes it's doing real work. Run independent scenarios in
parallel (one message, several `Agent` calls). Record each response's text,
not a paraphrase.

**Stage 2 — Grade and log.** Grade each against the scenario's expected
answer; the skill says what counts for it.

- **PASS**: the response matches what's expected.
- **FAIL**: it doesn't (the skill lists the ways).
- **AMBIGUOUS**: you can't tell, or the response circles the expected answer
  without clearly naming it. Say why; don't force a grade.

Log the run in the category's `results/README.md`: add a row to its trend
table (date, trigger, counts, one-line note) and replace its "Latest run"
section with this run's log: date, run by, trigger, a table with one row per
scenario run (the skill names the columns), then notes on anything that stood
out. Git history keeps older logs.

**Stage 3 — A real miss or a new skill? Add a scenario first.** If the run
was triggered by something the machinery got wrong in real use, or by a new
skill, first add a scenario to `scenarios.md` in its existing format (each
scenario tests one thing), and include it in this run. A scenario from something
that actually happened beats several hypothetical ones.

**Stage 4 — Report.** Summarize for the user: which scenarios ran, the
grades, and anything surprising (a near-miss, a right answer for the wrong
reason, a sign the instruction under test needs tightening; report that as a
finding, don't patch it mid-eval). Run `npm run format:check` on the results
file, and `npm run check:eval-premises` if you added or edited a scenario.
Ask before committing.

## Grading philosophy

Not every scenario has exactly one right answer — `evals/skill-routing/scenarios.md`
marks some as **ambiguous by design** (e.g., a new section, where `add-topic`'s description itself allows either
the plain "Adding a new section" steps or the full pipeline). Grade those against
whether the session's reasoning was defensible, not against a single
fixed string. A useful eval scenario set includes real judgment calls,
not only cases with an unambiguous correct answer — otherwise it only
ever tests pattern-matching, not the routing judgment it's meant to
verify.
