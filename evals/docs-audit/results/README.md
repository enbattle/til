# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                        | Note                                                            |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge           | 14 inaccurate claims, 11 hand-copied facts; text fixes applied. |
| 2026-09-24 | Pre-merge audit of PR #11                      | 24 inaccurate claims, 15 copied facts; text fixes applied.      |
| 2026-09-29 | After PRs #19 to #22                           | 9 inaccurate claims, 7 copied facts; text fixes applied.        |
| 2026-10-01 | After PRs #27 to #38                           | Text fixes applied; full log in git history.                    |
| 2026-10-02 | After PRs #39 to #48 (DSA tab complete)        | Text fixes applied; full log in git history.                    |
| 2026-10-04 | After PRs #52 to #65                           | Text fixes applied; full log in git history.                    |
| 2026-10-06 | After PRs #67 to #82 (five-minute migration)   | Text fixes applied; full log in git history.                    |
| 2026-10-07 | After PRs #83 to #97 (catalog rewrite)         | Text fixes applied; full log in git history.                    |
| 2026-10-07 | After PRs #99 to #107 (Computing Fundamentals) | Text fixes applied; full log in git history.                    |
| 2026-10-13 | After PRs #108 to #130 (cleanup, DSA rewrite)  | Text fixes applied; full log in git history.                    |
| 2026-10-13 | After PRs #132 to #134 (DSA removal, cleanup)  | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-13, 236 data rows; proposals 1 to 5 in the #108-#130 run's log (git history). Proposal 1 applied in #134: /feature Stage 2's mutation proof now covers removed, merged or narrowed tests and narrowed guards; Stage 1's guard clause was shortened, not deleted, because it holds the user-approved "Dropped at spec" record (used by docs/specs/remove-dsa-tab.md) and the NON_NEGOTIABLES-vector rule. Declined: 2 to 5 (moot: DSA removed, docs/specs/remove-dsa-tab.md). Before that 2026-10-07, 203 data rows; the user approved proposals 1 to 4 (see Latest run), applied in chore/friction-fixes-203 after a process-edit read narrowed them. Declined: 5 (drop the timing assertion), since #106's looser bound already stopped the flake and the test still catches a runaway parse. Before that 2026-10-07, 183 rows, all five approved and applied (#99, and as new guards in #100). Before that 2026-10-06, 119 rows, whose four proposals were applied in #86. Earlier: 2026-10-04, 73 rows, all applied. Declined: none.

## Latest run: 2026-10-13, after PRs #132 to #134

**Trigger:** the DSA tab was removed (#132), Dependabot bumped Prettier (#133), and a cleanup (#134) changed /feature's guard and mutation-proof rules, deduped docs and cleared knip. Run on branch chore/dedupes-and-docs-audit, alongside three held-back dedupes (add-case-study checklist item (5), the Writing Standard's structural-test sentence, SDLC.md's "Verifying the process itself").

**Files audited:** 36: Stage 1's list, plus `docs/specs/README.md`, which `check:npm-refs` already treats as live; Stage 1 now names it. Stage 2b not due (237 data rows, 236 at the last aggregation).

**Fixed (stale facts):**

- writing-standard.md said both structure tests import `WORD_BUDGET`; only `case-study-structure.test.ts` does (the second was DSA's).
- content.md said `topic-structure.test.ts` checks the whole "Catalog topics" section; it now names the four rules the test enforces and that review checks the rest.
- CLAUDE.md hand-listed the skills that finish on `verify` (missing content-audit); now "every skill that changes content or code".
- verification.md said two scripts read paths outside `listFiles`; `check:bundle` (git-ignored `dist/assets`) is a third.
- SR-11's Why said add-case-study rewrites; it lost rewrite mode earlier.
- README described classic branch protection; `main` has a ruleset (pull request, `verify` on an up-to-date branch, CodeQL, no force-push or deletion), and it now says to update a behind branch rather than bypass the rule. DEFERRED_PRACTICES says "ruleset" to match. This session hit the up-to-date rule when #133 merged before #134.

**Left open for the user:**

- Code-owned facts in docs: docs-audit's "10 pull requests" (owned by `AUDIT_DUE_AFTER` in nudge-precommit.js); verification.md's test-lock coverage list (the script header has it) and its in-process versus spawned split; content.md and case-studies.md frontmatter keys (`TOPIC_FIELDS`, `CASE_STUDY_FIELDS`).
- Hand-copied facts: the extra-agent list in SDLC.md and feature/SKILL.md (NON_NEGOTIABLES #8 repeats the core three); who runs `verify` (CLAUDE.md, verification.md, ci.yml); 230 words a minute in both Writing Standard budget bullets.
- Deletion nominees: collapse the six retired scenario stubs (SR-13, SR-18 to SR-21, DS-*) to one "Retired IDs" line per file; verification.md's orphaned sentence that check-pipeline-log's test reads the log header.
