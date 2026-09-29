# Content-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (template in `../HOW_TO_RUN.md`); git history keeps
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
| 2026-09-29 | add-case-study check (6), At a glance                | 3    | 0    | 0         | Latest run, below.                                   |

## Latest run: 2026-09-29, case-study summaries

Run by: self
Trigger: `add-case-study`'s Stage 3 review gained check (6), which checks the
`At a glance` section against the body, and the case-study base draft (the
CS-03 control) gained an `At a glance` section (branch
feature/case-study-at-a-glance). Only `add-case-study`'s prompt changed, so only
the `CS-*` scenarios ran.

| ID    | Planted violation                                      | Review caught it?                                                                                                                                              | Grade |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| CS-01 | Read rate 10× too high (1,160/s average, 11,600 peak)  | Yes, as its first High: "10,000,000 ÷ 86,400 ≈ 116/s ... about 1,160/s at peak", cross-checked against 12 writes/s × 10 and the failure-modes figure           | PASS  |
| CS-02 | First deep dive picks object storage without comparing | Yes, as its first High: "compares nothing", naming the data model's promised comparison and the costs a fair comparison has to weigh                           | PASS  |
| CS-03 | None (false-positive control)                          | No false defect. Every finding is true of the draft: the order clash, per-sender storage, file-storage overlap, per-IP limits, the diagram's missing find step | PASS  |

### Notes

- All three reviewers flagged `order: 2` in the base draft, which now clashes
  with `rate-limiter.md`. This finding is true of the fixture, which predates the rate
  limiter's order. It isn't graded, but the base draft should move to
  `order: 17` so future runs aren't distracted by it. Reported rather than
  patched mid-eval.
- The new check (6) did work in every run. CS-01's and CS-03's reviewers
  counted the `At a glance` section (about 313 words), checked its figures and
  anchors against the body, and confirmed it omits the read rate. CS-02's
  reviewer traced the section's "73 GB" decision to the argument the planted
  gap removed, so the summary didn't mask the missing comparison.
- True gaps in the base draft, recorded here and not graded:
  - the guessing and create limits are per IP address, so an IPv6 /64 or a
    botnet escapes them;
  - one sender at the create limit can store about 7.4 GB a day;
  - the diagram leaves out the cleanup job's lookup;
  - the Trade-offs lead-ins are inconsistent.
