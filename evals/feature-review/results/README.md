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

## Latest run: 2026-10-01, FR-07 finding replaced

Run by: self
Trigger: the rotation run before it (the trend row above) split FR-07 one run each way, a sign the scenario was ambiguous rather than the reviewer wrong. FR-07's planted finding was replaced with one that is unreachable by construction (PR #40), and only FR-07 was re-run.

| ID    | Run | Proposed outcome                                    | Grade |
| ----- | --- | --------------------------------------------------- | ----- |
| FR-07 | 1   | Reject, with a reproduction showing it can't happen | PASS  |
| FR-07 | 2   | Reject, with a reproduction showing it can't happen | PASS  |

Notes: the decision the rotation run left for the user is settled by this re-run. That run's full log, with the other scenarios, is in git history.
