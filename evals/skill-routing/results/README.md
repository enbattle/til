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
| 2026-09-29 | At a glance and role splitting                               | 5    | 0    | 0         | No regression.                                               |
| 2026-09-29 | Finding triage and slimming (branch chore/review-triage)     | 4    | 0    | 0         | Scoped run; latest run, below.                               |

## Latest run: 2026-09-29, finding triage and slimming

Run by: self
Trigger: CLAUDE.md, feature/SKILL.md, SDLC.md and hooks edited (finding triage, slimming), branch chore/review-triage
Scope: SR-01, SR-03, SR-05 and SR-16 only. The harness change renamed Stage 4's step to "finding triage" while Stage 0 keeps "bug triage", so SR-05 (bug of unknown size) is the scenario most at risk of confusing the two, alongside SR-03 (trivial fix) and SR-01 (new feature) as the /feature-versus-direct boundary. SR-16 covers the content edit. No skill was added or renamed, so the rest did not run.

| ID    | Routing decision             | Reasoning (1 line)                                                                                          | Grade |
| ----- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----- |
| SR-01 | `/feature`                   | Search-dialog pagination is a nontrivial app/UI change with existing tests.                                 | PASS  |
| SR-03 | Direct, no skill             | CLAUDE.md says to skip the pipeline for a typo; no topic, case study or app code involved.                  | PASS  |
| SR-05 | Direct, starting with triage | CLAUDE.md says triage a bug of unknown size first, then route by the cause; escalate to /feature if needed. | PASS  |
| SR-16 | `content-audit`, one file    | Tightening an already-published case study's prose and checking its claims.                                 | PASS  |

### Notes

SR-05's agent guessed the fix was probably small (one component) before
triaging, but its answer was "triage first, escalate to `/feature` if the cause
needs a design decision", which is the Expected answer. The "finding triage"
rename in Stage 4 did not get confused with Stage 0's bug triage.
