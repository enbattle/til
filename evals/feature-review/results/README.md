# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `feature-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                         | Pass | Fail | Ambiguous | Note                                                         |
| ---------- | ------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------ |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                            | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.          |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                         | 2    | 0    | 0         | Top finding both runs.                                       |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                         | 8    | 0    | 0         | No rotation.                                                 |
| 2026-09-24 | FR-05 added (subtler defect)                                                    | 3    | 0    | 0         | Ceiling effect persists.                                     |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical.       |
| 2026-09-29 | New triage scenarios FR-06/FR-07 (branch chore/harness-practices)               | 4    | 0    | 0         | Triage only; both outcomes matched twice.                    |
| 2026-10-01 | Lint went strict (FR-03 rotated), FR-01 rotated, Stage 4 wording for DSA        | 13   | 1    | 0         | FR-07 split.                                                 |
| 2026-10-01 | FR-07 finding replaced (unreachable by construction)                            | 2    | 0    | 0         | Both proposed Reject, each with a reproduction.              |
| 2026-10-04 | Escaped defect (FR-08 added); Stage 4 guard sentence edited (FR-02 rotated)     | 16   | 0    | 0         | Every planted defect was each review's top finding.          |
| 2026-10-06 | Stage 4 Writing Standard clause (FR-05 rotated, FR-04 control rebuilt)          | 16   | 0    | 0         | Old FR-04 drifted (voided, 2 runs); new control clean twice. |

## Latest run: 2026-10-06, Stage 4 Writing Standard clause

- **Run by:** Claude (the orchestrating session).
  - An agent rotated FR-05 and built the packets in shuffled, neutrally named folders.
  - One fresh `general-purpose` reviewer per packet; each scenario ran twice.
- **Trigger:** branch docs/dedupe-canonical-facts edited Stage 4's reviewer instruction in its content clause only:
  - it names the content globs;
  - it points at every bullet of docs/writing-standard.md, including "Case studies and DSA entries";
  - it exempts a test fixture planted to break a rule.
- **Rotation:** FR-05's defect now sits two calls from the diff, as its own text asked. A "Search tips" `<details>` can't be reached by Tab because `useFocusTrap`'s `FOCUSABLE_SELECTOR` has no `summary`.
- **Drifted control:** FR-04's old diff added `readingMinutes` at 200 wpm to `content.ts`. Since `src/lib/reading-time.ts` landed in #70/#71, that diff duplicates it and contradicts the canonical 230, which both runs correctly flagged as High. FR-04 now plants an "N topics" line on section pages through one shared helper, checked clean against the current code, and was re-run twice.

| ID    | Run | Finding summary                                                                   | Grade  |
| ----- | --- | --------------------------------------------------------------------------------- | ------ |
| FR-01 | 1   | Medium: `"Use # for comments" # draft` cut inside the quotes                      | PASS   |
| FR-01 | 2   | Medium: same cause and fix                                                        | PASS   |
| FR-02 | 1   | High: no `rel="noreferrer"`, NN #7                                                | PASS   |
| FR-02 | 2   | High: same, with the two in-repo precedents                                       | PASS   |
| FR-03 | 1   | High: `queryRef` never updated, so Escape always closes                           | PASS   |
| FR-03 | 2   | High: same                                                                        | PASS   |
| FR-04 | 1–2 | High: duplicates `reading-time.ts` at 200 wpm (true; the old control had drifted) | voided |
| FR-04 | 3   | New control: no defect; two true Low test-gap notes                               | PASS   |
| FR-04 | 4   | New control: no defect; true Low notes                                            | PASS   |
| FR-05 | 1   | High: `FOCUSABLE_SELECTOR` lacks `summary`; tips unreachable, Tab escapes         | PASS   |
| FR-05 | 2   | High: same cause, both symptoms                                                   | PASS   |
| FR-06 | 1   | Fix with a test; reproduced on three real `vs.` summaries                         | PASS   |
| FR-06 | 2   | Fix with a test; same reproduction                                                | PASS   |
| FR-07 | 1   | Reject; the loader throws at import, shown by a run                               | PASS   |
| FR-07 | 2   | Reject; same evidence                                                             | PASS   |
| FR-08 | 1   | High: strip missing from `scroll-padding-top`, WCAG 2.4.11                        | PASS   |
| FR-08 | 2   | High: same, including focus                                                       | PASS   |

**Notes:**

- **No run disagreed with its pair.**
- **The rotation worked as a harder test.** Both FR-05 runs followed the call chain into another module and rated the defect High, so the ceiling effect persists even at two hops.
- **Two problems surfaced outside the scores:**
  - **Fixtures drift.** The FR-04 drift shows the diffs need re-checking against current code before each run, not only `git apply --check`: a diff can apply cleanly and still duplicate code that arrived later. The skill's Stage 0 should say so.
  - **A destructive slip during the run.** One triage agent linked the repo's `node_modules` into a scratch worktree with a junction. `git worktree remove --force` then emptied the real folder. `npm ci` restored it, and future briefs warn against linking.
