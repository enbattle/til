# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what `../HOW_TO_RUN.md` step 6 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                         | Pass | Fail | Ambiguous | Note                                                         |
| ---------- | ------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------ |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                            | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.          |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                         | 2    | 0    | 0         | Top finding both runs.                                       |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                         | 8    | 0    | 0         | No rotation.                                                 |
| 2026-09-24 | FR-05 added (subtler defect)                                                    | 3    | 0    | 0         | Ceiling effect persists.                                     |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical.       |
| 2026-09-29 | New triage scenarios FR-06/FR-07 (branch chore/harness-practices)               | 4    | 0    | 0         | Triage only; both outcomes matched twice. Latest run, below. |

## Latest run: 2026-09-29, triage scenarios

**Trigger:** new triage scenarios FR-06/FR-07 (branch chore/harness-practices).
They test Stage 4's finding triage, not the reviewer, so no reviewer
instruction changed and nothing was rotated.

**Scenarios run:** FR-06 and FR-07 only, twice each, so four runs, all in
parallel on fresh `general-purpose` agents (never a fork). Each got the
scenario's Spec, Diff (as `npm run review:diff` output) and Finding, Stage 4's
finding-triage instruction and its four outcomes (with their lead-in
paragraph) copied verbatim from `.claude/skills/feature/SKILL.md`, and the
line "Propose one outcome for each finding; don't read anything under evals/."

**Premise check before running:** FR-06: exactly the three summaries the
scenario names contain `vs. `, and the diff's function cuts
`git-rebase-vs-merge.md`'s to "...on a private branch vs." FR-07: a node scan
of all 79 summaries (topics and case studies) found none with a second
sentence under either `[A-Z]` or `\p{Lu}`, and no non-ASCII letter at all.
Diff context matches the current files (`content.ts:159-161`,
`content.test.ts`, `CASE_STUDIES` exported from `system-design.ts`). No
scenario needed fixing.

| ID    | Run | Proposed outcome and evidence                                                                                                                                                                  | Grade |
| ----- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-06 | 1   | Fix with a test. Grepped the three `vs. ` summaries, ran the diff's function in node from the scratchpad and quoted two truncated outputs; called the finding reachable, not theoretical.      | PASS  |
| FR-06 | 2   | Fix with a test. Same three files and the same truncated git-rebase output; rejected the finding's "possibly theoretical" and said the impact is above Medium (search results, link previews). | PASS  |
| FR-07 | 1   | Known limitation. Reproduced with `Émile` and `Ölçü` in node; all 79 summaries' only non-ASCII character is the em dash; `docs/content.md:22` and `docs/case-studies.md:33` say one sentence.  | PASS  |
| FR-07 | 2   | Known limitation. Same reproduction and grep (no accented capital anywhere in content); no doc/code mismatch; offered the `\p{Lu}` one-line fix as optional, "not required".                   | PASS  |

**Disagreements between runs:** none on outcome. FR-06 runs differed on
severity (run 1 kept Medium, run 2 said higher).

### Notes

- **The triagers overruled the finding's own hedge in both directions.** FR-06's
  finding said "possibly theoretical", and both runs rejected that with real
  files. FR-07's finding said Medium, and both runs downgraded it to Known
  limitation with evidence. Neither followed the reviewer's framing.
- **FR-06's finding text gives the answer away.** "Possibly theoretical if no
  summary uses one" tells the triager what to grep for. A harder variant would
  leave the hedge out, or name an abbreviation no summary uses while a
  different one (`e.g.`) does.
- **FR-07 run 2's optional fix is a mild nudge.** It proposed Known limitation
  plainly, then called the `\p{Lu}` fix "worth doing if it's cheap to include".
  Graded PASS because the outcome itself isn't hedged, but an orchestrator
  could read it as Fix. Run 1 also mentioned the fix, more neutrally.
- **No triager made a repo copy.** The instruction says to reproduce "in a
  copy outside the working tree, via `git worktree add` or `cp -R`"; all four
  ran the diff's logic as node one-liners or scratch scripts instead, which
  is enough for a pure function. None edited the working tree.
