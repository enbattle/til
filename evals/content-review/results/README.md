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

## Latest run: 2026-10-13, after the cleanup and docs dedupe

- **Run by:** Claude (the orchestrating session). One helper agent assembled each reviewer's inputs into a neutrally named brief file (draft files, Writing Standard, the NON_NEGOTIABLES path, existing items, the filled Stage 3 instruction), then 12 fresh `general-purpose` reviewers ran in parallel, each given only its brief's path.
- **Trigger:** the docs-dedupe branch (docs/content-review.md, content-audit pointing at the owning checklists, add-dsa-entry pointing at docs/dsa.md, the Writing Standard's topic-structure line), NON_NEGOTIABLES #6 from #119, and the DS base moved to region fences.
- **Scope:** all scenarios.

| ID    | Planted violation                                      | Caught?                                               | Grade |
| ----- | ------------------------------------------------------ | ----------------------------------------------------- | ----- |
| CR-01 | "hash function" used undefined                         | Yes, as its first finding (rated Minor)               | PASS  |
| CR-02 | "not just X — it's Y" closer and stacked intensifiers  | Yes, High                                             | PASS  |
| CR-03 | Over-explained "rubber duck" paragraph                 | Yes, must-fix                                         | PASS  |
| CR-04 | Temperature 0 called fully deterministic               | Yes, blocking, with the floating-point/batching cause | PASS  |
| CR-05 | None (control)                                         | Two optional nits, both true of the text              | PASS  |
| CS-01 | Read rate off by ten                                   | Yes, High, recomputed                                 | PASS  |
| CS-02 | A decision that names no losing alternative            | Yes, its first finding                                | PASS  |
| CS-03 | None (control)                                         | Four Lows, all true of the draft                      | PASS  |
| CS-04 | "nobody can ever guess a valid link"                   | Yes, High, with the page's own numbers                | PASS  |
| DS-01 | TS `buildPrefix` drops the last element; tests miss it | Yes, blocking, with failing inputs and test fixes     | PASS  |
| DS-02 | Walkthrough paragraph that only narrates               | Yes, Medium                                           | PASS  |
| DS-03 | None (control)                                         | Six small findings, all true of the entry             | PASS  |

Notes:

- CR-01's planted gap was caught but rated Minor; the grade asks only that it be named.
- Several reviewers independently noticed the same real gaps in the shared bases (the CS base has no availability target and its per-address byte cap doesn't hold against its own botnet; the DS base uses "subarray" undefined and says "positive" where "non-negative" is meant). They are true of the drafts, so no control failed on them; worth fixing in the fixtures so they stop competing with the planted lines.
- The region-fenced DS base worked: every DS reviewer read the code from the code files and mapped region fences without help.
