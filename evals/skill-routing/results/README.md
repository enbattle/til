# Skill-routing eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (template in `../HOW_TO_RUN.md`); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                      | Pass | Fail | Ambiguous | Note                                                         |
| ---------- | ------------------------------------------------------------ | ---- | ---- | --------- | ------------------------------------------------------------ |
| 2026-09-14 | Initial validation of the suite                              | 8    | 0    | 0         | Baseline.                                                    |
| 2026-09-14 | CLAUDE.md now names `add-topic`                              | 1    | 0    | 0         | Hook-prompted re-run.                                        |
| 2026-09-14 | `docs-audit` added (SR-09)                                   | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-14 | `skill-routing-eval` added (SR-10)                           | 1    | 0    | 0         | New skill found.                                             |
| 2026-09-15 | `content-audit` added (SR-11)                                | 3    | 0    | 0         | Red before, green after; SR-02 and SR-09 unaffected.         |
| 2026-09-16 | `content-review-eval` added (SR-12)                          | 3    | 0    | 0         | Also fixed a routing list that omitted `skill-routing-eval`. |
| 2026-09-20 | `system-design-navigation-eval` added (SR-13, since retired) | 5    | 0    | 0         | No collisions.                                               |
| 2026-09-21 | /feature Stage 6 retro and related edits                     | 6    | 0    | 1         | One near-miss.                                               |
| 2026-09-21 | Re-check after the independent read                          | 2    | 0    | 1         | Near-miss persisted, graded ambiguous.                       |
| 2026-09-23 | Process hardening; `feature-review-eval` added (SR-14)       | 7    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Commits 6197731, 487b849                                     | 8    | 0    | 1         | One near-miss.                                               |
| 2026-09-24 | Triage-first rule for bugs (4b0b19f)                         | 8    | 0    | 0         | SR-05 twice.                                                 |
| 2026-09-24 | Pre-merge of PR #11, all scenarios                           | 14   | 0    | 0         | No regression.                                               |
| 2026-09-25 | CLAUDE.md "How changes land"                                 | 4    | 1    | 0         | SR-08 failed: no doc covered dependency updates.             |
| 2026-09-25 | SR-08 re-check after the dependency-update note              | 3    | 0    | 0         | Fix held twice.                                              |
| 2026-09-28 | Case studies replace question pages (SR-15..17)              | 16   | 0    | 0         | All live scenarios.                                          |
| 2026-09-29 | CLAUDE.md split into a router plus docs                      | 4    | 0    | 0         | Scoped run.                                                  |
| 2026-09-29 | At a glance and role splitting                               | 5    | 0    | 0         | Latest run, below.                                           |

## Latest run: 2026-09-29, at a glance and role splitting

Run by: self
Trigger: `.claude/skills/feature/SKILL.md` gained a Stage 1 bullet on
markdown-reading checks and a paragraph on running one role as several
agents; `.claude/skills/add-case-study/SKILL.md`'s template now starts with
`At a glance` and its Stage 3 review gained check (6); `docs/SDLC.md` notes the
three agents are roles. No skill was added or renamed, so only the scenarios
whose routing depends on those files ran: the two `/feature` scenarios and the
three case-study ones.

| ID    | Routing decision          | Reasoning (1 line)                                                                 | Grade |
| ----- | ------------------------- | ---------------------------------------------------------------------------------- | ----- |
| SR-01 | `/feature`                | Search-dialog pagination changes app code and UI, so it needs the pipeline.        | PASS  |
| SR-07 | `/feature`                | Reading time on cards and topic pages is a multi-component UI change.              | PASS  |
| SR-15 | `add-case-study`          | A new case study with D2 diagrams is exactly that skill's scope.                   | PASS  |
| SR-16 | `content-audit`, one file | Tightening an already-published case study's prose and claims.                     | PASS  |
| SR-17 | `/feature`                | Page layout and render-script tooling are app code, which add-case-study excludes. | PASS  |

### Notes

Each agent routed from CLAUDE.md's table and the skill descriptions with at
most a grep, so the new `SKILL.md` text didn't change any routing decision.
The role-splitting paragraph and the `SDLC.md` note didn't pull anyone
towards a different skill.
