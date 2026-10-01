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
| 2026-09-29 | Finding triage and slimming (branch chore/review-triage)             | 4    | 0    | 0         | Scoped run; latest run, below.                               |
| 2026-09-29 | add-case-study batch mode (branch chore/harness-practices)           | 1    | 0    | 0         | SR-15 only; prompt refreshed; latest run, below.             |
| 2026-09-30 | DSA tab (PR #31): add-dsa-entry, content-audit, add-topic, CLAUDE.md | 7    | 0    | 0         | Scoped run; SR-06 prompt refreshed.                          |
| 2026-10-01 | Harness pass (branch chore/harness-pass), all scenarios              | 17   | 0    | 0         | Full run; latest run, below.                                 |
| 2026-10-01 | docs-audit description gains friction aggregation                    | 1    | 0    | 0         | SR-09 only: still routes to `docs-audit`.                    |
| 2026-10-01 | SR-17 prompt refreshed (the width guard already exists)              | 1    | 0    | 0         | Now asks for a node-count limit; routes to `/feature`.       |

## Latest run: 2026-10-01, harness pass

Run by: self
Trigger: branch chore/harness-pass. The three content skills now share their review stages through `docs/content-review.md`, the eval skills absorbed their `HOW_TO_RUN.md` files, `/feature` gained the retro edits, and the hand-kept reviewer lists became general wording.
Scope: every live scenario (SR-13 is retired), since nearly every skill file changed.

| ID    | Routing decision            | Reasoning (1 line)                                                                                       | Grade |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| SR-01 | `/feature`                  | New search-dialog UI behaviour needs a spec, tests and UI review.                                        | PASS  |
| SR-02 | `add-topic`                 | A new topic in an existing section; noted `vector-search.md` to link rather than repeat.                 | PASS  |
| SR-03 | Direct                      | A one-word README typo is CLAUDE.md's own example of a direct fix.                                       | PASS  |
| SR-04 | Direct (the 3-step process) | `docs/content.md`'s three steps; `add-topic`'s description excludes new sections. An accepted answer.    | PASS  |
| SR-05 | `/feature` Stage 0 triage   | A bug of unknown size: reproduce it and find the cause first, then route by what was found.              | PASS  |
| SR-06 | Direct                      | A few words in one existing paragraph; `add-topic` is for new topics, `content-audit` for prose quality. | PASS  |
| SR-07 | `/feature`                  | A reading-time calculation plus UI on cards and the topic page is app code.                              | PASS  |
| SR-08 | Direct                      | CLAUDE.md: a version bump by hand is a direct change; run `verify` and let CI decide.                    | PASS  |
| SR-09 | `docs-audit`                | Doc staleness after a batch of changes is `docs-audit`'s stated job.                                     | PASS  |
| SR-10 | `skill-routing-eval`        | Asked for by name.                                                                                       | PASS  |
| SR-11 | `content-audit`             | A sweep of published content on the three criteria asked about.                                          | PASS  |
| SR-12 | `content-review-eval`       | Checks that a reworded review still catches a planted violation; routing is ruled out.                   | PASS  |
| SR-14 | `feature-review-eval`       | Checks that Stage 4's reviewer still catches planted defects in a diff.                                  | PASS  |
| SR-15 | `add-case-study`            | A new design write-up with a diagram; no collaborative-editor case study exists.                         | PASS  |
| SR-16 | `content-audit` (one file)  | Revising one published case study; `add-case-study` only writes new ones.                                | PASS  |
| SR-17 | `/feature`                  | Page layout and a render-script guard are app and tooling code, which `add-case-study` excludes.         | PASS  |
| SR-18 | `add-dsa-entry`             | A new entry; checked `src/dsa/entries/` has no heap.                                                     | PASS  |

### Notes

SR-12 cited `content-review-eval`'s new trigger (an edit to a content skill's
review instructions). SR-04 routed direct and added that the first topic should
still get a Writing Standard review, which is defensible. Routing depends on the
skill descriptions, whose scope wording didn't change, and no agent was confused
by the shared review doc.
