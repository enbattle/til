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

## Latest run: 2026-10-13, DSA tab removed

- **Run by:** Claude (the orchestrating session), with 9 fresh `general-purpose` reviewers.
- **Trigger:** `docs/specs/remove-dsa-tab.md` renamed the Writing Standard's "Case studies and DSA entries" section to "Case studies", deleted its "Code explains itself" bullet and the "a problem" framing, and edited `docs/content-review.md` and the add-case-study checklist's reference to that section. The DS-* scenarios are retired.
- **Scope:** every live scenario (CR-01 to CR-05, CS-01 to CS-04), since the Writing Standard and the shared Stage 3 instruction changed.

| ID    | Planted violation                                 | Caught?                                                                       | Grade |
| ----- | ------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| CR-01 | "Hash function" never defined                     | Yes, top finding (Medium)                                                     | PASS  |
| CR-02 | "Not just X — it's Y" closer, filler intensifiers | Yes, both High                                                                | PASS  |
| CR-03 | Over-explained "rubber duck" paragraph            | Yes, top finding, quoting "To be clear, the duck…"                            | PASS  |
| CR-04 | Temperature 0 is fully deterministic              | Yes, blocking, with provider documentation                                    | PASS  |
| CR-05 | None (control)                                    | Three true Low polish notes; no false defect                                  | PASS  |
| CS-01 | Read rate off by ten                              | Yes, top finding (High), recomputed                                           | PASS  |
| CS-02 | Contents decision names no alternative            | Yes, top finding (High)                                                       | PASS  |
| CS-03 | None (control)                                    | All figures confirmed; findings true (expiry vs lifecycle rule, rule wording) | PASS  |
| CS-04 | "Nobody can ever guess a valid link"              | Yes, top finding (High), from the page's own odds                             | PASS  |

Notes: three of the four case-study reviewers independently raised the same true gaps in the base draft: the 200-byte metadata figure isn't derived from the schema, "365 million live pastes" is an upper bound stated as a fact, and the byte-cap follow-up ignores the botnet from the line above. Two raised the expiry decision's unargued lifecycle-rule alternative. These are real polish gaps in the fixture, not false positives; worth a fixture touch-up if they start outranking a planted problem.
