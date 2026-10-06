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
| 2026-10-06 | After PRs #67 to #82 (five-minute migration) | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-06, 119 data rows; its four proposals await the user (see Latest run). Before that 2026-10-04, 73 rows. Settled from 2026-10-02 (#50): per-test timeouts deferred (DEFERRED_PRACTICES); `__pycache__` off in `test-python.mjs`; batches start from main; CI failures and re-run agents counted in rows; per-drafter `verify` declined. 2026-10-04 proposals (listed below), applied in the follow-up PR: 1, with the Stage 1 list shortened to a pointer rather than deleted; 3; 4, plus `check:pipeline-log` rejecting "pending" from 2026-10-05; 2 needed nothing new. Declined: none.

## Latest run: 2026-10-06, after PRs #67 to #82

Trigger: 12 PRs with no audit since 2026-10-04.

- The five-minute writing standard and its evals (#69).
- The temporary `template: 2` switch, `proseWordCount`, the `?words` view and the "N min read" label (#70, #71).
- The migration of all 16 case studies and all DSA entries, 42 down to 28 (#71 to #80).
- The final content audit (#81).
- The retirement of the template switch, with frontmatter keys now pinned (#82).

Files audited:

- CLAUDE.md and README.md;
- every file under `docs/` (specs skimmed for present-tense rules);
- under `evals/`: the READMEs, scenarios and results;
- every file under `.claude/skills/`;
- `.claude/hooks/*.js`;
- the comments in the workflows and the Dependabot config;
- `package.json`'s description.

The skill list, npm scripts, test names, function names and frontmatter allowlists all match. All eight feature-review diffs still apply.

Findings fixed (stale facts):

- **`docs/dsa.md`:** it named `dynamic-programming.md` as the only reference example, "on the new template; until each kind has one of its own". It now names `heap.md` for data structures and `dynamic-programming.md` for patterns and algorithms.
- **`CLAUDE.md`:** the DSA tab was "one list ordered by prerequisites". It is now "one list, grouped by kind and ordered by prerequisites".
- **`docs/DESIGN.md`:** opening at a `#<heading-id>` URL works for DSA entries as well as topics and case studies.
- **`evals/content-review/scenarios.md`:** the intro called every scenario a draft topic for `add-topic`, but the set now includes case studies and DSA entries.
- **`evals/skill-routing/scenarios.md` SR-07:** the Why described a new estimation utility and a words-per-minute call. `readingMinutes` and `?words` exist now, so the Why now names the real topic-side work. The prompt and the Expected answer are unchanged.
- **`scripts/check-diagrams.mjs`:** a comment cited checklist item 5 for diagram width; it's item 4.
- **`docs/pipeline-log.md`:** heap.md's 2026-10-05 row logged 1 fix round with no findings. It was 0, a logging error, corrected.

Left open for the user:

- **Copies of facts code owns:**
  - README's intro line against `package.json` (nothing checks the README copy);
  - the 1,150-word budget and 230 wpm in six docs (the code constants are defined twice);
  - dsa.md's 28-entry Scope table and its backward-link list;
  - the README System Design bullet's template outline;
  - the diagram width in three docs.
- **Hand-duplicated across docs:**
  - the "N min read" sentence (three places);
  - Python 3.11+ and the pytest install command (eight places, still open from 2026-10-04);
  - the case-study and DSA templates in the docs and the skills;
  - the Writing Standard bullets in content-review.md and `/feature` Stage 4 (Stage 4's copy omits the "Case studies and DSA entries" section);
  - the two-round cap and which edits call for an eval (both still open).
- **To delete or merge:**
  - the second "N min read" passage in docs/case-studies.md;
  - dsa.md's 28-entry Scope table, to be replaced by its own sentence plus the deliberate omissions;
  - the one-time **Agents** backfill note in pipeline-log.md's header.
- **Stage 2b proposals** (friction aggregation over rows 74 to 119):
  1. Batch content rows record a `kinds:` list in the Retro cell, checked by `check:pipeline-log` against the content-review planted-violation names. Also reject a nonzero fix-round count when findings are 0/0/0 and the row has no `pre:N` (44 rows, about 90 agents, 44 fix rounds, kinds not recoverable).
  2. Replace any remaining snapshot or value-pinned tests over published content with invariants (four rows of second copies drifting).
  3. `/feature`'s spec gives every acceptance criterion an owner in Roles, and eval re-runs belong to the orchestrator at Stage 5. This replaces "implementer does not run evals" (four rows of orchestrator-owned gaps).
  4. A PreToolUse hook blocks PowerShell `Set-Content` / `Out-File` on repo files without `-Encoding utf8` (two rows).
