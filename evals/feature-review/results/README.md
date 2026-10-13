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
| 2026-10-13 | DSA tab removed: Stage 4 reviewer and triage instructions edited; FR-03 rotated                                                  | 16   | 0    | 0         | All scenarios, twice.                                              |

## Latest run: 2026-10-13, DSA tab removed

- **Run by:** Claude (the orchestrating session). One helper agent rotated FR-03, re-read every diff against the branch and wrote each scenario's brief (spec, diff and, for triage, the finding) under neutral names; 16 fresh `general-purpose` agents then reviewed or triaged, each given the NON_NEGOTIABLES path and Stage 4's reviewer or triage instruction, copied verbatim.
- **Trigger:** `docs/specs/remove-dsa-tab.md` edited /feature's Stage 4 reviewer and finding-triage instructions (the DSA paths and docs/dsa.md dropped; the Writing Standard section is now "Case studies").
- **Rotation:** FR-03's planted defect, a stale `queryRef` since 2026-10-01, is now an Escape the input handles with `preventDefault()` while `useModal`'s window listener still closes the dialog. The diff's test uses a mock `onClose`, so it passes.
- **Drift:** hunk headers refreshed for FR-02, FR-06, FR-07 (hunk 2) and FR-08 after the branch moved lines; no planted defect changed.
- **Scope:** all scenarios, twice.

| ID    | Run | Finding summary                                                                                       | Grade |
| ----- | --- | ----------------------------------------------------------------------------------------------------- | ----- |
| FR-01 | A   | High: lazy quote regex cuts `'What's a CRDT?'` to `What`; all 93 files compared old vs new            | PASS  |
| FR-01 | B   | High: same truncation, four triggers run in node                                                      | PASS  |
| FR-02 | A   | High: `target="_blank"` without `rel="noreferrer"` breaks NON_NEGOTIABLES #7                          | PASS  |
| FR-02 | B   | High: same, citing MarkdownRenderer and Diagram, which set it                                         | PASS  |
| FR-03 | A   | High: `useModal`'s window listener ignores `defaultPrevented`, so the first Escape closes; reproduced | PASS  |
| FR-03 | B   | High: same, reproduced with `toHaveBeenCalledTimes(0)`; second High on the mock-based test            | PASS  |
| FR-04 | A   | Clean control: two true Lows (count position and the empty case untested)                             | PASS  |
| FR-04 | B   | Clean control: same two true Lows                                                                     | PASS  |
| FR-05 | A   | High: `<summary>` not in `FOCUSABLE_SELECTOR`; Tab can't reach it and escapes from it                 | PASS  |
| FR-05 | B   | High: same, both triggers traced                                                                      | PASS  |
| FR-06 | A   | Fix with a test: 13 real `vs.` titles cut to "SQL vs." (reproduced)                                   | PASS  |
| FR-06 | B   | Fix with a test: same evidence                                                                        | PASS  |
| FR-07 | A   | Reject: `checkFields` throws at import for a missing summary (reproduced in a worktree)               | PASS  |
| FR-07 | B   | Reject: same, from the loader code and docs                                                           | PASS  |
| FR-08 | A   | High: the strip's height isn't in xl `scroll-padding-top`, hiding focus (WCAG 2.4.11)                 | PASS  |
| FR-08 | B   | High: same, with the scroll-spy knock-on                                                              | PASS  |

Notes:

- The rotated FR-03 was caught at High by both runs, and both also flagged the test that can't see the bug.
- FR-02 and FR-08 runs each added a Medium/High that the diff ships no tests; true of those fixtures (their diffs never carried tests) and not graded.
- Two reviewers left scratch copies under the session scratchpad and one an extra worktree, all outside the repo; none touched the working tree.
