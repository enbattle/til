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
| 2026-10-06 | Stage 3 now points at every Writing Standard bullet        | 12   | 0    | 0         | Full run; controls drew only true findings.                                |

## Latest run: 2026-10-06, Writing Standard bullets made canonical

- **Run by:** Claude (the orchestrating session).
  - A builder agent assembled each scenario's packet in a shuffled, neutrally named folder: the draft files, plus the Stage 3 instruction read fresh from `docs/content-review.md` with its checklist filled.
  - One fresh `general-purpose` reviewer per packet.
- **Trigger:** branch docs/dedupe-canonical-facts.
  - Stage 3's re-listed Writing Standard questions were replaced with "hold it to every bullet of docs/writing-standard.md, including its 'Case studies and DSA entries' section".
  - The word budget's canonical home moved into the Writing Standard.
  - Template rules moved from the content skills' checklists into docs/case-studies.md and docs/dsa.md.
- **Scope:** all scenarios, since the shared instruction changed.

| ID    | Planted violation                         | Caught?                                                                    | Grade |
| ----- | ----------------------------------------- | -------------------------------------------------------------------------- | ----- |
| CR-01 | "hash function" never defined             | Yes: named "hash function" and "bit array" as used before definition       | PASS  |
| CR-02 | AI-patterned tone                         | Yes: the "not just X — it's Y" closer, stacked intensifiers, bullet rhythm | PASS  |
| CR-03 | over-explained figurative phrase          | Yes: its top finding, plus the paragraph's self-contradiction              | PASS  |
| CR-04 | temperature 0 called fully deterministic  | Yes: blocking, with the floating-point and batching reasons                | PASS  |
| CR-05 | none (control)                            | Three true Lows (a heading restated, the PEP 440 framing, summary tension) | PASS  |
| CS-01 | read rate ten times too high              | Yes: High, recomputed as 116 a second and 1,160 at peak                    | PASS  |
| CS-02 | a decision that names no alternative      | Yes: High, the text-in-row alternative never answered                      | PASS  |
| CS-03 | none (control)                            | Two true Mediums (lifecycle-rule question, per-address cap vs a botnet)    | PASS  |
| CS-04 | "nobody can ever guess a valid link"      | Yes: High, against the page's own one-in-2.3-billion odds                  | PASS  |
| DS-01 | TypeScript loop bound drops the last item | Yes: blocking, with the thin TypeScript tests that miss it                 | PASS  |
| DS-02 | a walkthrough paragraph that narrates     | Yes: its top finding, including the broken hand-off                        | PASS  |
| DS-03 | none (control)                            | Five true Lows (subarray undefined, XOR, a transliteration judgment call)  | PASS  |

**Notes:**

- The shorter instruction ("every bullet") lost no coverage. Every planted kind was named as the most severe, or near-most severe, finding.
- Each control drew only findings that are true of the draft.
- **CS-03 drew two real Mediums.** The lifecycle-rule question and the per-address cap against a botnet are genuine gaps in the base draft, not fabrications. Consider tightening the base so the control stays quiet.
- **CR-05 and DS-03** both drew "subarray"- and "PEP 440"-style definition gaps that are true of the text.
