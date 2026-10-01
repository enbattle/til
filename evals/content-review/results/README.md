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
| 2026-10-01 | Shared content-review template; DS-* scenarios added | 11   | 0    | 0         | Full run; latest run, below.                         |

## Latest run: 2026-10-01, harness pass

Run by: self
Trigger: branch chore/harness-pass. The three content skills' Stage 3 prompts
became one shared template in `docs/content-review.md`, filled in with each
skill's `<kind>` and `<checklist>`; `add-topic`'s instruction now enumerates
the Writing Standard's checks as the other two did. The DSA scenarios
(`DS-01`..`DS-03`) are new. Every scenario ran, each with its prompt built
fresh from the template; `add-topic`'s two checklist items were "none" (no
draft links anything, and none is in `systems-and-infrastructure`).

| ID    | Planted violation                                      | Review caught it?                                                                                                                                   | Grade |
| ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| CR-01 | Undefined jargon ("hash function")                     | Yes, High: "hash function" is "the core building block" and never explained; "bit array" and "false positive" only partly                           | PASS  |
| CR-02 | AI-patterned tone                                      | Yes, first finding: the stacked intensifiers, "not just a toggle — it's a deployment strategy in disguise" and "That's the real power"              | PASS  |
| CR-03 | Over-explained figurative language                     | Yes, first High: the "doesn't need to be a literal rubber duck" paragraph "defends against a literal reading nobody would make"                     | PASS  |
| CR-04 | Temperature 0 is fully deterministic                   | Yes, blocking: non-associative floating point, batch-dependent kernels, MoE routing and providers' own wording; also the contradiction with summary | PASS  |
| CR-05 | None (control, Semantic Versioning)                    | No false defect, no blocking finding; every npm and semver claim verified. Minor, true: "range" and "resolves" used before being named              | PASS  |
| CS-01 | Read rate 10× too high (1,160/s average, 11,600 peak)  | Yes, must-fix: 10,000,000 ÷ 86,400 = 115.7, cross-checked against the failure modes' 1,160 at peak                                                  | PASS  |
| CS-02 | First deep dive picks object storage without comparing | Yes, High: "compares no options", naming the data model's, summary's and At a glance's promised comparison and both options' costs                  | PASS  |
| CS-03 | None (false-positive control)                          | No false defect; all arithmetic and the request-versus-storage cost claim verified. True findings: IPv6 per-address limits, p99, bullet format      | PASS  |
| DS-01 | TypeScript loop drops the last element; tests miss it  | Yes, blocking: ran it (`[0, 3, 4, 8, 9, 0]`, whole-array sum 0), plus High that both TypeScript tests pass with the bug                             | PASS  |
| DS-02 | The `range_sum` walkthrough paragraph only narrates    | Yes, first finding: "restates the code line by line and never says why the indices are `right + 1` and `left`"                                      | PASS  |
| DS-03 | None (false-positive control, Prefix Sums)             | No false defect, no blocking finding; traced chunks against files and ran the Python. Lows, all true: precision past 2⁵³, `accumulate`, test names  | PASS  |

### Notes

- **The shared template works for all three kinds.** No reviewer was confused
  by a "none" checklist item, and the DSA reviewers used the DSA checklist
  item by item (DS-01 cited items 1, 3 and 7; DS-02 item 4).
- **Real gaps in the case-study base, raised by more than one reviewer:**
  per-address limits that IPv6 /64 prefixes bypass (CS-02, CS-03), "p99" never
  tied to the body's "99th percentile" (CS-01, CS-02, CS-03), and the
  Trade-offs bullets' mixed format. CS-01 also argued that "storage is the
  dominant number" undercuts the sentence before it, which says request
  charges exceed storage. All are true notes the controls allow; fixing the
  base would make the controls quieter, not the eval stronger, so it waits for
  a reason to touch the fixture.
- **The DS-03 control's lows suggest small fixture improvements** (say that
  JavaScript rounds silently past 2⁵³, name `itertools.accumulate`), none
  needed for grading.
