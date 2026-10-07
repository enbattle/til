# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                                          | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------ | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                                                            | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                                                             | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed                                             | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                                                               | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                                                             | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added                                                    | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                                                                   | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                                                            | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard                                              | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added                                             | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes                                                           | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits                                             | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |
| 2026-10-05 | Five-minute content standard; CS and DS fixtures rewritten                                       | 12   | 0    | 0         | All scenarios, CS-04 new; CS-03 and CS-04 re-run after a base fix.         |
| 2026-10-06 | Stage 3 now points at every Writing Standard bullet                                              | 12   | 0    | 0         | Full run; controls drew only true findings.                                |
| 2026-10-07 | Catalog standard in the Writing Standard and add-topic checklist                                 | 5    | 0    | 0         | CR-* only; fixtures now lag the standard (follow-up).                      |
| 2026-10-07 | CR-01..05 fixtures brought to the catalog standard                                               | 5    | 0    | 0         | CR-01 and CR-05 re-run once; CR-01 plant caught but ranked third.          |
| 2026-10-07 | add-topic checklist (3) sharpened: rule holds for every example, figures follow from the example | 5    | 0    | 0         | All plants caught; CR-01 now first; CR-05 clean.                           |
| 2026-10-07 | add-topic checklist (4) gains inbound links (`links:inbound`)                                    | 5    | 0    | 0         | All plants caught and ranked first; CR-05 clean.                           |

## Latest run: 2026-10-07, drift and rewrite guards

- **Run by:** Claude (the orchestrating session), with one fresh `general-purpose` reviewer per scenario. Each reviewer got the Stage 3 instruction from docs/content-review.md, filled in for add-topic, and the draft as a neutrally named scratch file in a shuffled folder.
- **Trigger:** branch feat/drift-and-rewrite-guards. add-topic's checklist item (4) now also asks that nothing an inbound link relies on (`npm run links:inbound`) was cut or renamed. The CR drafts are new topics, so item (4) was "none" for each, as in a real run.
- **Scope:** CR-01..05.

| ID    | Planted violation                        | Caught                                                            | Grade |
| ----- | ---------------------------------------- | ----------------------------------------------------------------- | ----- |
| CR-01 | "hash function" undefined                | Yes, ranked first (Medium-low); the other notes were Low or nits. | PASS  |
| CR-02 | AI-patterned tone                        | Yes, all three parts, as three Highs ranked first.                | PASS  |
| CR-03 | over-explained analogy                   | Yes, as a must-fix, ranked first.                                 | PASS  |
| CR-04 | temperature 0 called fully deterministic | Yes, as a blocking finding, ranked first.                         | PASS  |
| CR-05 | none (control)                           | Nothing blocking; three minor notes, each true of the text.       | PASS  |

**Notes:**

- **CR-01 drew a second, true finding:** the draft says app servers "must" share one filter, then says the database's uniqueness check catches a wrong "definitely not" anyway. It ranks below the plant.
- **CR-05's notes are polish:** `^0.0.3` is the one figure not taken from the running example, "resolves" is undefined, and the Dependabot claim is slightly broad. None is a false claim.
