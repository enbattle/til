# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `feature-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                           | Pass | Fail | Ambiguous | Note                                                               |
| ---------- | --------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------------ |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                              | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.                |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                           | 2    | 0    | 0         | Top finding both runs.                                             |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                           | 8    | 0    | 0         | No rotation.                                                       |
| 2026-09-24 | FR-05 added (subtler defect)                                                      | 3    | 0    | 0         | Ceiling effect persists.                                           |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer   | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical.             |
| 2026-09-29 | New triage scenarios FR-06/FR-07 (branch chore/harness-practices)                 | 4    | 0    | 0         | Triage only; both outcomes matched twice.                          |
| 2026-10-01 | Lint went strict (FR-03 rotated), FR-01 rotated, Stage 4 wording for DSA          | 13   | 1    | 0         | FR-07 split.                                                       |
| 2026-10-01 | FR-07 finding replaced (unreachable by construction)                              | 2    | 0    | 0         | Both proposed Reject, each with a reproduction.                    |
| 2026-10-04 | Escaped defect (FR-08 added); Stage 4 guard sentence edited (FR-02 rotated)       | 16   | 0    | 0         | Every planted defect was each review's top finding.                |
| 2026-10-06 | Stage 4 Writing Standard clause (FR-05 rotated, FR-04 control rebuilt)            | 16   | 0    | 0         | Old FR-04 drifted (voided, 2 runs); new control clean twice.       |
| 2026-10-07 | FR-06 re-grounded (its summary premise was gone); Stage 0 checks content premises | 2    | 0    | 0         | FR-06 only, twice; both proposed Fix with a test from real titles. |

## Latest run: 2026-10-07, FR-06 re-grounded

- **Run by:** Claude (the orchestrating session). Two fresh `general-purpose` triagers were each given FR-06's Spec, Diff and Finding, extracted to a scratch file so neither read `evals/`, plus Stage 4's finding-triage instruction and its four outcomes, verbatim.
- **Trigger:** the 2026-10-07 docs audit found FR-06's premise gone. The catalog rewrite left no summary with `. ` mid-text, so a correct triager would call the finding unreachable. FR-06 now applies `firstSentence` to `${title}. ${summary}`, and twelve real titles contain `vs.`. Stage 0 of this skill now also checks a scenario's real-content premises, not only its diffs.

| ID    | Run | Proposed outcome | Evidence                                                                      | Grade |
| ----- | --- | ---------------- | ----------------------------------------------------------------------------- | ----- |
| FR-06 | 1   | Fix with a test  | 13 titles with `vs.`; reproduced "Latency vs. Throughput. …" → "Latency vs."  | PASS  |
| FR-06 | 2   | Fix with a test  | 12 titles with `vs.`; reproduced on "Git Rebase vs. Merge" → "Git Rebase vs." | PASS  |

**Note:** both runs remarked that the re-grounded spec is contrived. Since the input is `${title}. ${summary}`, a correct `firstSentence` returns only the title. This doesn't affect what the scenario tests (whether triage confirms a reachable bug from real files), so it stays as written.
