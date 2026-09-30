# Docs audit results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (trigger, files audited, findings, fixed, left open); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                              | Note                                                            |
| ---------- | ------------------------------------ | --------------------------------------------------------------- |
| 2026-09-24 | Process-hardening batch before merge | 14 inaccurate claims, 11 hand-copied facts; text fixes applied. |
| 2026-09-24 | Pre-merge audit of PR #11            | 24 inaccurate claims, 15 copied facts; text fixes applied.      |
| 2026-09-29 | After PRs #19 to #22                 | Latest run, below.                                              |

## Latest run: 2026-09-29, after PRs #19 to #22

Trigger: batches 2 and 3 of the case studies (#19, #20), the ride-sharing
encoding fix (#21) and the `At a glance` feature with its retro edits (#22).

Files audited: CLAUDE.md, README.md, every file under `docs/` (spec files and
pipeline-log rows only for present-tense rules), every file under
`.claude/skills/`, `.claude/hooks/*.js`, `.github/dependabot.yml`,
`.github/workflows/*.yml`, the `evals/` READMEs, how-to-run files and scenarios,
and the site description in `package.json`, `index.html` and README. The dated
`evals/*/results/*.md` logs were left out: they are history, and the audit
only flags present-tense rules in them anyway. Case-study prose was out of
scope, since a trim pass was editing it at the time.

Fixed:

- Diagram size rules disagreed. `docs/case-studies.md` and
  add-case-study Stage 1 said 6–10 nodes; the checklist said 8–11. Both now
  point to checklist item 5.
- The feature skill said "This run needed that for about 110,000 words". It now
  names the dated run.
- content-audit Stage 1 put all 16 case studies in one "small" batch. It now
  splits them so each agent can read its share in full.
- content-audit criterion 4 gained the `At a glance` check.
- DEFERRED_PRACTICES said commits go "straight to `main`" in the present tense.
  It now gives the PR-only rule and treats the old practice as history.
- docs-audit's own file list said "every `SKILL.md`", which skipped
  `checklist.md`. It now says "every file under `.claude/skills/`", and its
  gate runs `check:claude-md`.
- `docs/verification.md` quoted a stale main-chunk size (91 KB; it's now about
  93 KB). The figure is replaced with a pointer to `npm run size`.
- `docs/case-studies.md`'s example frontmatter gave the URL shortener
  `order: 2`. It is 1.
- `docs/DESIGN.md` said `check:colors` scans "anywhere under `src/`". It scans
  `.ts`, `.tsx`, `.css` and `.d2` files.

Left open for the user:

- The one-line site description (5 copies) doesn't mention the System Design
  tab.
- CLAUDE.md doesn't say a role can run as several agents. `docs/SDLC.md` and the
  feature skill do.
- `nudge-sdlc.js` doesn't remind about evals for `docs/writing-standard.md` or
  `add-case-study/checklist.md` edits. This is known: evals/README says "most of".
- Duplication with no single source:
  - the case-study heading template (the structure test, `docs/case-studies.md`
    and add-case-study);
  - the `At a glance` shape (`docs/case-studies.md`, add-case-study Stages 1 and
    3, checklist item 11);
  - the case-study content rules (Writing Standard, add-case-study, checklist,
    content-audit);
  - the Writing Standard tone list copied into content-audit;
  - the verify chain copied into `docs/verification.md`;
  - the 2-round cap restated in README and SDLC.md;
  - the eval triggers repeated in the hook text.
- Four merged diagrams are 953–1004 px wide: two in file-storage, two in
  notification-system. The trim pass may address them.
