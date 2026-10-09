# Skill-routing eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `skill-routing-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                                                      | Pass | Fail | Ambiguous | Note                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ---- | ---- | --------- | ------------------------------------------------------------ |
| 2026-09-14 | Initial validation of the suite                                                                              | 8    | 0    | 0         | Baseline.                                                    |
| 2026-09-14 | CLAUDE.md now names `add-topic`                                                                              | 1    | 0    | 0         | Hook-prompted re-run.                                        |
| 2026-09-14 | `docs-audit` added (SR-09)                                                                                   | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-14 | `skill-routing-eval` added (SR-10)                                                                           | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-15 | `content-audit` added (SR-11)                                                                                | 3    | 0    | 0         | Red before, green after; SR-02 and SR-09 unaffected.         |
| 2026-09-16 | `content-review-eval` added (SR-12)                                                                          | 3    | 0    | 0         | Also fixed a routing list that omitted `skill-routing-eval`. |
| 2026-09-20 | `system-design-navigation-eval` added (SR-13, since retired)                                                 | 5    | 0    | 0         | No collisions.                                               |
| 2026-09-21 | /feature Stage 6 retro and related edits                                                                     | 6    | 0    | 1         | One near-miss.                                               |
| 2026-09-21 | Re-check after the independent read                                                                          | 2    | 0    | 1         | Near-miss persisted, graded ambiguous.                       |
| 2026-09-23 | Process hardening; `feature-review-eval` added (SR-14)                                                       | 7    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Commits 6197731, 487b849                                                                                     | 8    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Triage-first rule for bugs (4b0b19f)                                                                         | 8    | 0    | 0         | SR-05 twice.                                                 |
| 2026-09-24 | Pre-merge of PR #11, all scenarios                                                                           | 14   | 0    | 0         | No regression.                                               |
| 2026-09-25 | CLAUDE.md "How changes land"                                                                                 | 4    | 1    | 0         | SR-08 failed: no doc covered dependency updates.             |
| 2026-09-25 | SR-08 re-check after the dependency-update note                                                              | 3    | 0    | 0         | Fix held twice.                                              |
| 2026-09-28 | Case studies replace question pages (SR-15..17)                                                              | 16   | 0    | 0         | All live scenarios.                                          |
| 2026-09-29 | CLAUDE.md split into a router plus docs                                                                      | 4    | 0    | 0         | Scoped run.                                                  |
| 2026-09-29 | At a glance and role splitting                                                                               | 5    | 0    | 0         | No regression.                                               |
| 2026-09-29 | Finding triage and slimming (branch chore/review-triage)                                                     | 4    | 0    | 0         | Scoped run.                                                  |
| 2026-09-29 | add-case-study batch mode (branch chore/harness-practices)                                                   | 1    | 0    | 0         | SR-15 only; prompt refreshed.                                |
| 2026-09-30 | DSA tab (PR #31): add-dsa-entry, content-audit, add-topic, CLAUDE.md                                         | 7    | 0    | 0         | Scoped run; SR-06 prompt refreshed.                          |
| 2026-10-01 | Harness pass (branch chore/harness-pass), all scenarios                                                      | 17   | 0    | 0         | Full run.                                                    |
| 2026-10-01 | docs-audit description gains friction aggregation                                                            | 1    | 0    | 0         | SR-09 only: still routes to `docs-audit`.                    |
| 2026-10-01 | SR-17 prompt refreshed (the width guard already exists)                                                      | 1    | 0    | 0         | Now asks for a node-count limit; routes to `/feature`.       |
| 2026-10-02 | Batch-mode edits in add-dsa-entry and add-case-study (#44, #46)                                              | 4    | 0    | 0         | SR-15 to SR-18; SR-18 prompt refreshed (heap now exists).    |
| 2026-10-03 | /feature Stage 2 and re-run edits; add-dsa-entry ordering rule (#53)                                         | 5    | 0    | 0         | Scoped run; SR-17 prompt refreshed (sticky nav now exists).  |
| 2026-10-04 | add-dsa-entry step 2: the randomized-test convention                                                         | 2    | 0    | 0         | SR-17 and SR-18; SR-17 prompt refreshed again.               |
| 2026-10-04 | /feature Stage 1 UI-criteria bullet; Stage 6 severity-first retro                                            | 4    | 0    | 0         | Scoped run: SR-01, SR-05, SR-07, SR-17.                      |
| 2026-10-04 | /feature: where a guard's planted cases live (test split)                                                    | 1    | 0    | 0         | SR-01 only; the edit can't change routing.                   |
| 2026-10-04 | /feature Stage 1 guard edits (#63, #64); docs-audit gate fixes                                               | 2    | 0    | 0         | SR-01 and SR-18; logs #64's unlogged SR-01 pass too.         |
| 2026-10-04 | Friction follow-ups: /feature Stages 1, 4, 6; docs-audit; the hook                                           | 2    | 0    | 0         | SR-01 and SR-09.                                             |
| 2026-10-05 | Five-minute content: add-case-study, add-dsa-entry, content-audit                                            | 8    | 0    | 0         | SR-19 and SR-20 added; SR-16's reasoning refreshed.          |
| 2026-10-05 | five-minute-templates retro: both skills' Stage 2 point to the docs                                          | 2    | 0    | 0         | SR-15 and SR-18; bodies only, descriptions unchanged.        |
| 2026-10-06 | Retire the template switch: three skill descriptions, SR-19 retired                                          | 6    | 0    | 0         | SR-06, 11, 15, 16, 18, 20; SR-20 prompt now a BT+BST merge.  |
| 2026-10-06 | Dedupe canonical facts: three eval descriptions, content skills, /feature Stage 4                            | 9    | 0    | 0         | SR-01, 09, 10, 12, 14, 15, 16, 18, 20.                       |
| 2026-10-06 | Harness follow-ups: /feature Stages 1 and 5, PowerShell-write hook                                           | 4    | 0    | 0         | SR-01, 05, 07, 17; run at Stage 5 by the new rule.           |
| 2026-10-07 | Catalog standard: add-topic rewrite and batch modes, content-audit exclusion                                 | 5    | 0    | 0         | SR-02, 04, 06, 11, 16 at Stage 5.                            |
| 2026-10-07 | Catalog batch 9: add-topic loses PENDING steps, batch drafters run all of `src`                              | 4    | 0    | 0         | SR-02, 04, 06, 11; SR-06 prompt refreshed.                   |
| 2026-10-07 | Docs audit after the catalog rewrite: add-topic, add-dsa-entry, the SDLC hook                                | 5    | 0    | 0         | SR-02, 04, 14, 18, 20.                                       |
| 2026-10-07 | Audit decisions: batch self-check moved to content-review.md, five skills point to it                        | 5    | 0    | 0         | SR-02, 09, 10, 15, 18.                                       |
| 2026-10-07 | Drift and rewrite guards: add-topic names `links:inbound`, eval skills name `check:eval-premises`, hook rule | 5    | 0    | 0         | SR-02, 06, 10, 12, 14 at Stage 5.                            |
| 2026-10-07 | Docs audit after #107: docs-audit gate, eval skills' final step, hook header                                 | 4    | 0    | 0         | SR-09, 10, 12, 14.                                           |
| 2026-10-07 | Friction fixes: /feature guard steps, content-review.md self-check and batch confirmation                    | 2    | 0    | 0         | SR-01 and SR-02.                                             |
| 2026-10-07 | Named companies rule: add-topic and add-case-study point to the Writing Standard                             | 2    | 0    | 0         | SR-02 and SR-15.                                             |
| 2026-10-07 | SDLC.md's eval section cut to a pointer to evals/README.md                                                   | 3    | 0    | 0         | SR-10, 12, 14.                                               |
| 2026-10-07 | Content skills' Stage 2 points to their docs; verification.md links the premise forms                        | 3    | 0    | 0         | SR-02, 15, 18.                                               |
| 2026-10-09 | SR-07 narrowed to the cards (topic-read-time built the topic page's label)                                   | 1    | 0    | 0         | SR-07 only; still routes to `/feature`.                      |

## Latest run: 2026-10-09, SR-07 narrowed to the cards

- **Run by:** Claude (the orchestrating session), with one fresh `general-purpose` agent.
- **Trigger:** the `topic-read-time` change (docs/specs/topic-read-time.md) added the "N min read" label to topic pages, so SR-07's prompt now asks only for the label on the topic, case-study and DSA cards.
- **Scope:** SR-07, the only scenario whose prompt changed.

| ID    | Routing decision | Reasoning (one line)                                                                   | Grade |
| ----- | ---------------- | -------------------------------------------------------------------------------------- | ----- |
| SR-07 | `/feature`       | A nontrivial app change across the loaders and the card UI on four pages, not content. | PASS  |
