# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                      | Note                                                            |
| ---------- | -------------------------------------------- | --------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge         | 14 inaccurate claims, 11 hand-copied facts; text fixes applied. |
| 2026-09-24 | Pre-merge audit of PR #11                    | 24 inaccurate claims, 15 copied facts; text fixes applied.      |
| 2026-09-29 | After PRs #19 to #22                         | 9 inaccurate claims, 7 copied facts; text fixes applied.        |
| 2026-10-01 | After PRs #27 to #38                         | Text fixes applied; full log in git history.                    |
| 2026-10-02 | After PRs #39 to #48 (DSA tab complete)      | Text fixes applied; full log in git history.                    |
| 2026-10-04 | After PRs #52 to #65                         | Text fixes applied; full log in git history.                    |
| 2026-10-06 | After PRs #67 to #82 (five-minute migration) | Text fixes applied; full log in git history.                    |
| 2026-10-07 | After PRs #83 to #97 (catalog rewrite)       | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-07, 183 data rows; the user approved all five proposals (see Latest run). 1 (tests read pinned prose from files) and 5 (sharper add-topic checklist item) were applied directly on 2026-10-07; 2, 3 and 4 are new guards and go through `/feature`. Before that 2026-10-06, 119 rows, whose four proposals were applied in #86. Earlier: 2026-10-04, 73 rows, all applied. Declined: none.

## Latest run: 2026-10-07, after PRs #83 to #97

**Trigger:** 13 PRs with no audit since 2026-10-06:

- the docs audit follow-ups (#85, #86);
- the catalog standard (#87);
- the nine catalog rewrite batches (#88 to #96), which retitled every topic, merged two pairs with redirects and deleted `PENDING`;
- the `bodyOnlyWord` fuzzy-match fix (#97).

**Files audited:** CLAUDE.md, README.md, `docs/**` (specs as records), `evals/**`, `.claude/skills/**`, the `.claude/hooks/*.js` reminder text, `.github` comments, and `package.json`'s description against README's intro.

**Checked and accurate:** the skill list, every `npm run` script named, all referenced paths, the section list, the workflow and Dependabot comments, and README's intro. All eight feature-review diffs still apply. `PENDING` and the merged-away slugs appear only in records.

**Fixed (stale facts):**

1. Dead-link coverage: docs/dsa.md and add-dsa-entry said nothing checks DSA links, but `catalog-gaps.test.ts` does. add-topic left out DSA bodies.
2. "3-step 'Adding a new section'" in add-topic, evals/README.md and SR-04: the step number is dropped everywhere, since docs/content.md now has four steps.
3. writing-standard.md said topics show a "5 min" label. They don't; it now says "about 5 minutes at 230 words a minute".
4. add-topic cited a docs/content.md sentence that #96 removed.
5. evals/README.md credited docs/content.md with an option that add-topic's description states.
6. `nudge-sdlc.js` sent only new topics to add-topic. It now also sends rewrites, merges and moves.
7. The content-review scenarios intro said reviewers get "add-topic's" Stage 3 instruction. It now names docs/content-review.md, filled in per skill.
8. verification.md restated the PowerShell hook's limits list. It now points to the hook's header.
9. feature-review-eval Stage 0 now also checks a scenario's real-content premises, not only its diffs.

**Content-review fixtures:** CR-01..05 were brought to the catalog standard (the open follow-up from #87). The content-review eval was re-run on them (see its results file).

**Left open for the user:**

- **FR-06:** its premise (three real summaries containing `vs. `) no longer holds, so a correct triager now finds the finding unreachable. Re-grounding or re-grading it is a decision.
- **Duplication:**
  - dead-link coverage is stated in four places; make docs/content.md canonical;
  - the batch drafter self-check differs across add-topic, add-case-study and add-dsa-entry; move the `npx vitest run src` rule into content-review.md's batch mode;
  - nudge-sdlc.js repeats part of skill-routing-eval's target list;
  - cut-off dates in verification.md and pipeline-log.md copy `check-pipeline-log.mjs`;
  - the 1,150-word budget in scenarios.md copies `WORD_BUDGET`.
- **Deletion nominations:**
  - `registry.test.ts`'s pin of `coding-agents` to exactly its four moved topics. It blocks a fifth topic, and `redirects.test.ts` already guards the move.
  - docs-audit Stage 1's manual site-description bullet, now that `site-description.test.mjs` checks it.

**Friction aggregation (Stage 2b, 183 rows):** five groups, for the user to decide:

1. **Tests pin published prose** (search word, redirect `#hash`, a locked title). #97 fixed the search word. Proposed: the redirect and title tests read their target from the topic file.
2. **Eval fixtures drift from live content** (FR-04, FR-06, CR-01..05, SR prompt refreshes). Proposed: a script that checks each fixture's quoted strings still exist at HEAD.
3. **PowerShell edits corrupt files.** The 10-07 truncation came after the hook landed, so it didn't hold. Proposed: the hook also blocks in-place replaces through a PowerShell argument on `src/**`.
4. **Rewrites cut what other pages link in for** (an API gateway definition, the system prompt, the cold-cache case, a `#hash`, a search term). Proposed: a script listing each topic's inbound links and anchors for the drafter and reviewer brief.
5. **A body contradicts its own rule or numbers** (30 inconsistency and estimate tags). Proposed: reword add-topic's catalog checklist item to "the rule of thumb holds for every example, and every figure follows from the running example's stated numbers".
