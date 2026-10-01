# Skill-routing eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (template in `../HOW_TO_RUN.md`); git history keeps
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
| 2026-09-29 | Finding triage and slimming (branch chore/review-triage)             | 4    | 0    | 0         | Scoped run; latest run, below.                               |
| 2026-09-29 | add-case-study batch mode (branch chore/harness-practices)           | 1    | 0    | 0         | SR-15 only; prompt refreshed; latest run, below.             |
| 2026-09-30 | DSA tab (PR #31): add-dsa-entry, content-audit, add-topic, CLAUDE.md | 7    | 0    | 0         | Scoped run; SR-06 prompt refreshed; latest run, below.       |

## Latest run: 2026-09-30, DSA tab descriptions

Run by: self
Trigger: PR #31 added `add-dsa-entry` (SR-18), widened `content-audit` to DSA entries, pointed `add-topic` and `add-dsa-entry` at each other, and added a DSA row to CLAUDE.md's routing table.
Scope: SR-02, SR-06, SR-11, SR-15, SR-16, SR-17 and SR-18, the scenarios whose Expected answer depends on a content skill's description or the routing table. The rest route to `/feature`, a direct fix or an eval, and nothing they depend on changed. A full run is due after the harness pass that edits the skills again.

**Scenario fixed during the run:** SR-06 named a September 2026 state-of-LLMs topic that PR #26 removed. Its first run routed direct, but only after the agent found the topic missing and said it would ask the user, so it didn't test the trap. The prompt now asks for a few words in the caching topic's eviction paragraph, and SR-06 was re-run on it; the grade below is that run.

| ID    | Routing decision           | Reasoning (1 line)                                                                                             | Grade |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- |
| SR-02 | `add-topic`                | A new topic in an existing section; noted `vector-search.md` as an overlap to link, not repeat.                | PASS  |
| SR-06 | Direct                     | A few words added to one existing paragraph; `add-topic` is for new topics, `content-audit` for prose quality. | PASS  |
| SR-11 | `content-audit`            | A sweep of every published topic, case study and DSA entry on the three criteria asked about.                  | PASS  |
| SR-15 | `add-case-study`           | A new design write-up with a diagram; checked that no collaborative-editor case study exists.                  | PASS  |
| SR-16 | `content-audit` (one file) | A quality check of one published case study; `add-case-study` only writes new ones.                            | PASS  |
| SR-17 | `/feature`                 | Page layout and a render-script guard are app and tooling code, which `add-case-study` excludes.               | PASS  |
| SR-18 | `add-dsa-entry`            | A new entry; checked `src/dsa/entries/` has no heap; not a catalog topic or app code.                          | PASS  |

### Notes

SR-16 and SR-18 lean on the descriptions PR #31 changed (content-audit now covers
revising an existing entry; add-dsa-entry names "add the heap entry to DSA"), and
both agents cited them. No agent confused a DSA entry with a catalog topic.
