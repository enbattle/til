# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                     | Note                                                                                            |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge                        | 14 inaccurate claims, 11 hand-copied facts; text fixes applied.                                 |
| 2026-09-24 | Pre-merge audit of PR #11                                   | 24 inaccurate claims, 15 copied facts; text fixes applied.                                      |
| 2026-09-29 | After PRs #19 to #22                                        | 9 inaccurate claims, 7 copied facts; text fixes applied.                                        |
| 2026-10-01 | After PRs #27 to #38                                        | Text fixes applied; full log in git history.                                                    |
| 2026-10-02 | After PRs #39 to #48 (DSA tab complete)                     | Text fixes applied; full log in git history.                                                    |
| 2026-10-04 | After PRs #52 to #65                                        | Text fixes applied; full log in git history.                                                    |
| 2026-10-06 | After PRs #67 to #82 (five-minute migration)                | Text fixes applied; full log in git history.                                                    |
| 2026-10-07 | After PRs #83 to #97 (catalog rewrite)                      | Text fixes applied; full log in git history.                                                    |
| 2026-10-07 | After PRs #99 to #107 (Computing Fundamentals)              | Text fixes applied; full log in git history.                                                    |
| 2026-10-13 | After PRs #108 to #130 (cleanup, DSA rewrite)               | Text fixes applied; full log in git history.                                                    |
| 2026-10-13 | After PRs #132 to #134 (DSA removal, cleanup)               | Latest run, below.                                                                              |
| 2026-10-15 | After PRs #135 to #148, with the template-switch retirement | 10 inaccurate claims (6 fixed), 5 code-owned and 6 hand-copied facts; Stage 2b ran on 288 rows. |

Last friction aggregation (docs-audit Stage 2b): 2026-10-15, 288 data rows; proposals 1 to 5 in the 2026-10-15 run's log, awaiting the user's decision. Before that 2026-10-13, 236 data rows; proposals 1 to 5 in the #108-#130 run's log (git history). Proposal 1 applied in #134: /feature Stage 2's mutation proof now covers removed, merged or narrowed tests and narrowed guards; Stage 1's guard clause was shortened, not deleted, because it holds the user-approved "Dropped at spec" record (used by docs/specs/remove-dsa-tab.md) and the NON_NEGOTIABLES-vector rule. Declined: 2 to 5 (moot: DSA removed, docs/specs/remove-dsa-tab.md). Before that 2026-10-07, 203 data rows; the user approved proposals 1 to 4 (see Latest run), applied in chore/friction-fixes-203 after a process-edit read narrowed them. Declined: 5 (drop the timing assertion), since #106's looser bound already stopped the flake and the test still catches a runaway parse. Before that 2026-10-07, 183 rows, all five approved and applied (#99, and as new guards in #100). Before that 2026-10-06, 119 rows, whose four proposals were applied in #86. Earlier: 2026-10-04, 73 rows, all applied. Declined: none.

## Latest run: 2026-10-15, after PRs #135 to #148

**Trigger.** It was overdue: 14 non-Dependabot PRs had merged since the last audit. It ran on the branch retiring the case-study `template` switch, against that branch's working tree.

**Files audited.** These were in scope:

- CLAUDE.md and README.md;
- every doc under docs/ except specs/ and pipeline-log.md, plus docs/specs/README.md;
- every file under evals/;
- every file under .claude/skills/;
- the hooks' reminder text;
- the comments in .github/workflows/\*.yml and .github/dependabot.yml.

**Fixed:**

- reading-time.ts's `WORD_BUDGET` comment still said "on either template".
- Live docs used "template 3" as a name after the switch was gone. They now say "the template" or "the case-study template". This covers case-studies.md, writing-standard.md, add-case-study SKILL.md and two eval scenarios.
- The CS base had no premises for its load-balancers-and-cdns and read-replicas links. They have been added.
- SR-23 had no premise for payment-system.md. It has been added.
- docs/specs/README.md didn't mention a spec's `## Review decisions` section. It does now.
- The skill-routing "Latest run" was older than its last trend row. This run replaced it.

**Left open, for the user:**

- **Stale CS base description.** It still says "about 1,560 words … 160–190 words each", but the base is now about 1,850 words. This is left until the base settles.
- **Inconsistent reviewer briefs.** They name Writing Standard sections inconsistently: content-review.md names three, content-audit names two and /feature Stage 4 names one. Changing /feature's Stage 4 instruction triggers feature-review-eval.
- **Code-owned facts copied into docs:**
  - the word budgets, in writing-standard.md and reading-time.ts, which both claim to be canonical;
  - the frontmatter key lists;
  - the test-lock coverage list;
  - docs-audit's "10 pull requests";
  - the 960px max width.
- **Facts hand-copied across docs, with no single source:**
  - "150–300 words per decision", in four places;
  - the decision order, in five;
  - "d2 v0.9.x", in five;
  - the section counts, twice in case-studies.md;
  - the extra-agent list;
  - who runs `verify`.
- **Deletion nominees:**
  - collapse the retired-scenario stubs into one "Retired IDs" line;
  - delete content-review scenarios.md's dated 2026-10-07 history paragraph;
  - delete verification.md's orphaned check-pipeline-log sentence.
- **The Stage 2b proposals below.**

**Stage 2b.** It covered 288 data rows, 52 since the last aggregation, and made five proposals:

1. **Fix or trim rounds that break something.**
   - In docs/content-review.md, count "one more fix and confirmation" as Fix rounds 2.
   - Gate catalog drafts on the 600–900 aim, so that fixes don't need trims.
2. **The case-study architecture's "two or three paragraphs" isn't held.** 10 of the 17 pages have 4 or 5. Pick N, then either check it in `diagramProblems` or change the doc to match.
3. **Drafter hand-offs fail.** Before a reviewer starts, check `git status --porcelain` and run the structure test in the worktree.
4. **Defects found during rewrites were never recorded.** None became Escaped defect cells for the runs that published them. That covers rows 252, 260 and 263, and possibly 274.
5. **Eval fixtures lag behind standard changes.** Run the structure checks on the CS and CR fixtures in `verify`.
