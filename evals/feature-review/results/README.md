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
| 2026-10-01 | Lint went strict (FR-03 rotated), FR-01 rotated, Stage 4 wording for DSA        | 13   | 1    | 0         | FR-07 split; latest run, below.                        |
| 2026-10-01 | FR-07 finding replaced (unreachable by construction)                            | 2    | 0    | 0         | Both proposed Reject, each with a reproduction.        |

## Latest run: 2026-10-01, rotation after lint went strict

**Trigger:** `npm run lint` began failing on warnings (#38), which made FR-03's
planted defect mechanical, and the docs audit edited Stage 4's reviewer and
triage wording (adding `src/dsa/` and docs/dsa.md). FR-03 was rotated to a
stale ref (lint can't see it: `oxlint --deny-warnings` exits 0 on the changed
file), and FR-01 to a single defect with a correct guard, ending its known
extra defects. FR-02, FR-05 and FR-07's diffs were regenerated against today's
code; every diff now applies with `git apply`.

**Scenarios run:** all seven, twice each, so 14 runs, in parallel on fresh
`general-purpose` agents (never a fork), each prompt built from the current
skill's Stage 4 reviewer or triage instruction, verbatim. The triage prompts
carried the four outcome bullets but not their lead-in paragraph, which the
2026-09-29 run included.

| ID    | Run | Finding                                                                                    | Grade |
| ----- | --- | ------------------------------------------------------------------------------------------ | ----- |
| FR-01 | 1   | Medium: `"Use # for comments" # draft` → `"Use`; also the mirror `"Caching" # was "Cache"` | PASS  |
| FR-01 | 2   | High: the same cut, reproduced in a script, with the fix (find the closing quote first)    | PASS  |
| FR-02 | 1   | High, NN #1: the icon-only button has no accessible name                                   | PASS  |
| FR-02 | 2   | High, NN #1: the same                                                                      | PASS  |
| FR-03 | 1   | High: `queryRef` is never updated, so the first Escape closes                              | PASS  |
| FR-03 | 2   | High: the same                                                                             | PASS  |
| FR-04 | 1   | Nothing flagged; true theoretical notes (`NaN`, unused export)                             | PASS  |
| FR-04 | 2   | Nothing flagged; the same notes                                                            | PASS  |
| FR-05 | 1   | Critical: `searchContent` caps at 8, so `hidden` is always 0                               | PASS  |
| FR-05 | 2   | Critical: the same                                                                         | PASS  |
| FR-06 | 1   | Fix with a test: three real summaries cut at `vs.`, reproduced                             | PASS  |
| FR-06 | 2   | Fix with a test: the same three                                                            | PASS  |
| FR-07 | 1   | Fix with a test: no doc limits summaries to ASCII, and the fix is one regex                | FAIL  |
| FR-07 | 2   | Known limitation: no accented letter in any content, no doc asks for one                   | PASS  |

### Notes

- **FR-07's two runs disagree, so the scenario is ambiguous, not the reviewer.**
  Run 1's case is fair: nothing in the docs restricts summaries to ASCII, the
  encoding guard treats "Zürich" and "São Paulo" as legitimate, and
  `\p{Lu}` costs one regex. Per the skill, the scenario gets fixed rather
  than the runs averaged; that's left for the user to decide (a finding that
  is unreachable on every reading, or an Expected outcome that accepts a
  cheap fix).
- **FR-01's rotation has two symptoms of one cause.** Run 1 also found that a
  comment ending in a quote makes the whole value look quoted; it's the same
  whole-raw-value test, so the scenario's Expected finding now names both.
- **The rotated FR-03 still reads as obvious.** Both runs named the stale ref
  as High within the first finding, so it tests the reviewer without lint's
  help, as intended.
