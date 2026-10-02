# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                 | Note                                                            |
| ---------- | --------------------------------------- | --------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge    | 14 inaccurate claims, 11 hand-copied facts; text fixes applied. |
| 2026-09-24 | Pre-merge audit of PR #11               | 24 inaccurate claims, 15 copied facts; text fixes applied.      |
| 2026-09-29 | After PRs #19 to #22                    | 9 inaccurate claims, 7 copied facts; text fixes applied.        |
| 2026-10-01 | After PRs #27 to #38                    | Text fixes applied; full log in git history.                    |
| 2026-10-02 | After PRs #39 to #48 (DSA tab complete) | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-02, 63 data rows. Declined: none yet (four proposals with the user, listed below).

## Latest run: 2026-10-02, after PRs #39 to #48

Trigger: the DSA tab went from 3 to 42 entries (PRs #41 to #48), with the batch-mode process edits (#44, #46) and the FR-07 fix (#40) in between. Stage 2b was due (63 pipeline-log data rows against 24 at the last aggregation) and ran alongside Stage 2.

Files audited: CLAUDE.md, README.md, every file under `docs/` (specs spot-checked), `evals/` (READMEs, scenarios, results), every file under `.claude/skills/`, `.claude/hooks/*.js`, the workflow and Dependabot comments, and the site description in `package.json` and `index.html` (52 files).

Findings fixed (stale facts):

- `add-dsa-entry`: the description's routing examples named entries that now exist ("the heap entry", "sliding window", "the next batch"); the batch-mode bullet still said "the roadmap is added in batches". SR-18 was re-run after the description edit.
- `content-audit` Stage 1 gave all DSA entries one batch, written when there were 3; now about five entries per agent.
- `docs/content-review.md` Batch mode: the Sonnet evidence counted two batches and called a whole-batch `npm ci` unmeasured; five batches and six parallel installs have run.
- `add-topic` Stage 2: `catalog-gaps.test.ts` checks every topic and case-study body, not only systems topics.
- `docs/DEFERRED_PRACTICES.md`: the `nudge-sdlc` reminder doesn't fire on `evals/` files.
- `evals/skill-routing/scenarios.md`: SR-11 and SR-14 left `add-dsa-entry` out of the content skills.
- The three eval results files: old trend rows still said "latest run, below"; feature-review's "Latest run" was the rotation run, not the FR-07 re-run that settled its open decision.

Left open for the user:

- The content-review DS-* fixtures are built on a Prefix Sums entry, which is now published; the 2026-10-02 content-review run worked around it. Rebase them onto an entry that doesn't exist.
- Code-owned facts restated in docs: the 42 entry names and counts in `docs/dsa.md`'s Scope; the 960 px diagram limit in `docs/verification.md` and `docs/case-studies.md` (owned by `MAX_WIDTH` in `scripts/check-diagrams.mjs`); "CI runs 3.12" in README and `docs/dsa.md` (owned by the workflows).
- Hand-copied facts: the Writing Standard's bullets are paraphrased in four places, and `docs/content-review.md`'s copy lists 7 of its 9 bullets as if complete; eval triggers repeat `evals/README.md`'s table in skill bodies.
- Deletion candidates: `docs/verification.md`'s bundle-size history; the Scope name list in `docs/dsa.md`.
- Stage 2b proposals: per-test timeouts so a broken loop fails instead of hanging (`pytest-timeout` with the thread method; vitest's forks pool with a step timeout); stopping reviewers' `__pycache__` (`-p no:cacheprovider` and no bytecode in the DSA code tree); worktrees checked against the batch branch head before drafting; recording batch integration and CI failures, and re-run agents, in pipeline-log rows (with `check:pipeline-log` rejecting a fix round on a 0/0/0 row with no `pre:`). One more, running full `verify` per drafter, contradicts the batch-1 evidence that parallel verifies overload the machine; not recommended.
