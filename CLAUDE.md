# CLAUDE.md

Guidance for working in this repository. This file is loaded into every
session and every subagent, so it stays a short router: rules that apply to
every task, and links to the doc a specific task needs. Put detail in the
linked doc or the skill that uses it, not here; `npm run check:claude-md`
fails if this file passes 150 lines or a link in it is broken.

## What this is

`til` is a static reference site: markdown topics grouped into top-level
sections, plus a second tab (System Design) of worked design case studies
that draw on the catalog and a third (DSA) of data structures, patterns and
algorithms with tested Python and TypeScript code, rendered by a Vite + React +
TypeScript app and deployed to GitHub Pages. There's no backend and no in-app editor — content is added
as files in the repository and shipped with the next build.

## Where to read what

| When you are…                                          | Read first                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Building a feature or any nontrivial app change        | [`/feature`](.claude/skills/feature/SKILL.md), [docs/SDLC.md](docs/SDLC.md)                              |
| Adding a topic, or changing topics or sections         | [`add-topic`](.claude/skills/add-topic/SKILL.md), [docs/content.md](docs/content.md)                     |
| Adding a System Design case study or its diagrams      | [`add-case-study`](.claude/skills/add-case-study/SKILL.md), [docs/case-studies.md](docs/case-studies.md) |
| Adding a DSA entry or its tested code                  | [`add-dsa-entry`](.claude/skills/add-dsa-entry/SKILL.md), [docs/dsa.md](docs/dsa.md)                     |
| Writing or reviewing any published prose               | [docs/writing-standard.md](docs/writing-standard.md)                                                     |
| Running, adding or debugging a check, or a size budget | [docs/verification.md](docs/verification.md)                                                             |
| Changing UI                                            | [docs/DESIGN.md](docs/DESIGN.md)                                                                         |
| Any change (constraints every reviewer enforces)       | [docs/NON_NEGOTIABLES.md](docs/NON_NEGOTIABLES.md)                                                       |
| Considering a new practice or tool                     | [docs/DEFERRED_PRACTICES.md](docs/DEFERRED_PRACTICES.md)                                                 |
| Checking whether the AI tooling still works            | [evals/README.md](evals/README.md)                                                                       |

## Adding a feature or nontrivial change

Use `/feature <description>` — it runs this repo's full spec → TDD →
implementation → adversarial review (code + UI) → retrospective pipeline: three separate,
fresh agents (test-writer, implementer, reviewer; a triager, a fixer or a
process-edit reader joins only when a stage calls for one) with role separation
enforced between them, plus the orchestrating session handling spec
directly (docs stay with the implementer agent, as part of finishing the
change). See [docs/SDLC.md](docs/SDLC.md) for why it's shaped this
way — including why it's three agents and not one per named step — and
[`.claude/skills/feature/SKILL.md`](.claude/skills/feature/SKILL.md) for
the exact steps. Skip it for genuinely small, unambiguous changes (a typo,
a one-line fix) — just make those directly. A bug of unknown size is
triaged first (reproduce it, find the cause), then routed by what was found;
see the skill's Stage 0. If a direct fix repairs a bug
that a run in [docs/pipeline-log.md](docs/pipeline-log.md) introduced, fill
in that row's **Escaped defect** cell.

## What's deliberately not built here

Tags, interactive step-through pages, Mermaid diagrams, interactive
(pan/zoom) diagrams, end-to-end (Playwright) tests, and an in-app editor or
CMS are all out of scope for now — the app is intentionally kept to sections +
search + markdown rendering + dark mode, plus the System Design case studies
([docs/case-studies.md](docs/case-studies.md)) and their build-time D2 diagrams (static SVGs; D2 itself never runs in
CI or in the browser). The case studies are a bounded exception to the earlier
"no domain split, no reading paths" stance: they add one ordered list of
worked designs that link into the catalog, but not tracks, curricula or a
domain hierarchy over it, and catalog URLs, section pages and the topics' own
prose are unchanged. The DSA tab ([docs/dsa.md](docs/dsa.md)) is a second
bounded exception of the same kind: one list ordered by prerequisites, with
code in files beside each entry that pytest and vitest run, but no code runner
in the browser and no diagrams. Add one of the deferred items only if a real need shows up, not
speculatively.

The equivalent list for _process/tooling_ practices (CI gates, hooks,
agent-workflow scaling) considered and deliberately deferred, each with
its actual reasoning and a concrete revisit condition, lives in
[docs/DEFERRED_PRACTICES.md](docs/DEFERRED_PRACTICES.md).

## How changes land

Every change, including a small direct fix, lands through a branch and a pull
request and merges only when CI passes; nothing is committed directly to
`main`. That is how CI runs before a change goes live: two commits with
failing tests once reached `main` and deployed because they were pushed
straight to it. A dependency update (a Dependabot pull request, or a version
bump done by hand) is a direct change, not a `/feature`: run `npm run verify`,
read the release notes for a major version, and let CI decide; patch and minor
Dependabot updates merge on their own once CI passes (README, "Repository
settings this relies on"). The skills still end at "ready to commit"; committing,
pushing and opening the pull request wait for the user's go-ahead.

## Verifying a change

`npm run verify` is exactly what CI and the deploy workflow run, and the gate
`/feature`, `add-topic`, `add-case-study` and `add-dsa-entry` finish on. What each check
proves, the commands that aren't in `verify`, and the size budgets are in
[docs/verification.md](docs/verification.md).

## Keeping context small

Every session and subagent pays for this file on every turn. Read the doc the
routing table points to, not everything. Brief a subagent with file paths and
the sections it needs rather than pasted content. For work that spans
sessions, hand off through a spec or a short progress note and start fresh
instead of carrying a long transcript.
