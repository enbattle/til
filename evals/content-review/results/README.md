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
| 2026-10-07 | Friction fixes: drafter rule-of-thumb self-check before Stage 3, batch fix confirmation          | 2    | 0    | 0         | CR-01 and the CR-05 control.                                               |

## Latest run: 2026-10-07, friction fixes from the 203-row aggregation

- **Run by:** Claude (the orchestrating session), with one fresh `general-purpose` reviewer per scenario, given the Stage 3 instruction from docs/content-review.md filled in for add-topic and the draft as a neutrally named scratch file.
- **Trigger:** branch chore/friction-fixes-203 edited docs/content-review.md: a rule-of-thumb self-check by the drafter before Stage 3, and batch mode's fix confirmation. The reviewer instruction itself is unchanged.
- **Scope:** CR-01 (a plant) and CR-05 (the control), since the instruction didn't change.

| ID    | Planted violation         | Caught                                                  | Grade |
| ----- | ------------------------- | ------------------------------------------------------- | ----- |
| CR-01 | "hash function" undefined | Yes, ranked first (Moderate).                           | PASS  |
| CR-05 | none (control)            | Nothing blocking; two low notes, both true of the text. | PASS  |
