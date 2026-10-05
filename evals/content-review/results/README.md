# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                    | Pass | Fail | Ambiguous | Note                                                                       |
| ---------- | ---------------------------------------------------------- | ---- | ---- | --------- | -------------------------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                      | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.                       |
| 2026-09-21 | docs-audit flagged the CR-05 control                       | 1    | 0    | 0         | CR-05 only.                                                                |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed       | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                                       |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                         | 4    | 0    | 0         | CR-05 tone clean.                                                          |
| 2026-09-24 | CR-01 moved to engineering-practices                       | 2    | 0    | 0         | Structural findings gone.                                                  |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added              | 8    | 0    | 0         | New scenarios passed first run.                                            |
| 2026-09-28 | Controls fixed                                             | 4    | 0    | 0         | Re-run.                                                                    |
| 2026-09-29 | add-case-study check (6), At a glance                      | 3    | 0    | 0         | Check (6) worked in every run.                                             |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard        | 8    | 0    | 0         | No planted issue called theoretical.                                       |
| 2026-10-01 | Shared content-review template; DS-* scenarios added       | 11   | 0    | 0         | Full run.                                                                  |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes                     | 6    | 0    | 0         | CS-* and DS-*.                                                             |
| 2026-10-02 | DSA tab completed (39 new entries), batch-mode edits       | 3    | 0    | 0         | DS-* only; Prefix Sums now exists, so it was excluded from existing items. |
| 2026-10-05 | Five-minute content standard; CS and DS fixtures rewritten | 12   | 0    | 0         | All scenarios, CS-04 new; CS-03 and CS-04 re-run after a base fix.         |

## Latest run: 2026-10-05, five-minute content standard

**Follow-up run, same day: CS-01 to CS-04, 4/4 PASS.** The trigger was the user's
pilot feedback that Key numbers didn't say where each figure lands. The rule
went into docs/case-studies.md, the add-case-study checklist and SKILL.md, and
the CS base gained the opening sentence and part-named leads. Every planted
problem was caught and ranked first. The CS-03 control drew no false finding.
Three of the four reviews flagged the same real gap in the base: the
create-flooding answer limited requests while storage is what shapes the
design. The base now caps bytes per address, and the summary no longer says
"unguessable". Those last edits were not re-reviewed.

### First run

Run by: self
Trigger: branch `docs/digestible-content`. The Writing Standard gained a "Case studies and DSA entries" section (five-minute budget, enough to reason, one rejected alternative per decision, a rule of thumb, a lecturer's voice, comments that carry the why); `docs/content-review.md`'s Stage 3 instruction gained a sentence holding case studies and DSA entries to it; `add-case-study`'s checklist and Stage 3 checklist and `add-dsa-entry`'s Stage 3 checklist changed. Scope: all scenarios, since the Writing Standard and the shared Stage 3 instruction both changed.
Fixture changes: the CS-* base was rewritten to the five-minute template (three `Decision:` sections, about 1,140 words of prose); CS-02 became "a decision that names no alternative"; CS-04, "a compression overclaim", is new. The DS-* base now carries why-comments in both code files, a counting function, two walkthrough pairs and about 1,000 words of prose. Reviews ran from neutral folder names with the scenario key kept outside them.

| ID    | Planted violation                                       | Caught?                                                                                                | Grade |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----- |
| CR-01 | Undefined jargon (bloom filters)                        | Yes: hash function, bit array and false positive used before defined, ranked second                    | PASS  |
| CR-02 | AI-patterned tone (feature flags)                       | Yes: the "not just X — it's Y" crutch, the "real power" closer and stacked intensifiers, ranked first  | PASS  |
| CR-03 | Over-explained figurative language (rubber duck)        | Yes: the paragraph defending the duck against a literal reading, ranked first                          | PASS  |
| CR-04 | False technical claim (temperature 0 is deterministic)  | Yes: batching, floating-point and provider behavior, ranked first as a blocker                         | PASS  |
| CR-05 | None (control, semantic versioning)                     | No defect; four Lows, all true of the text; it applied the new section to case studies and DSA only    | PASS  |
| CS-01 | Read rate off by ten                                    | Yes: 116 a second, not 1,160, ranked first                                                             | PASS  |
| CS-02 | Storage decision names no alternative                   | Yes: "So why not keep the text in the row?" is never answered, ranked first                            | PASS  |
| CS-03 | None (control)                                          | No false finding; true findings listed in the notes; re-run after the base fix, again no false finding | PASS  |
| CS-04 | A follow-up says nobody can ever guess a link           | Yes: against the page's own odds, ranked first; re-run after the base fix, caught again                | PASS  |
| DS-01 | TypeScript loop stops one short; weakened TS tests pass | Yes: `[0, 3, 4, 8, 9, 0]` and the ranges it breaks, plus why the TS tests miss it                      | PASS  |
| DS-02 | The paragraph after `range_sum` narrates                | Yes: ranked first, naming that it repeats the code and drops the hand-off                              | PASS  |
| DS-03 | None (control)                                          | No defect; three Lows, all true or defensible                                                          | PASS  |

Notes:

- _*Every CS-* review flagged the same real gap in the first base:_* the paste-ID decision rejected a plain counter instead of random IDs, the alternative a reader would actually suggest, and kept seven characters with no reason. That is the new "why not the obvious alternative" check working on the control, so the base was fixed (ten random characters; the shortener's seven is now the rejected alternative), and CS-03 and CS-04 were re-run.
- **Both re-runs found a defect the fix introduced:** writing the text before a conditional row insert lets a clash overwrite a live paste. The base now writes the text with a conditional put. Three smaller fixes went in with it: the botnet cap now leads its follow-up, the rule of thumb no longer reads "rather than secrets", and the expiry requirement says "by the next daily cleanup". These last edits were not re-reviewed.
- **Open on the CS-03 control:** "why a cache at all, when the miss path meets 500 ms?" was raised once and left as a true observation, since the budget is nearly spent.
- _*Open on the DS-* base:_* "only works when every value is positive" was called slightly strong by two reviews and defensible by a third. Counting exact sums with zeros present does break a plain window, so it was left as is.
- **Reviewer arithmetic slip, not graded:** the CS-04 re-run computed the ten-character botnet figure as 96 hours rather than about 2,300 hours. It doesn't affect the grade, because the planted overclaim is what it caught.
