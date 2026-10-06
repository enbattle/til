# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                          | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ---------------------------------------------------------------- | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                            | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                             | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed             | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                               | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                             | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added                    | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                                   | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                            | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard              | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added             | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes                           | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits             | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |
| 2026-10-05 | Five-minute content standard; CS and DS fixtures rewritten       | 12   | 0    | 0         | All scenarios, CS-04 new; CS-03 and CS-04 re-run after a base fix.         |
| 2026-10-06 | Stage 3 now points at every Writing Standard bullet              | 12   | 0    | 0         | Full run; controls drew only true findings.                                |
| 2026-10-07 | Catalog standard in the Writing Standard and add-topic checklist | 5    | 0    | 0         | CR-* only; fixtures now lag the standard (follow-up).                      |

## Latest run: 2026-10-07, catalog standard

- **Run by:** Claude (the orchestrating session).
  - A builder assembled the CR packets in shuffled, neutral folders, with add-topic's checklist read fresh, including the new catalog-standard item.
  - One fresh reviewer per packet.
- **Trigger:** branch feat/catalog-standard.
  - The Writing Standard gained "Catalog topics": a 1,000-word cap, the lecturer voice, one running example, a closing **Rule of thumb.**, and the title rule.
  - add-topic's checklist now holds that standard.
  - CR-01..05 each gained a closing rule of thumb.
- **Scope:** CR-* only, since the change touches add-topic, not the case-study or DSA review.

| ID    | Planted violation                        | Caught?                                                                    | Grade |
| ----- | ---------------------------------------- | -------------------------------------------------------------------------- | ----- |
| CR-01 | "hash function" never defined            | Yes: named among the undefined terms (finding 4 of 7)                      | PASS  |
| CR-02 | AI-patterned tone                        | Yes: the stacked intensifiers, "not just X — it's Y" and "the real X"      | PASS  |
| CR-03 | over-explained figurative phrase         | Yes: the top finding                                                       | PASS  |
| CR-04 | temperature 0 called fully deterministic | Yes: the top finding, critical                                             | PASS  |
| CR-05 | none (control)                           | One Medium true of the text (the running example drops halfway), plus Lows | PASS  |

**Notes:**

- **The fixtures lag the new standard.** CR-01..04 are ~250-word drafts with no running example and no lecturer voice. Under the new catalog standard, each now draws several true findings besides its planted one. Every planted violation was still named, but no longer always first: CR-01's was 4th of 7.
- **The control isn't clean.** CR-05 drew a Medium because its example drops halfway.
- **Follow-up:** upgrade CR-01..05 to the catalog standard (600–900 words, one running example, the voice), so each planted violation is again the only problem.
- **CR-02's "release flag" wording** drew an undefined-term finding, as the spec's known limitations predicted.
