# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                          | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ---------------------------------------------------------------- | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                            | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                             | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed             | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                               | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                             | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added                    | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                                   | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                            | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard              | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added             | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes                           | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits             | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |
| 2026-10-05 | Five-minute content standard; CS and DS fixtures rewritten       | 12   | 0    | 0         | All scenarios, CS-04 new; CS-03 and CS-04 re-run after a base fix.         |
| 2026-10-06 | Stage 3 now points at every Writing Standard bullet              | 12   | 0    | 0         | Full run; controls drew only true findings.                                |
| 2026-10-07 | Catalog standard in the Writing Standard and add-topic checklist | 5    | 0    | 0         | CR-* only; fixtures now lag the standard (follow-up).                      |
| 2026-10-07 | CR-01..05 fixtures brought to the catalog standard               | 5    | 0    | 0         | CR-01 and CR-05 re-run once; CR-01 plant caught but ranked third.          |

## Latest run: 2026-10-07, CR fixtures brought to the catalog standard

- **Run by:** Claude (the orchestrating session). Each scenario got one fresh `general-purpose` reviewer with the Stage 3 instruction from docs/content-review.md, filled in for add-topic. The draft was extracted to a scratch file, so no reviewer read `evals/`.
- **Trigger:** the follow-up from #87. CR-01..05 were rewritten to the catalog standard: title pattern, one running example, the lecturer voice, a closing rule of thumb, and 600–900 words. Each planted passage was kept verbatim.
- **Scope:** CR-01..05. CR-01 and CR-05 were re-run after the first round's polish.

| ID    | Planted violation                        | Caught                                                                                      | Grade |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------- | ----- |
| CR-01 | "hash function" undefined                | Yes. In round 1 it ranked third, behind two true fixture findings; in round 2, third again. | PASS  |
| CR-02 | AI-patterned tone                        | Yes, all three parts (closer, intensifiers, uniform list), ranked first.                    | PASS  |
| CR-03 | over-explained analogy                   | Yes, as a High, ranked first.                                                               | PASS  |
| CR-04 | temperature 0 called fully deterministic | Yes, as a High, ranked first.                                                               | PASS  |
| CR-05 | none (control)                           | No false findings in either round; only true Lows.                                          | PASS  |

**Notes:**

- **CR-01 fixture changes.** Round 1 rightly said a data structure belongs in `systems-and-infrastructure`, not `engineering-practices`, so the scenario moved there and gained a "Where you'll meet this" section. Round 2 then flagged two more true issues, and both were fixed afterwards:
  - a third system named from outside the fixed set;
  - an unconditional "definitely not" in a setup with per-server copies.

  CR-01 was not run a third time.

- **Ranking.** The plant was caught every time but ranked behind other true findings. Expect that pattern until a clean run shows the plant first.
- **True Lows from round 1, fixed in the fixtures:**
  - CR-02: an overstated propagation time, and two terms left unglossed;
  - CR-04: three paragraphs out of the lecturer voice, and an overstated probability;
  - CR-05: a heading restated, "range" never introduced, and two unglossed terms.
- **CR-05 round 2.** It drew the Dependabot sentence (wording introduced by the round 1 fix), a Python aside under the npm heading, and a header restated. All were fixed. CR-05 wasn't re-run after this last polish.
