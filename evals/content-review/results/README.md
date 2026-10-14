# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what Stage 2 of [Running any eval](../../README.md#running-any-eval) lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                                                                                              | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                                                                                                                | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                                                                                                                 | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed                                                                                                 | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                                                                                                                   | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                                                                                                                 | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added                                                                                                        | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                                                                                                                       | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                                                                                                                | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard                                                                                                  | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added                                                                                                 | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes                                                                                                               | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits                                                                                                 | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |
| 2026-10-05 | Five-minute content standard; CS and DS fixtures rewritten                                                                                           | 12   | 0    | 0         | All scenarios, CS-04 new; CS-03 and CS-04 re-run after a base fix.         |
| 2026-10-06 | Stage 3 now points at every Writing Standard bullet                                                                                                  | 12   | 0    | 0         | Full run; controls drew only true findings.                                |
| 2026-10-07 | Catalog standard in the Writing Standard and add-topic checklist                                                                                     | 5    | 0    | 0         | CR-* only; fixtures now lag the standard (follow-up).                      |
| 2026-10-07 | CR-01..05 fixtures brought to the catalog standard                                                                                                   | 5    | 0    | 0         | CR-01 and CR-05 re-run once; CR-01 plant caught but ranked third.          |
| 2026-10-07 | add-topic checklist (3) sharpened: rule holds for every example, figures follow from the example                                                     | 5    | 0    | 0         | All plants caught; CR-01 now first; CR-05 clean.                           |
| 2026-10-07 | add-topic checklist (4) gains inbound links (`links:inbound`)                                                                                        | 5    | 0    | 0         | All plants caught and ranked first; CR-05 clean.                           |
| 2026-10-07 | Friction fixes: drafter rule-of-thumb self-check before Stage 3, batch fix confirmation                                                              | 2    | 0    | 0         | CR-01 and the CR-05 control.                                               |
| 2026-10-07 | Writing Standard: one general Named companies rule                                                                                                   | 3    | 0    | 0         | Controls only: CR-05, CS-03, DS-03; CS base order moved 17 to 99.          |
| 2026-10-13 | Docs dedupe (content-review.md, content-audit, add-dsa-entry pointers, Writing Standard line), NON_NEGOTIABLES #6, DS fixture moved to region fences | 12   | 0    | 0         | All scenarios; first run with region fences in the DS base.                |
| 2026-10-13 | add-dsa-entry checklist item (2): plain tutorial-style code; DS base moved from Counter to dict                                                      | 3    | 0    | 0         | DS-01, DS-02, DS-03; the new item flagged the base's Counter, now fixed.   |
| 2026-10-13 | DSA tab removed (docs/specs/remove-dsa-tab.md): Writing Standard section renamed, code bullet cut; DS-* retired                                      | 9    | 0    | 0         | All live scenarios.                                                        |
| 2026-10-13 | add-case-study checklist item (5), named-company restatement, removed                                                                                | 4    | 0    | 0         | CS-* only.                                                                 |

## Latest run: 2026-10-13, add-case-study checklist item (5) removed

- **Run by:** Claude (the orchestrating session), with 4 fresh `general-purpose` reviewers.
- **Trigger:** add-case-study's Stage 3 checklist lost item (5), the named-company restatement (the Writing Standard's "Named companies" bullet is the home, and the reviewer holds every bullet); items renumbered. The Writing Standard edits on the same branch change pointers, not rules.
- **Scope:** CS-* only (one skill's checklist).

| ID    | Planted violation                      | Caught?                                                         | Grade |
| ----- | -------------------------------------- | --------------------------------------------------------------- | ----- |
| CS-01 | Read rate off by ten                   | Yes, top finding (High), recomputed                             | PASS  |
| CS-02 | Contents decision names no alternative | Yes, top finding (High)                                         | PASS  |
| CS-03 | None (control)                         | All figures confirmed; findings true (IPv6 rate limits, ranges) | PASS  |
| CS-04 | "Nobody can ever guess a valid link"   | Yes, top finding (High), from the page's own odds               | PASS  |

Notes: all four reviewers again raised the base draft's true gaps (365 million is a ceiling, 200 bytes is unexplained, the ID decision doesn't answer the URL shortener's ranges rule). A named-company claim is not planted in any scenario, so this run shows the checklist edit didn't weaken the four planted catches, not that a named-company claim is still caught.
