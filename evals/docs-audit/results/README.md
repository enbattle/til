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
| 2026-10-13 | After PRs #108 to #130 (cleanup, DSA rewrite)  | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-13, 236 data rows; proposals 1 to 5 in Latest run, awaiting the user. Before that 2026-10-07, 203 data rows; the user approved proposals 1 to 4 (see Latest run), applied in chore/friction-fixes-203 after a process-edit read narrowed them. Declined: 5 (drop the timing assertion), since #106's looser bound already stopped the flake and the test still catches a runaway parse. Before that 2026-10-07, 183 rows, all five approved and applied (#99, and as new guards in #100). Before that 2026-10-06, 119 rows, whose four proposals were applied in #86. Earlier: 2026-10-04, 73 rows, all applied. Declined: none.

## Latest run: 2026-10-13, after PRs #108 to #130

**Trigger:** 16 PRs since the last audit: the cleanup (#117 to #125: in-process checks and slimmer guards, DSA code regions, content, UI and docs dedupes), the DSA plain-code rule (#126) and its four rewrite batches (#127 to #130), which ended by deleting `PENDING_PLAIN`.

**Files audited:** the 37 files of Stage 1 (CLAUDE.md, README.md, `docs/` minus specs and the log, `evals/`, every file under `.claude/skills/`, the hook reminders, the workflow and Dependabot comments).

**Fixed (stale facts):**

- SR-21's prompt asserted the linked-list entry still used `Symbol.iterator`, false after the rewrite; reworded as a rule-driven request and re-run once (routed to add-dsa-entry, PASS).
- SR-18's Why said the DSA review checks "idiomatic" code; now "plain, tutorial-style".
- docs-audit Stage 4's "the latter two" pointed at the wrong commands after the block grew; it now names them.
- docs/dsa.md's "Not used" list lacked `functools.cache`/`lru_cache` and `__next__`, which the test bans; added. Also fixed: both workflows pin Python 3.12, the tree comment for `dsa-code-chunks.test.ts`, and the DP shapes entry's real title.
- add-dsa-entry and content-audit gave a reviewer only the entry's own code folder; entries that import `MinHeap` now also hand over `heap.ts`. add-dsa-entry's "reference entry" is plural, and its oxlint command uses `npx`.
- FR-06's hardcoded "Twelve" titles (13 now) is dated instead.
- writing-standard.md said both structure tests import `WORDS_PER_MINUTE`; they import only `WORD_BUDGET`.
- knip flagged `src/lib/code-regions.d.mts` (used by tsc, like `markdown.d.mts`); added to `knip.json`'s ignore and to verification.md.

**Left open for the user:**

- Duplication: the "comments give the why" rule and its example in dsa.md, the Writing Standard and add-dsa-entry; the list of content-review skills in six places; "four code files" in six places; pipeline-log row rules restated in content-review.md; and the three carried over from the last audit.
- Code-owned lists in verification.md (each check's exported function, the `listFiles` users).
- Deletion nominees: content-audit's historical asides (again), and the Writing Standard's code-comments bullet (merge into a pointer to dsa.md).
- The tests' "reference entries" (hash-map, two-pointers, binary-search) differ from dsa.md's (heap, dynamic-programming).
- knip's three unused exports: `REDIRECTS` (src/content/redirects.ts), `REPO` and `gitInit` (src/test/guard-helpers.mjs).
- Stage 2b's five friction proposals, below.

**Stage 2b (236 data rows, 33 new):**

1. Removing or merging a test drops coverage, found a round at a time (in-process-checks, content-dedupe, ui-dedupe; 35 agents, 6 rounds). Keep one rule: widen /feature Stage 2's removed-test mutation clause to removed or narrowed checks, and delete Stage 1's guard-inventory clause.
2. DSA rewrites dropped behaviour old tests or guards protected (9 rows, 4 of the 5 Highs). In rewrite mode, run the pre-rewrite tests unchanged against the new code, and list each deleted test with the bug it guarded.
3. Prose and pitfalls contradicted rewritten code (11 of 28 rows). A `check:dsa-quotes` that flags an inline code span with a call, assignment or index found in none of the entry's code files; fallback, a rewrite-mode step that searches the entry for removed lines.
4. Code rules a linter could enforce (dropped Python hints, TS `shift()` queues, impossible guards): lint rules scoped to `src/dsa/code`.
5. A fix round changed one of two readers of a format (drift-and-rewrite-guards, dsa-code-regions): a parity test over both region readers.
