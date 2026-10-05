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
| 2026-10-03 | /feature Stage 2 and re-run edits; add-dsa-entry ordering rule (#53) | 5    | 0    | 0         | Scoped run; SR-17 prompt refreshed (sticky nav now exists).  |
| 2026-10-04 | add-dsa-entry step 2: the randomized-test convention                 | 2    | 0    | 0         | SR-17 and SR-18; SR-17 prompt refreshed again.               |
| 2026-10-04 | /feature Stage 1 UI-criteria bullet; Stage 6 severity-first retro    | 4    | 0    | 0         | Scoped run: SR-01, SR-05, SR-07, SR-17.                      |
| 2026-10-04 | /feature: where a guard's planted cases live (test split)            | 1    | 0    | 0         | SR-01 only; the edit can't change routing.                   |
| 2026-10-04 | /feature Stage 1 guard edits (#63, #64); docs-audit gate fixes       | 2    | 0    | 0         | SR-01 and SR-18; logs #64's unlogged SR-01 pass too.         |
| 2026-10-04 | Friction follow-ups: /feature Stages 1, 4, 6; docs-audit; the hook   | 2    | 0    | 0         | SR-01 and SR-09.                                             |
| 2026-10-05 | Five-minute content: add-case-study, add-dsa-entry, content-audit    | 8    | 0    | 0         | SR-19 and SR-20 added; SR-16's reasoning refreshed.          |

## Latest run: 2026-10-05, five-minute content

Run by: self
Trigger: branch `docs/digestible-content`. `add-case-study` and `add-dsa-entry` now own rewrites to the five-minute template (and, for DSA, merges), and their descriptions say so; `content-audit`'s description hands those to them; the Writing Standard gains a "Case studies and DSA entries" section; the case-study checklist, `docs/case-studies.md` and `docs/dsa.md` change templates and budgets.
Scope: the scenarios whose Expected answer depends on the three edited descriptions: SR-06 (direct edit to existing content), SR-11 (`content-audit` sweep), SR-15 (new case study), SR-16 (polish an existing case study), SR-18 (new DSA entry), plus the two new traps, SR-19 (rewrite to the template) and SR-20 (merge DSA entries). SR-12 ran afterwards, once `content-review-eval`'s description was updated to name the new planted problems.

| ID    | Routing decision           | Reasoning (1 line)                                                                      | Grade |
| ----- | -------------------------- | --------------------------------------------------------------------------------------- | ----- |
| SR-06 | Direct                     | A few words added to an existing topic is a small, unambiguous change.                  | PASS  |
| SR-11 | `content-audit`            | A sweep of everything published for AI tone, over-explained analogies and wrong claims. | PASS  |
| SR-12 | `content-review-eval`      | Checking that a review still catches a planted violation after its wording changed.     | PASS  |
| SR-15 | `add-case-study`           | A new case study with diagrams; no collaborative-editor file exists.                    | PASS  |
| SR-16 | `content-audit` (one file) | A quality pass on a published case study; template rewrites belong to `add-case-study`. | PASS  |
| SR-18 | `add-dsa-entry`            | A new entry; no LRU entry exists.                                                       | PASS  |
| SR-19 | `add-case-study`           | Its description covers rewriting a case study to the five-minute template.              | PASS  |
| SR-20 | `add-dsa-entry`            | Its description covers merges, and docs/dsa.md's migration table names the two entries. | PASS  |

Notes: SR-16 and SR-19 drew the line between them the intended way (polishing keeps the page's shape; a template rewrite doesn't), each citing the other skill's description.
