# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                              | Note                                                            |
| ---------- | ------------------------------------ | --------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge | 14 inaccurate claims, 11 hand-copied facts; text fixes applied. |
| 2026-09-24 | Pre-merge audit of PR #11            | 24 inaccurate claims, 15 copied facts; text fixes applied.      |
| 2026-09-29 | After PRs #19 to #22                 | 9 inaccurate claims, 7 copied facts; text fixes applied.        |
| 2026-10-01 | After PRs #27 to #38                 | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-01, 24 data rows,
done by hand as the harness pass (PR #36). Declined: none.

## Latest run: 2026-10-01, after PRs #27 to #38

Trigger: 36 commits since the last audit: the DSA tab (#31), the dedupe
refactor (#34), the test-lock hardening (#35), the harness pass (#36),
friction aggregation (#37), and the site-description and lint cleanup (#38).
Stage 2b was not due (24 pipeline-log rows, as at the last aggregation).

Files audited: CLAUDE.md, README.md, every file under `docs/` (specs and
pipeline-log rows only for present-tense rules), `evals/` (READMEs, scenarios,
results), every file under `.claude/skills/`, `.claude/hooks/*.js`,
`.github/workflows/*.yml`, `.github/dependabot.yml`, and the site description
in `package.json`, `index.html`, `HomePage.tsx` and README: 53 files plus the
hooks.

Fixed:

- FR-03's planted defect is now caught by lint (`--deny-warnings` since #38),
  so it no longer tests the reviewer: marked due for rotation, and the
  evals/README trigger row now covers making lint stricter.
- `docs/verification.md`'s lock list left out `src/test/`, vitest snapshots
  and `vitest.config.*` files, which the lock does cover; the feature skill
  points implementers to that list.
- The feature skill's fixture, Writing Standard and "realistic trigger"
  passages named only `src/content/`, `src/system-design/`, content.md and
  case-studies.md; they now include `src/dsa/` and dsa.md.
- `nudge-precommit.js` reminded about docs on every DSA entry commit: its
  content-path pattern now includes `src/dsa/entries/` and `src/dsa/code/`.
- docs-audit Stage 1 still said the site description is duplicated "by
  necessity"; it now says package.json is the source and README the one copy.
- DESIGN.md's `check:colors` extensions, evals/README's and content.md's
  content kinds, and vite.config.ts's `?raw` glob list gained the DSA pieces
  added since.
- SR-17 asked for a diagram-width guard `check:diagrams` already has; it now
  asks for a node-count limit, which no check enforces.
- deploy.yml described direct pushes to main as normal; README restated the
  Node versions instead of pointing to `engines`; FR-01's title count was
  six, now eight.

The user then asked for the rest on the same branch:

- FR-03 rotated to a stale ref lint can't see, and FR-01 to a single defect
  (a quoted value with a trailing comment) with a correct guard, which ends
  its "Known flaw"; FR-02, FR-05 and FR-07's diffs were regenerated so every
  scenario applies to today's code. The feature-review eval ran on the result.
- One source per duplicated fact: lock coverage in verification.md (dsa.md
  points to it); pytest's config-file list only in the lock script; Python
  discovery and pytest pinning in dsa.md (verification.md and add-dsa-entry
  point to it; README keeps the install command for getting started); the
  `verify` chain only in package.json; the reference entries only in dsa.md.
  The nudge-sdlc hook's eval reminder now points to the evals/README table
  and fires for writing-standard.md too.
- Deleted: the `.gitkeep`, the copied `verify` block, dsa.md's copied lock
  list, DESIGN.md's history paragraph.
- Kept on purpose: the content skills are named in the pipeline-log header
  (the format `check:pipeline-log` enforces), the nudge-sdlc routing
  reminder (it routes), and content-review-eval (it maps scenarios to
  skills); each names them for its own job.
