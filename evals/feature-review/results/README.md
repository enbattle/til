# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `feature-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                         | Pass | Fail | Ambiguous | Note                                                   |
| ---------- | ------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------ |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                            | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.    |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                         | 2    | 0    | 0         | Top finding both runs.                                 |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                         | 8    | 0    | 0         | No rotation.                                           |
| 2026-09-24 | FR-05 added (subtler defect)                                                    | 3    | 0    | 0         | Ceiling effect persists.                               |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical. |
| 2026-09-29 | New triage scenarios FR-06/FR-07 (branch chore/harness-practices)               | 4    | 0    | 0         | Triage only; both outcomes matched twice.              |
| 2026-10-01 | Lint went strict (FR-03 rotated), FR-01 rotated, Stage 4 wording for DSA        | 13   | 1    | 0         | FR-07 split.                                           |
| 2026-10-01 | FR-07 finding replaced (unreachable by construction)                            | 2    | 0    | 0         | Both proposed Reject, each with a reproduction.        |
| 2026-10-04 | Escaped defect (FR-08 added); Stage 4 guard sentence edited (FR-02 rotated)     | 16   | 0    | 0         | Every planted defect was each review's top finding.    |

## Latest run: 2026-10-04, escaped defect and Stage 4 edit

Run by: self
Trigger: two of evals/README's rows. A defect escaped a `/feature` review: the `on-this-page-bar` run's sticky bar hid focused elements (WCAG 2.4.11), fixed by `docs/specs/focus-not-obscured.md`; FR-08 plants the same kind of defect. And Stage 4's reviewer instruction changed: a new guard is now tried every way the reviewer can find, with the misses reported as one finding that lists each vector. FR-02 was rotated for it, from an unnamed icon button to a new-tab link without `rel="noreferrer"` (NON_NEGOTIABLES #7), since FR-08 now covers #1. FR-02's hunk header was updated to the current `TopicPage.tsx` beforehand. All eight scenarios ran twice, from prompts built from the live `scenarios.md` and Stage 4 text.

| ID    | Run | Finding summary or proposed outcome                                                     | Grade |
| ----- | --- | --------------------------------------------------------------------------------------- | ----- |
| FR-01 | 1   | Medium, top: quoted value plus comment cut inside the quotes; mirror symptom named      | PASS  |
| FR-01 | 2   | Medium, top: same, both symptoms                                                        | PASS  |
| FR-02 | 1   | High, top: new-tab link without `rel="noreferrer"`, NN #7                               | PASS  |
| FR-02 | 2   | High, top: same                                                                         | PASS  |
| FR-03 | 1   | High, top: `queryRef` never updated, so the first Escape closes                         | PASS  |
| FR-03 | 2   | High, top: same                                                                         | PASS  |
| FR-04 | 1   | Nothing flagged; NaN input noted as outside the spec                                    | PASS  |
| FR-04 | 2   | Nothing flagged; same note                                                              | PASS  |
| FR-05 | 1   | Critical, top: `searchContent`'s default limit of 8 means "+N more" never renders       | PASS  |
| FR-05 | 2   | Critical, top: same                                                                     | PASS  |
| FR-06 | 1   | Fix with a test; three real `vs. ` summaries, reproduced                                | PASS  |
| FR-06 | 2   | Fix with a test; same evidence                                                          | PASS  |
| FR-07 | 1   | Reject; the loader throws on a missing summary first, reproduced in a worktree          | PASS  |
| FR-07 | 2   | Reject; same reproduction                                                               | PASS  |
| FR-08 | 1   | High, top: from `xl` the strip covers jumps and focus; `scroll-padding-top` excludes it | PASS  |
| FR-08 | 2   | High, top: same, WCAG 2.4.11 and NN #1, plus scroll-spy and hash-hold knock-ons         | PASS  |

Notes: no run disagreed with its pair. The ceiling effect persists: every planted defect was each review's top finding, as in every run since 2026-09-23. FR-05's planned rotation (a cause several hops from the diff) is still open. FR-08 is the first scenario taken from a real escaped defect; both runs found it from DESIGN.md's checklist item and `index.css` without a browser.
