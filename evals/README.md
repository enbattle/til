# Evals for this repo's AI-native tooling

`docs/SDLC.md` and the skills under `.claude/skills/` define how a Claude
Code session is supposed to build changes in this repo — spec → TDD →
implementation → review for a real feature, a lighter draft → review
loop for a new topic, direct edits for anything genuinely small. This
directory answers a different question: **does that machinery actually
work, and does a fresh session actually follow it?**

That's not something `npm run test:run` can check — those tests verify
the _app_. This verifies the _process that builds the app_, the same way
you'd want to know a CI pipeline still triggers correctly after editing
the workflow file, not just that the code it builds still compiles.

## What's here

- `skill-routing/` — does a fresh session, given a task description,
  correctly decide whether to invoke `/feature`, `add-topic`,
  `docs-audit`, or just make the change directly per `CLAUDE.md`'s own
  carve-out? This is the first eval category, chosen because routing is
  the thing most likely to silently drift as `CLAUDE.md` and the skills
  themselves change over time — a session can build something _well_
  while still having picked the wrong process for it.

Future categories worth adding once routing is stable: does the
`/feature` review stage actually catch known-bad injected bugs; does
`add-topic`'s review actually catch a planted factual error or Writing
Standard violation.

## How this is run

**Manual/periodic, on purpose** — not wired into CI. Running a scenario
means starting a fresh session (or, as a practical stand-in, a fresh
subagent with no prior context) with no memory of this repo's history and
observing what it actually does, which costs real time and tokens per
scenario. That's a deliberate, judged expense for a personal site, not
something to run on every commit. See `skill-routing/HOW_TO_RUN.md` for
the exact procedure.

**Re-run whenever it matters**, not on a fixed schedule: after editing
`CLAUDE.md`, any `SKILL.md`, or `docs/SDLC.md` — the same trigger the
`nudge-sdlc` hook (`.claude/hooks/nudge-sdlc.js`) reminds you about.
Drift here is invisible until someone actually checks, so the point of
running it isn't ceremony — it's catching the case where a documentation
edit that read fine on its own quietly made the routing rule worse.

## Grading philosophy

Not every scenario has exactly one right answer — `evals/skill-routing/scenarios.md`
marks some as **ambiguous by design** (e.g., a bug of unknown size before
investigation, or a new section where `CLAUDE.md` itself allows either
the plain 3-step process or the full pipeline). Grade those against
whether the session's reasoning was defensible, not against a single
fixed string. A useful eval scenario set includes real judgment calls,
not only cases with an unambiguous correct answer — otherwise it only
ever tests pattern-matching, not the routing judgment it's meant to
verify.
