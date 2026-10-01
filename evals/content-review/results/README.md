# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what the `content-review-eval` skill's Stage 2 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                              | Pass | Fail | Ambiguous | Note                                                 |
| ---------- | ---------------------------------------------------- | ---- | ---- | --------- | ---------------------------------------------------- |
| 2026-09-16 | First run of the eval                                | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure. |
| 2026-09-21 | docs-audit flagged the CR-05 control                 | 1    | 0    | 0         | CR-05 only.                                          |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                 |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                   | 4    | 0    | 0         | CR-05 tone clean.                                    |
| 2026-09-24 | CR-01 moved to engineering-practices                 | 2    | 0    | 0         | Structural findings gone.                            |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added        | 8    | 0    | 0         | New scenarios passed first run.                      |
| 2026-09-28 | Controls fixed                                       | 4    | 0    | 0         | Re-run.                                              |
| 2026-09-29 | add-case-study check (6), At a glance                | 3    | 0    | 0         | Check (6) worked in every run.                       |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard  | 8    | 0    | 0         | No planted issue called theoretical.                 |
| 2026-10-01 | Shared content-review template; DS-* scenarios added | 11   | 0    | 0         | Full run.                                            |
| 2026-10-01 | Pastebin and Prefix Sums fixture fixes               | 6    | 0    | 0         | CS-* and DS-*; latest run, below.                    |

## Latest run: 2026-10-01, fixture fixes

Run by: self
Trigger: branch chore/aggregate-friction fixed the real gaps earlier reviews
found in the shared fixtures. Pastebin base: IPv6 limits keyed per /56,
the botnet case priced (about 100 finds an hour from 10,000 addresses; an
eighth character would make a guess 1 in about 600,000) with the reason seven
characters stays, "p99" tied to the body, the contents deep dive's conclusion
argued from database size, a split run-on sentence, "botnet" defined, and
bold leads on every Trade-offs bullet. Prefix Sums base: rounding past 2⁵³ and
`itertools.accumulate` named. Only the scenarios built on those bases ran
(`CS-*`, `DS-*`); prompts were built fresh from `docs/content-review.md`.

| ID    | Planted violation                                      | Review caught it?                                                                                    | Grade |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----- |
| CS-01 | Read rate 10× too high                                 | Yes, first High: 10,000,000 ÷ 86,400 ≈ 116, contradicting the failure modes' 1,160 at peak           | PASS  |
| CS-02 | First deep dive picks object storage without comparing | Yes, first High: "compares no options", naming the three places that promise the comparison          | PASS  |
| CS-03 | None (control)                                         | No false defect; final run on the corrected text had no medium or high finding, three true lows      | PASS  |
| DS-01 | TypeScript loop drops the last element; tests miss it  | Yes, blocking: ran it (`[0, 3, 4, 8, 9, 0]`), plus High that both TypeScript tests pass with the bug | PASS  |
| DS-02 | The `range_sum` walkthrough paragraph only narrates    | Yes, the one real finding: "repeats the code in words and never says why"                            | PASS  |
| DS-03 | None (control)                                         | "Nothing that needs fixing"; ran `accumulate` and checked 2⁵³ + 1 in Node; optional notes only       | PASS  |

### Notes

- **A fixture fix can add its own error.** The first IPv6 edit said a home is
  usually given one /64, which is false (a /64 is one local network; homes
  usually get a /56 or /60), and the CS-02 reviewer caught it. The fixed text
  was re-run on CS-03 before logging. Check a fixture edit's own claims as
  hard as the draft's.
- **The controls are quieter.** CS-03 went from five true findings, one of
  them Medium, to three lows: `410` could be near-exact by decrypting IDs
  against the counter, the object key is never named, and some homes get a
  /48. DS-03's reviewer found nothing that needs fixing. These stay as notes.
