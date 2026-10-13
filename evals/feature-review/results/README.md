# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what Stage 2 of [Running any eval](../../README.md#running-any-eval) lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                                                                          | Pass | Fail | Ambiguous | Note                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------------ |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                                                                             | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.                |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                                                                          | 2    | 0    | 0         | Top finding both runs.                                             |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                                                                          | 8    | 0    | 0         | No rotation.                                                       |
| 2026-09-24 | FR-05 added (subtler defect)                                                                                                     | 3    | 0    | 0         | Ceiling effect persists.                                           |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer                                                  | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical.             |
| 2026-09-29 | New triage scenarios FR-06/FR-07 (branch chore/harness-practices)                                                                | 4    | 0    | 0         | Triage only; both outcomes matched twice.                          |
| 2026-10-01 | Lint went strict (FR-03 rotated), FR-01 rotated, Stage 4 wording for DSA                                                         | 13   | 1    | 0         | FR-07 split.                                                       |
| 2026-10-01 | FR-07 finding replaced (unreachable by construction)                                                                             | 2    | 0    | 0         | Both proposed Reject, each with a reproduction.                    |
| 2026-10-04 | Escaped defect (FR-08 added); Stage 4 guard sentence edited (FR-02 rotated)                                                      | 16   | 0    | 0         | Every planted defect was each review's top finding.                |
| 2026-10-06 | Stage 4 Writing Standard clause (FR-05 rotated, FR-04 control rebuilt)                                                           | 16   | 0    | 0         | Old FR-04 drifted (voided, 2 runs); new control clean twice.       |
| 2026-10-07 | FR-06 re-grounded (its summary premise was gone); Stage 0 checks content premises                                                | 2    | 0    | 0         | FR-06 only, twice; both proposed Fix with a test from real titles. |
| 2026-10-13 | NON_NEGOTIABLES #6 (#119), /feature Stages 1-3 edits, eval skill cut to its own parts, FR-02/03/04/05 re-anchored; FR-01 rotated | 16   | 0    | 0         | All scenarios, twice each; both runs agreed on every scenario.     |

## Latest run: 2026-10-13, after the cleanup and docs dedupe

- **Run by:** Claude (the orchestrating session). One helper agent rotated FR-01 and assembled each scenario's brief (spec, diff, the NON_NEGOTIABLES path and Stage 4's reviewer or triage instruction, copied verbatim) into a neutrally named file; 16 fresh `general-purpose` agents then ran, two per scenario, each given only its brief's path.
- **Trigger:** NON_NEGOTIABLES #6 changed in #119 (check:raw-html as a name search plus react/no-danger); /feature Stage 1 (guard inventory), Stage 2 (removed-test mutation clause) and Stage 3 (listed mutations) edits; the eval skill cut to its own parts; FR-02/03/04/05 diffs re-anchored to the code from #123-#124.
- **Rotation:** FR-01's planted defect (rotated for the NON_NEGOTIABLES edit) is now a quoted value cut at its first inner quote (`'Don't panic'` parses as `Don`); before, the quote check ran on the raw value comment included.
- **Scope:** all scenarios, twice.

| ID    | Run | Finding summary                                                                                                                                | Grade |
| ----- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-01 | A   | High: lazy quote regex truncates values with an inner quote, e.g. `'Don't panic'` → `Don`; checked against all 121 files (none affected today) | PASS  |
| FR-01 | B   | High: same truncation, plus text after a closing quote dropped                                                                                 | PASS  |
| FR-02 | A   | High: `target="_blank"` without `rel="noreferrer"` breaks NON_NEGOTIABLES #7                                                                   | PASS  |
| FR-02 | B   | High: same, citing the other new-tab links that set it                                                                                         | PASS  |
| FR-03 | A   | High: `queryRef` never updated, so Escape always closes                                                                                        | PASS  |
| FR-03 | B   | High: same stale ref; also an existing test that only passes because of the bug                                                                | PASS  |
| FR-04 | A   | Clean control: one true Low (no rendered test for the empty-section count)                                                                     | PASS  |
| FR-04 | B   | Clean control: nothing at Medium or above; one true Low                                                                                        | PASS  |
| FR-05 | A   | High: `<summary>` not in `FOCUSABLE_SELECTOR`, so the trap skips it and Tab can leave the dialog                                               | PASS  |
| FR-05 | B   | High: same, traced through `useModal` → `useFocusTrap`                                                                                         | PASS  |
| FR-06 | A   | Fix with a test: 13 real `vs.` titles truncate the description (reproduced)                                                                    | PASS  |
| FR-06 | B   | Fix with a test: same evidence                                                                                                                 | PASS  |
| FR-07 | A   | Reject: `checkFields` throws at import for a missing summary (reproduced)                                                                      | PASS  |
| FR-07 | B   | Reject: same, reproduced by deleting a real summary line                                                                                       | PASS  |
| FR-08 | A   | High: the strip's height isn't in `scroll-padding-top` from `xl`, hiding focus (WCAG 2.4.11)                                                   | PASS  |
| FR-08 | B   | High: same, with the scroll-spy and hash-hold knock-ons                                                                                        | PASS  |

Notes:

- FR-05 now reaches its cause through `useModal` (the UI dedupe moved Escape and initial focus there); both runs still traced it two hops from the diff.
- FR-02's hunk header is six lines off the current file; it still applies at an offset (one reviewer noticed). FR-01 hunk 3, FR-06, FR-07 hunk 2 and FR-08 apply at offsets too.
