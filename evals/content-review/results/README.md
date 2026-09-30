# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (template in `../HOW_TO_RUN.md`); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                              | Pass | Fail | Ambiguous | Note                                                    |
| ---------- | ---------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------- |
| 2026-09-16 | First run of the eval                                | 4    | 0    | 1         | CR-05 control needed redesign, not a review failure.    |
| 2026-09-21 | docs-audit flagged the CR-05 control                 | 1    | 0    | 0         | CR-05 only.                                             |
| 2026-09-24 | add-topic Stage 3 prompt and NON_NEGOTIABLES changed | 5    | 0    | 0         | Every reviewer read NON_NEGOTIABLES.                    |
| 2026-09-24 | CR-01 and CR-05 fixtures corrected                   | 4    | 0    | 0         | CR-05 tone clean.                                       |
| 2026-09-24 | CR-01 moved to engineering-practices                 | 2    | 0    | 0         | Structural findings gone.                               |
| 2026-09-28 | `add-case-study` and the CS-* scenarios added        | 8    | 0    | 0         | New scenarios passed first run.                         |
| 2026-09-28 | Controls fixed                                       | 4    | 0    | 0         | Re-run.                                                 |
| 2026-09-29 | add-case-study check (6), At a glance                | 3    | 0    | 0         | Check (6) worked in every run.                          |
| 2026-09-29 | Stage 3 triage wording, add-topic tone via Standard  | 8    | 0    | 0         | Latest run, below. No planted issue called theoretical. |

## Latest run: 2026-09-29, review triage

Run by: self
Trigger: `add-topic`'s and `add-case-study`'s Stage 3 prompts changed on
branch chore/review-triage. Each finding now needs a quote or a realistic
trigger, and anything else is labelled "theoretical". A decision already made
is re-raised only with new evidence. `add-topic`'s tone and figurative-language
criteria now point to docs/writing-standard.md instead of being listed in the
prompt. Both prompts changed, so every scenario ran. Each reviewer was told no
decisions had been made yet, since this was a first review round.

| ID    | Planted violation                                      | Review caught it?                                                                                                                                                   | Grade |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| CR-01 | Undefined jargon ("hash function")                     | Yes, as finding 5 (Medium): "hash functions" and "bit array" assumed, "no line on what a hash function is, or how its output becomes a bit position"                | PASS  |
| CR-02 | AI-patterned tone                                      | Yes, first High: the stacked intensifiers, "not just X — it's Y" and "That's the real power"; the identical bullet rhythm as finding 5                              | PASS  |
| CR-03 | Over-explained figurative language                     | Yes, first High: the "doesn't need to be a literal rubber duck" paragraph "is written entirely to rule out a literal reading nobody would make"                     | PASS  |
| CR-04 | Temperature 0 is fully deterministic                   | Yes, blocking: floating-point order, batch-dependent kernels and MoE routing, and providers' "best effort" wording; also noted it contradicts the summary's promise | PASS  |
| CR-05 | None (control, Semantic Versioning)                    | No false defect. Findings were true of the text: the header restated under `## How npm uses it`, "range" used without being named, the summary's framing            | PASS  |
| CS-01 | Read rate 10× too high (1,160/s average, 11,600 peak)  | Yes, first High: "10,000,000 ÷ 86,400 ≈ 116 per second on average", cross-checked against the failure modes' 1,160 at peak                                          | PASS  |
| CS-02 | First deep dive picks object storage without comparing | Yes, first High: "compares nothing", naming the data model's promised comparison and the costs of both options                                                      | PASS  |
| CS-03 | None (false-positive control)                          | No false defect. Every finding is true of the draft: the cache-loss percentile, per-IP limits under IPv6, length, the ID scheme argued against nothing              | PASS  |

### Notes

- **No planted violation was labelled "theoretical" or dismissed.** Reviewers
  used the label sparingly and only on side issues: CR-01's username race, and
  CS-01's and CS-03's secondary items (the list-call cost, `410`s escaping the
  guess counter, rate-limit counters evicted from the cache). Every planted
  problem was quoted and ranked as a real finding. The new quote-or-trigger
  rule showed no sign of weakening detection.
- **CR-02 and CR-03 held after the tone criteria moved to the Writing
  Standard.** Both reviewers read the pointer and cited the Standard's named
  patterns by name: "not just X — it's Y", the "that's the real X" closer,
  stacked intensifiers, identical bullet rhythm, and "defended against a
  literal misreading". Both put the planted problem first, as on 2026-09-28.
- **CR-01 caught the planted problem but ranked it lower (Medium, fifth).**
  On 2026-09-28 it was the headline. The reviewer put section placement
  (third) above it: a data structure belongs in `systems-and-infrastructure`
  more than in `engineering-practices`, which the registry describes as
  planning and process. The first two findings were the missing reason for
  false positives and the missing worked example, both true. This is the same
  kind of true structural finding that moved CR-01 out of
  `systems-and-infrastructure` on 2026-09-24. The grade is still PASS, because
  the missing definition is named in substance. If a later run drops the
  definition finding entirely, the fixture needs a section where a Bloom filter
  sits naturally without the closing-section rule, or the grade should become
  AMBIGUOUS.
- **CS-02's reviewer also flagged that "73 GB of metadata" is worked out only
  in At a glance.** That line lived in the deep dive the scenario removes, so
  it is the same planted gap, and it confirms check (6) still traces At a
  glance figures to the body.
- True gaps in the base draft that more than one CS reviewer raised (not
  graded):
  - the cache-loss argument needs the object store's p99, not its p95;
  - per-address limits don't hold against an IPv6 /64;
  - "p99" appears in At a glance but not in the body;
  - only the first Trade-offs bullet has a bold lead-in;
  - the keyed encryption step isn't explained on the page.
