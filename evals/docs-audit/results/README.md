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
| 2026-10-02 | After PRs #39 to #48 (DSA tab complete) | Text fixes applied; full log in git history.                    |
| 2026-10-04 | After PRs #52 to #65                    | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-04, 73 data rows. Settled from 2026-10-02 (#50): per-test timeouts deferred (DEFERRED_PRACTICES); `__pycache__` off in `test-python.mjs`; batches start from main; CI failures and re-run agents counted in rows; per-drafter `verify` declined. 2026-10-04 proposals (listed below), applied in the follow-up PR: 1, with the Stage 1 list shortened to a pointer rather than deleted; 3; 4, plus `check:pipeline-log` rejecting "pending" from 2026-10-05; 2 needed nothing new. Declined: none.

## Latest run: 2026-10-04, after PRs #52 to #65

Trigger: 14 PRs with no audit since 2026-10-02: the wider shell and "On this page" nav with scroll-spy and a narrow-screen bar, DSA kind groups, the focus-not-obscured fix, test consolidation, the per-guard test split, and the `check:raw-html` work ending in its oxc-parser rewrite, plus four `/feature` edits. Stage 2b was due (73 data rows against 63) and ran alongside Stage 2.

Files audited: CLAUDE.md, README.md, every file under `docs/` (specs spot-checked), `evals/` (READMEs, scenarios, results), every file under `.claude/skills/`, `.claude/hooks/*.js`, the workflow and Dependabot comments, and the site description in `package.json` (37 files plus 23 specs).

Findings fixed (stale facts):

- `/feature` Stage 2 gate and `add-dsa-entry` batch mode ran `oxlint` without `--deny-warnings`, so a warning in a locked test passed Stage 2 and then failed Stage 3's `verify`, where no one may fix it.
- `/feature` Stage 2's instruction still said #6's vector tables stay in `scripts/checks.test.mjs`; #6's sink tables moved to `scripts/check-raw-html.test.mjs`, and only the allowlist tables stay (Stages 3 and 4a already said so).
- `docs/verification.md`: now says `check:raw-html` rejects more sinks than #6 names, that its header's list of unseen forms is examples, that `check-raw-html.test.mjs` and `check-pipeline-log.test.mjs` parse #6 and the log header (so editing either fails `test:run`), and what `check:tokens`, `check:contrast`, `check:npm-refs` and `check:pipeline-log` prove (README says verification.md has them).
- `docs/case-studies.md`: `check:diagrams` enforces only a diagram's width, not its node or participant counts.
- `docs/DESIGN.md`: "On this page" moved out of the "Case study navigation" bullet into its own (it covers topics and DSA entries); the thin-scrollbar item named two of the four scroll containers.
- `docs/DEFERRED_PRACTICES.md` and `ci.yml`'s comment: "every skill's final gate runs `verify`" holds only for skills that change the repo.
- `evals/feature-review/scenarios.md`: FR-02's hunk header pointed at line 68; the context is now at `TopicPage.tsx:72`.
- This file's aggregation line called the 2026-10-02 proposals undecided; all were settled.
- The skill-routing results lacked rows for #63's and #64's Stage 1 edits (#64's row says SR-01 passed); a scoped SR-01 and SR-18 run is logged there now.

Rejected: the "~720 px column" figure (four docs, two code comments) is the narrowest desktop column, which is what the 960 px limit is sized for; not stale.

Left open for the user:

- Owed eval: `feature-review-eval`, since a defect escaped the `on-this-page-bar` review (evals/README's table); last run 2026-10-01.
- `.claude/hooks/nudge-precommit.js` names CLAUDE.md, README, docs/ and SKILL.md, not every surface this audit covers; folded into the proposal to make the reminder say when an audit is due.
- Hand-copied facts: where planted guard cases go (three copies in `/feature`, plus #6 and `checks.test.mjs`'s header); `/feature`'s agent roster (CLAUDE.md, SDLC.md, the skill); the two-round review cap (five places); Python 3.11+ and the pytest install (four docs, owned by `MIN_MINOR` in `scripts/test-python.mjs`); "On this page" breakpoints restated in content.md, case-studies.md and dsa.md (DESIGN.md is canonical); the Writing Standard's bullets (still open from 2026-10-02); which edits call for an eval (evals/README, `nudge-sdlc.js`, Stage 6's process-file list, each eval skill).
- Deletion candidates: merge `/feature`'s three "where planted cases go" parentheticals into one; the `text-tertiary`/`accent` value history in DESIGN.md's Contrast item; the one-time **Agents** backfill note in pipeline-log.md's header.
- Stage 2b proposals:
  1. Guard runs found one vector per round (six rows, about 64 agents and 16 fix rounds); each run added words to Stage 1's guard bullet and the next churned anyway. Stage 4's "try at least one other way of regressing what it guards" becomes "try every way you can find, reported together as one finding", and the latest Stage 1 example list (sink routes) is deleted, since `check-raw-html.test.mjs` and the script's header own it.
  2. UI interaction-state gaps (scroll-spy, bar, focus fix): already acted on in #60; check the next UI row.
  3. PowerShell garbling non-ASCII: `src/lib/text-encoding.test.ts` covers every tracked text file except `.py`; add `py` to its extensions.
  4. Retro cells say "pending" for proposals later applied, and fixes held only in session briefs (prettier on saved specs): write the row in the retro commit once the user decides, have `check:pipeline-log` reject `pending` in a Retro cell, and add "run prettier on it" to Stage 1's spec-saving step.
