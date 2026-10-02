# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                              | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ---------------------------------------------------- | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                 | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                   | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                 | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added        | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                       | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard  | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes               | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |

## Latest run: 2026-10-02, after the DSA tab was completed

Run by: self
Trigger: PRs #44 and #46 edited `docs/content-review.md`'s Batch mode (not its Stage 3 instruction) and the `add-dsa-entry` and `add-case-study` batch-mode bullets (not their checklists), so by Stage 0 no scenario's inputs changed. One input did: the DSA tab grew from 3 to 42 entries, and that list is what the DS-* reviewer gets for its near-duplicate check. Scope: DS-01 to DS-03.
Fixture note: the DS-* base is a Prefix Sums entry, and `prefix-sums` is now a published entry. A review handed the base with that entry in its existing items would rightly report a near-duplicate, which would confound every grade. For this run each reviewer was told the draft is a rewrite of the published entry and that entry was left out of the existing items. Rebasing the DS-* fixtures onto an entry that doesn't exist is open.

| ID    | Planted violation                                        | Caught?                                                                                                      | Grade |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| DS-01 | TypeScript loop stops one short; weakened TS test passes | Yes: the loop bound (with `[0, 3, 4, 8, 9, 0]` and the failing ranges), and that the TS tests can't catch it | PASS  |
| DS-02 | The `range_sum` paragraph narrates instead of explaining | Yes: ranked first, naming the missing "why `right + 1`" and the leading 0 that lets `left = 0` work          | PASS  |
| DS-03 | None (control)                                           | No defect; three Lows, all true of the text (prerequisites, "most common bug", thinner TS tests)             | PASS  |

Notes: DS-02's review also flagged two terms used before they are defined and the "most common bug" superlative, both true of the base. Two reviews independently suggest a TypeScript counterpart to Python's single-element and whole-array test: a real gap in the base, not a planted one.
