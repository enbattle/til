# Feature-review eval results

One row per run, newest last. Add a row for your run and replace the
"Latest run" section below with its full log (what `../HOW_TO_RUN.md` step 6 lists); git history keeps
older logs, including the dated files this folder held until 2026-09-29.

| Date       | Trigger                                                                         | Pass | Fail | Ambiguous | Note                                                                      |
| ---------- | ------------------------------------------------------------------------------- | ---- | ---- | --------- | ------------------------------------------------------------------------- |
| 2026-09-23 | Baseline; Stage 4 instruction edited                                            | 8    | 0    | 0         | FR-01..04 twice each; FR-02 fixture replaced after.                       |
| 2026-09-23 | Replacement FR-02 (`rehype-raw`, NN #6)                                         | 2    | 0    | 0         | Top finding both runs.                                                    |
| 2026-09-24 | Fixtures changed; NN and Stage 4 edited                                         | 8    | 0    | 0         | No rotation.                                                              |
| 2026-09-24 | FR-05 added (subtler defect)                                                    | 3    | 0    | 0         | Ceiling effect persists.                                                  |
| 2026-09-29 | Stage 4: trigger + "theoretical" label, re-raise rule, Writing Standard pointer | 10   | 0    | 0         | FR-01 rotated; no planted defect labelled theoretical. Latest run, below. |

## Latest run: 2026-09-29

**Trigger:** `feature/SKILL.md` Stage 4 reviewer instruction changed:
reviewers now name a realistic trigger for every finding and label a finding
without one "theoretical", re-raise a spec's listed review decision only with
new evidence, and hold content prose to the Writing Standard (branch
`chore/review-triage`, commit 3e215dc).

**Rotation:** FR-01. The old defect (`split('#')`, which broke three of the
spec's four examples) became a quoted-value exemption that tests only for
double quotes, so a single-quoted value containing ` #` is cut to `'Use`. The
spec's examples all still pass. The trigger is the repo's own convention
(every quoted value under `src/content/` is single-quoted) rather than a spec
example, and no current content has ` #`. That makes it a direct test of
whether the new "theoretical" label lets a reviewer downgrade a real defect.

**Scenarios run:** FR-01..FR-05, twice each, so ten runs. All ten ran in
parallel, each on a fresh `general-purpose` agent (never a fork). Each got the
scenario's Spec and Diff, the path `docs/NON_NEGOTIABLES.md`, Stage 4's
reviewer instruction copied verbatim from `.claude/skills/feature/SKILL.md`,
and HOW_TO_RUN.md step 2's extra line. None was told that a defect was
planted.

**Diff context check before running:** every quoted context line matches the
current files (`frontmatter.ts:35-39`, `TopicPage.tsx:84-89`,
`SearchDialog.tsx:52`, `:74-80` and `:155-157`, `content.ts:159-161`,
`content.test.ts`). The planted FR-01 behaviour was confirmed in node before
running.

| ID    | Run | Finding summary                                                                                                                                                                                                                                                                                | Rank   | Grade |
| ----- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| FR-01 | 1   | High: "a single-quoted value containing ` #` is cut off and keeps a stray quote"; the guard protects only double quotes; trigger is the six single-quoted titles and an author writing `'Markdown: # headings and lists'`. Noted that no current content is affected, and still rated it High. | 1 of 5 | PASS  |
| FR-01 | 2   | High: "single-quoted values are not protected from comment stripping", breaks AC3; trigger is the repo's single-quote convention, with the truncated title reaching cards, search and the heading. Ran the patched logic in a scratch script.                                                  | 1 of 5 | PASS  |
| FR-02 | 1   | High: the button has no accessible name, breaks NN #1, quoting DESIGN.md's checklist line; trigger is tabbing past the prev/next links with NVDA or VoiceOver.                                                                                                                                 | 1 of 6 | PASS  |
| FR-02 | 2   | High: no accessible name, breaks NN #1, same trigger.                                                                                                                                                                                                                                          | 1 of 5 | PASS  |
| FR-03 | 1   | High: stale `query` closure because the dependency list is still `[onClose]`, so criterion 1 fails; trigger is typing "cache" and pressing Escape.                                                                                                                                             | 1 of 4 | PASS  |
| FR-03 | 2   | High: stale closure, so criteria 1 and 2 fail; same trigger.                                                                                                                                                                                                                                   | 1 of 4 | PASS  |
| FR-05 | 1   | Critical: `hidden` is always 0 because `searchContent` defaults `limit = 8` (`search.ts:80`); fix is a larger limit plus a slice to 8.                                                                                                                                                         | 1 of 5 | PASS  |
| FR-05 | 2   | Critical: the line never renders, same root cause, with a warning that raising the limit without a slice breaks criterion 1.                                                                                                                                                                   | 1 of 4 | PASS  |
| FR-04 | 1   | Nothing at medium or higher. Low: `NaN`/`Infinity` inputs, "theoretical" because no caller exists. Low: unused export. Nit: import order.                                                                                                                                                      | n/a    | PASS  |
| FR-04 | 2   | "Nothing blocking." Low: `NaN`/`Infinity` inputs, "theoretical until a caller exists". Low: unused export.                                                                                                                                                                                     | n/a    | PASS  |

**Disagreements between runs:** none on grades or on the rank of the planted
defect. The two FR-01 runs differed on the secondary quote-plus-comment
defect (Medium in both), and run 1 labelled the inner-`"` case theoretical
where run 2 rated it Medium.

### Notes

- **The "theoretical" label did not weaken detection.** The rotated FR-01 is
  the case the new wording could have hurt most: no current content triggers
  the bug. Both runs said so explicitly and still rated it High, taking the
  repo's single-quote convention as the realistic trigger rather than calling
  it theoretical. Across all ten runs, "theoretical" went only on findings
  that were plausibly unreachable: `NaN` input to a function with no caller
  (FR-04, both runs), a future `behavior: 'smooth'` (FR-02 run 1) and the
  inner-`"` case (FR-01 run 1). No planted defect was downgraded or labelled
  theoretical. Every finding named whether the diff introduced it, as the new
  wording asks.
- **Grading a "theoretical" finding on the clean control.** HOW_TO_RUN.md's
  FR-04 rule ("only findings true of the diff") doesn't mention the label.
  This run graded a theoretical-labelled finding on FR-04 as PASS only if it
  is true of the diff and not presented as blocking. Both FR-04 findings
  (`readingMinutes(NaN)` returns `NaN`) are true and Low, and both runs said
  nothing blocks. Worth adding to HOW_TO_RUN.md step 4 if this rule is kept.
- **The rotated FR-01 has two unplanted real defects**, a construction error
  in the fixture. A quoted value containing ` #` plus a trailing comment is
  cut at the inner `#` (both runs, Medium), and a double-quoted value with an
  inner `"` loses the guard (both runs). Both are true of the diff, so
  neither counts against a reviewer. `scenarios.md` records the flaw for the
  next rotation.
- **One wrong claim on the control, not graded as a finding.** FR-04 run 2
  called the new import "alphabetical, after `recentTopics`". It isn't
  (`rea` < `rec`), and run 1 flagged the order as a nit. The claim was
  offered as "checked and fine", not as a defect, so it doesn't fail the
  control, but it is a small verification slip.
- **Ceiling effect persists.** Every planted defect was each review's top
  finding again. FR-05's suggested harder variant (a cap several hops from
  the call site) is still open.
- **The re-raise rule and the Writing Standard pointer were not exercised.**
  No scenario has a `## Review decisions` list or touches content. A scenario
  for each would test those parts of the new wording.
- **Scope.** No reviewer started the dev server or edited the working tree.
  Several wrote scratch scripts outside the tree to run the diffed logic.
