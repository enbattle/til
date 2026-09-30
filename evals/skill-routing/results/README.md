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
| 2026-09-29 | add-case-study batch mode (branch chore/harness-practices)   | 1    | 0    | 0         | SR-15 only; prompt refreshed; latest run, below.             |

## Latest run: 2026-09-29, add-case-study batch mode

Run by: self
Trigger: `add-case-study/SKILL.md` gained a batch-mode section (branch chore/harness-practices)
Scope: SR-15 only. It is the one scenario whose Expected answer is `add-case-study`; the new section changes how the skill runs, not what it's for, so the other scenarios didn't run.

**Scenario fixed before running:** SR-15's prompt asked for "a chat app like WhatsApp", but that case study now exists (`messaging.md`, "Design a Chat App (like WhatsApp and Slack)"), which makes the prompt arguably a request to edit an existing one (`content-audit`, per SR-16). The prompt now names a collaborative document editor like Google Docs, which has no case study yet. Expected is unchanged.

| ID    | Routing decision | Reasoning (1 line)                                                                                                                     | Grade |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| SR-15 | `add-case-study` | A new "design X" case study with diagrams; not a catalog topic, not an existing case study's prose, not app code; checked none exists. | PASS  |

### Notes

The agent checked `src/system-design/case-studies/` for an existing
collaborative-editor case study before deciding, so the existence check that
made the old prompt stale is one a real session does make. The batch-mode
section didn't pull a single-case-study request toward some other route.
`add-case-study`'s own description still gives "a chat app case study" as an
example trigger, which now names an existing case study.
