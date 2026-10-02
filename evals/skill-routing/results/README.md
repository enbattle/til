# Skill-routing eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `skill-routing-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                              | Pass | Fail | Ambiguous | Note                                                         |
| ---------- | -------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------ |
| 2026-09-14 | Initial validation of the suite                                      | 8    | 0    | 0         | Baseline.                                                    |
| 2026-09-14 | CLAUDE.md now names `add-topic`                                      | 1    | 0    | 0         | Hook-prompted re-run.                                        |
| 2026-09-14 | `docs-audit` added (SR-09)                                           | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-14 | `skill-routing-eval` added (SR-10)                                   | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-15 | `content-audit` added (SR-11)                                        | 3    | 0    | 0         | Red before, green after; SR-02 and SR-09 unaffected.         |
| 2026-09-16 | `content-review-eval` added (SR-12)                                  | 3    | 0    | 0         | Also fixed a routing list that omitted `skill-routing-eval`. |
| 2026-09-20 | `system-design-navigation-eval` added (SR-13, since retired)         | 5    | 0    | 0         | No collisions.                                               |
| 2026-09-21 | /feature Stage 6 retro and related edits                             | 6    | 0    | 1         | One near-miss.                                               |
| 2026-09-21 | Re-check after the independent read                                  | 2    | 0    | 1         | Near-miss persisted, graded ambiguous.                       |
| 2026-09-23 | Process hardening; `feature-review-eval` added (SR-14)               | 7    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Commits 6197731, 487b849                                             | 8    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Triage-first rule for bugs (4b0b19f)                                 | 8    | 0    | 0         | SR-05 twice.                                                 |
| 2026-09-24 | Pre-merge of PR #11, all scenarios                                   | 14   | 0    | 0         | No regression.                                               |
| 2026-09-25 | CLAUDE.md "How changes land"                                         | 4    | 1    | 0         | SR-08 failed: no doc covered dependency updates.             |
| 2026-09-25 | SR-08 re-check after the dependency-update note                      | 3    | 0    | 0         | Fix held twice.                                              |
| 2026-09-28 | Case studies replace question pages (SR-15..17)                      | 16   | 0    | 0         | All live scenarios.                                          |
| 2026-09-29 | CLAUDE.md split into a router plus docs                              | 4    | 0    | 0         | Scoped run.                                                  |
| 2026-09-29 | At a glance and role splitting                                       | 5    | 0    | 0         | No regression.                                               |
| 2026-09-29 | Finding triage and slimming (branch chore/review-triage)             | 4    | 0    | 0         | Scoped run.                                                  |
| 2026-09-29 | add-case-study batch mode (branch chore/harness-practices)           | 1    | 0    | 0         | SR-15 only; prompt refreshed.                                |
| 2026-09-30 | DSA tab (PR #31): add-dsa-entry, content-audit, add-topic, CLAUDE.md | 7    | 0    | 0         | Scoped run; SR-06 prompt refreshed.                          |
| 2026-10-01 | Harness pass (branch chore/harness-pass), all scenarios              | 17   | 0    | 0         | Full run.                                                    |
| 2026-10-01 | docs-audit description gains friction aggregation                    | 1    | 0    | 0         | SR-09 only: still routes to `docs-audit`.                    |
| 2026-10-01 | SR-17 prompt refreshed (the width guard already exists)              | 1    | 0    | 0         | Now asks for a node-count limit; routes to `/feature`.       |
| 2026-10-02 | Batch-mode edits in add-dsa-entry and add-case-study (#44, #46)      | 4    | 0    | 0         | SR-15 to SR-18; SR-18 prompt refreshed (heap now exists).    |

## Latest run: 2026-10-02, batch-mode skill edits

Run by: self
Trigger: PRs #44 and #46 edited the bodies of `add-dsa-entry` and `add-case-study` (their batch-mode bullets: drafter checks, `npm ci` per worktree) and `docs/content-review.md`'s Batch mode. The evals were deferred at merge time and run now.
Scope: the scenarios whose Expected answer depends on those two skills, SR-15 to SR-18; no description or routing rule changed, so the rest are unaffected. Before running, SR-18's prompt was refreshed: it named the heap entry, which now exists, so it had become a request to edit an existing entry (the same staleness SR-15's note describes). It now names an LRU cache entry.

| ID    | Routing decision | Reasoning (1 line)                                                                                    | Grade |
| ----- | ---------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| SR-15 | `add-case-study` | A new case study with D2 diagrams; no existing one covers a collaborative editor.                     | PASS  |
| SR-16 | `content-audit`  | Scoped to `url-shortener.md`: revising a published case study's prose and checking its claims.        | PASS  |
| SR-17 | `/feature`       | Page UI plus a new diagram-check rule; `add-case-study` sends page and tooling changes to `/feature`. | PASS  |
| SR-18 | `add-dsa-entry`  | A new entry under `src/dsa/entries/` with code and tests; no DSA page or tooling change.              | PASS  |

Notes: every agent cited the skill descriptions' own exclusions, not keyword matches. Scenario prompts that name content can go stale as the content gets written; check that the named item still doesn't exist before each run.

After the docs audit then changed `add-dsa-entry`'s description (its routing examples named entries that now exist), SR-18 was re-run once more: still `add-dsa-entry` (PASS).

A follow-up edit to the bodies of `add-dsa-entry` and `content-review-eval` (no description changed) was checked with SR-12 and SR-18: SR-12 still routes to `content-review-eval` (PASS); SR-18 passed above, and the `add-dsa-entry` edit is to its Stage 1 body only.
