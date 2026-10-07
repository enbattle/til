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
| 2026-10-07 | After PRs #99 to #107 (Computing Fundamentals) | Latest run, below.                                              |

Last friction aggregation (docs-audit Stage 2b): 2026-10-07, 203 data rows; five proposals (see Latest run) await the user's decision. Before that 2026-10-07, 183 rows, all five approved and applied (#99, and as new guards in #100). Before that 2026-10-06, 119 rows, whose four proposals were applied in #86. Earlier: 2026-10-04, 73 rows, all applied. Declined: none.

## Latest run: 2026-10-07, after PRs #99 to #107

**Trigger:** nine PRs since the last audit:

- the audit decisions (#99);
- the drift and rewrite guards: `check:eval-premises`, `links:inbound` and the hook's content-argument rule (#100);
- eval fixture premises (#101);
- the RAG topics and the docs-qa-assistant case study (#102, #103);
- the catalog overlap trims (#104);
- the Computing Fundamentals section, twelve pages over two batches (#105, #107), with CSRF rewritten as "CSRF and CORS";
- the hook timing-test fix (#106).

**Files audited:** 66: CLAUDE.md, README.md, `docs/**`, `evals/**`, `.claude/skills/**`, `.claude/hooks/*.js` and the `.github` YAML comments.

**Checked and accurate:**

- CLAUDE.md, README.md, content.md, case-studies.md and dsa.md name no section list or count;
- the `verify` chain, `links:inbound` and the hook's rule-2 summary;
- all nine skills against skill-routing-eval's target list;
- every section pin, which includes `computing-fundamentals`.

**Fixed (stale facts):**

1. The docs-audit gate now also runs `check:eval-premises` and `check:pipeline-log`, since this skill edits files both guard. The three eval skills run `check:eval-premises` after adding or editing a scenario.
2. SR-06's and SR-11's **Why** said add-topic covers only new topics; it also covers rewrites, merges and moves.
3. evals/README.md said `nudge-sdlc.js` covers "most" of the table's triggers; it covers some, and the sentence now names the gap.
4. The PowerShell hook's header pointed to a frozen spec for its vectors (now the test file), and listed a CRLF backtick continuation as a gap, though that shape is denied.
5. The drift-and-rewrite-guards row's **Escaped defect** cell now records #106's flaky timing test, as CLAUDE.md requires.

**Left open for the user:**

- **Duplication:**
  - the section list pinned in `registry.ts`, `registry.test.ts` (twice) and `App.coding-agents.test.tsx`;
  - verification.md restating the hook's rule 2 (rule 1's restatement was cut in the last audit);
  - premise forms spelled out in evals/README.md, verification.md and the three eval skills;
  - the named-company rule in the Writing Standard and four skill checklists;
  - what each structural test catches, in three skills and three docs;
  - the eval category list in SDLC.md and evals/README.md.
- **Deletion nominations:**
  - `App.coding-agents.test.tsx`'s pinned label list (derive it from `SECTIONS`);
  - SDLC.md's "Verifying the process itself" cut to a pointer;
  - content-audit Stage 1's historical aside.
- **Friction aggregation (Stage 2b, 203 rows):** five groups, for the user to decide:
  1. **Guard specs keep missing vectors, found in review** (6 rows, up to 21 agents). Proposed: the first review lists every vector it can build as planted-case rows, fixed in one round, instead of asking the spec to list them all.
  2. **Drafts contradict their own examples, most often in the rule of thumb** (inconsistency in 14 of the last 21 rows). Proposed: the batch self-check quotes add-topic's checklist item (3) and tests the rule against each example before handoff.
  3. **Batch gates fail on tests outside `src/content` that pin content** (3 rows). Proposed: derive `App.coding-agents.test.tsx`'s labels from `SECTIONS`.
  4. **Fix-round edits create new errors, and some fixes ship without re-review** (7 rows, nothing escaped). Proposed: at the cap, send the changed sentences back to the same reviewer by SendMessage instead of skipping the check.
  5. **Wall-clock test bounds flake** (2 rows). Proposed: drop the timing assertion rather than loosen it.

**Evals:** skill-routing SR-09, 10, 12 and 14 (the edited skills and hook), at Stage 3.
