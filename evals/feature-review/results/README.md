# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what `../HOW_TO_RUN.md` step 6 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                 | Pass | Fail | Ambiguous | Note                                                |
| ---------- | --------------------------------------- | ---- | ---- | --------- | --------------------------------------------------- |
| 2026-09-23 | Baseline; Stage 4 instruction edited    | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after. |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6) | 2    | 0    | 0         | Top finding both runs.                              |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited | 8    | 0    | 0         | No rotation.                                        |
| 2026-09-24 | FR-05 added (subtler defect)            | 3    | 0    | 0         | Latest run, below. Ceiling effect persists.         |

## Latest run: 2026-09-24, run 2 (FR-05)

**Trigger:** new scenario FR-05, a subtler planted defect added so the eval can
discriminate (commit 4b0b19f).

**Rotation:** none. FR-05 is new; no existing scenario was changed.

**Scenarios run:** FR-05 only, three times. Each run used a fresh
`general-purpose` agent, never a fork, and all three ran in parallel. Each got
FR-05's Spec and Diff, the path `docs/NON_NEGOTIABLES.md`, and Stage 4's
reviewer instruction copied verbatim from `.claude/skills/feature/SKILL.md`,
plus HOW_TO_RUN.md step 2's extra line (don't read `evals/`, don't start the
dev server). No reviewer was told that a defect was planted.

**Diff context check before running:** the quoted code matches
`src/components/SearchDialog.tsx`: `const results = searchContent(query);` is
line 26, and `})}` / `</ul>` / the footer `<div>` are lines 136–138.
`searchContent`'s default `limit = 8` is at `src/lib/search.ts:72`, so the
planted defect is real. Only hunk metadata is off (noted, not fixed): the
second hunk shows 3 context lines, so `@@ -136,2 +138,7` should be
`@@ -136,3 +138,8`.

| ID    | Run | Finding summary                                                                                                                                                                                                                                                                                                                              | Rank of planted finding | Grade | Notes                                                                                          |
| ----- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| FR-05 | 1   | Critical: "the line can never show, so criterion (2) is not met": `searchContent` defaults `limit = 8` (`search.ts:72`), so `hidden` is always 0; fix is a larger limit plus `results.slice(0, SHOWN)`. High: no test covers the behaviour. Medium: count not in a live region. Low: "+1 more results" plural. Low: 8 defined in two places. | 1 of 5                  | PASS  | Named the exact fix from Expected, and warned that the fix without a slice breaks criterion 1. |
| FR-05 | 2   | Critical: "`hidden` is always 0, so the '+N more' line never renders", same root cause. High: the obvious fix (larger limit) breaks criterion 1 without a slice. Medium: count not announced to screen readers. Low: plural at N=1.                                                                                                          | 1 of 4                  | PASS  | Also noted a mocked `searchContent` in tests could hide the bug.                               |
| FR-05 | 3   | Critical: "the new line can never appear, so criterion (2) fails", same root cause; fix is `searchContent(query, Infinity)` plus a slice. High: no test covers the >8 case. Medium: count outside a live region. Low: plural, layout shift, tokens fine.                                                                                     | 1 of 4                  | PASS  | Checked that Fuse slices only when `limit > -1`, so `Infinity` returns every match.            |

**Disagreements between runs:** none on grades or rank. All three put the
planted defect first at Critical with the fix Expected names. Secondary
findings matched closely too: all three raised the missing live region
(Medium) and the "+1 more results" plural (Low). Runs 1 and 3 ranked the
missing test High; run 2 instead ranked the slice-free fix trap High.

### Notes

- **FR-05 does not discriminate yet.** It was added because FR-01..03's planted
  defects were always the top finding. FR-05's was too, in 3 of 3 runs, each
  time found by reading `searchContent`'s signature one hop away. The ceiling
  effect persists. A harder variant would need the cap further from the call
  site (for example, set in a config or a caller two hops away), or a defect
  that only shows under a runtime condition.
- **No reviewer stopped at the missing test**, so the AMBIGUOUS case in
  Expected didn't occur.
- **Unplanted findings, all true of the diff:** the count is outside the
  dialog's persistent `role="status"` region, so screen readers aren't told
  (all three, Medium); "+1 more results" is ungrammatical (all three, Low).
  Neither is counted against the reviewers.
- **Scope.** No reviewer started the dev server or edited the working tree, and
  each said it read nothing under `evals/`.
