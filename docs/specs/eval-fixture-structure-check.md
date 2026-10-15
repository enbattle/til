# Spec: structure-check the content-review eval fixtures

Approved 2026-10-15.

## Context

The content-review eval (`evals/content-review/scenarios.md`) gives fabricated drafts to a reviewer. Each draft has exactly one planted problem.

When the Writing Standard or a template changes, those drafts silently stop meeting the new structure. Real findings about the stale fixture then outrank the plant, and the eval needs extra runs to diagnose. The 2026-10-15 friction aggregation (docs-audit Stage 2b, proposal 5) found this three times:

- 2026-10-07: "fixtures now lag the standard".
- 2026-10-14: the CS base was rewritten after template 3, at a cost of a 5-agent run plus a control re-run.
- 2026-10-14: CR-01's plant ranked sixth, behind true pacing findings. The fix was a fixture rewrite and three re-runs on 2026-10-15.

The user approved making this a check. This change makes `npm run verify` run the same structure rules the published pages already pass against these drafts:

- every `CR-*` draft (topics);
- the shared CS base draft (case studies).

A template or rule change that a fixture no longer meets then fails at once, in CI, instead of in a later eval run. The check covers structural drift only. Prose-level gaps, such as the pacing rules no test enforces, stay the eval's job.

## Design

**Extracting the drafts with the shared parser.** A new helper, `src/test/eval-fixtures.ts`, reads `evals/content-review/scenarios.md` through `import.meta.glob(..., { query: '?raw' })`, the same way `src/test/content.ts` reads content. It parses the file with `markdownParser()` from `src/lib/markdown.mjs`. It uses no regex over the file.

- **Topic drafts:** each `###` heading whose text starts `CR-` (retired blocks excepted) opens a scenario. The scenario runs to the next heading of depth 3 or less.
  - Its draft is the first fenced code node in that range with lang `markdown`.
  - Its section is the inline code in the paragraph that starts with the bold label `Section:`.
- **Case-study draft:** the base is the first `markdown` code node under the `###` heading `Base draft (the CS-03 control, verbatim)`.
- **Return values:** the helper returns `{ id, section, raw }` for each CR scenario, and `{ raw }` for the CS base.
- **Failure:** it throws, naming the scenario, when a scenario has no draft or no section, or when the base heading or its draft is missing. A fixture can't silently drop out of the check.

**Running the existing rules, unchanged.** Each structure test gains one `describe` block that runs its own existing per-file function on the extracted drafts:

- `src/content/topic-structure.test.ts` runs `structureProblems({ section, title, body })` on each CR draft. The title comes from the draft's frontmatter, so the title pattern, rule of thumb, word budget and the systems-and-infrastructure "Where you'll meet this" rules all apply.
- `src/system-design/case-study-structure.test.ts` runs `fileProblems` on the CS base, so the frontmatter allowlist, the template headings, the section shapes, the diagram, in-page links and the word budget all apply.

No rule is copied or loosened for fixtures.

**Which drafts are checked: all of them, an allowlist by construction.** Every CR scenario heading and the base are checked. Nothing is listed by name, so a new CR scenario is checked automatically.

- The CS-01, CS-02 and CS-04 drafts are the base plus a prose replacement. Their replacements don't touch structure, so the base stands in for them.
- Checking that each replacement still applies verbatim stays the eval runner's job. Building the draft fails loudly when a replacement no longer applies.
- **No planted violation today is structural:**
  - CR-01: an undefined term.
  - CR-02: tone.
  - CR-03: figurative language.
  - CR-04: an unverified claim.
  - CR-05: a control.
  - CR-06: term density.
  - CS-01: arithmetic.
  - CS-02: a decision with no alternative.
  - CS-03: a control.
  - CS-04: an overclaim.

  A future scenario that needs a structural plant would need a spec change, adding an explicit opt-out. None is added now.

**Fixing fixtures that fail today.** If a CR draft or the base fails a rule now, the Stage 3 implementer fixes that fixture without touching its planted violation. That covers a word-budget or rule-of-thumb gap, for example. Any scenario whose fixture changes gets its content-review-eval scenario re-run at Stage 5.

**Docs.**

- `evals/content-review/scenarios.md`'s header says that `verify` structure-checks every CR draft and the CS base, so a fixture must keep passing the published pages' structure tests.
- `.claude/skills/content-review-eval/SKILL.md` Stage 0 and `evals/README.md` get one line each if they describe keeping fixtures current.
- `docs/verification.md` names the new coverage where it lists what the structure tests check.

## Acceptance criteria

1. **Extraction.**
   - The helper returns exactly one draft for every `### CR-` scenario heading, in file order, each with its section.
   - Today that is six: CR-01 to CR-06. The test asserts the IDs match the headings it finds, not a hard-coded list.
   - It returns the CS base draft, with frontmatter.
2. **It fails loudly.** Each of these is a planted case. The helper throws, naming the problem, when given scenarios text with:
   - a `### CR-` heading with no `markdown` code block;
   - a CR scenario with no `Section:` paragraph;
   - no base-draft heading;
   - a base-draft heading with no code block.
3. **Topic drafts pass the topic rules.** Every extracted CR draft passes `topic-structure.test.ts`'s `structureProblems` for its section. A planted case shows a CR draft made to fail, for example by removing its rule of thumb, and the check reports it under the draft's ID.
4. **The case-study base passes the case-study rules.** The CS base passes `case-study-structure.test.ts`'s `fileProblems`. A planted case shows a base made to fail, for example by deleting `## Start simple`, and the check reports it.
5. **Fence handling.** A draft fenced with four backticks that contains an inner triple-backtick block is extracted whole. CR-01 does this today. The parser handles it, and a planted case pins it.
6. **Real fixtures.** `npm run verify` is green with the current scenarios file. Any fixture that needed a fix keeps its planted violation word for word.
7. **Docs.** The scenarios header and docs/verification.md state the new check. `check:claude-md`, `check:npm-refs` and `format:check` pass.

## Scope and roles

- **In:**
  - `src/test/eval-fixtures.ts`, which is new;
  - the two structure test files;
  - any CR or CS fixture fix;
  - the docs listed above.
- **Out:**
  - building or checking the CS-01, CS-02 and CS-04 replacement drafts;
  - structure-checking feature-review or skill-routing fixtures;
  - any change to the rules themselves.
- **Stage 2 test-writer:** writes all three test files: the helper, the new `describe` blocks and the planted cases. `src/test/` is locked, so the helper is the test-writer's. The tests should go red only where something is missing. A real fixture failing a rule is real red for the implementer.
- **Stage 3 implementer:** fixes any failing fixture and updates the docs. No app code changes.
- **UI surface:** none.
- **Evals at Stage 5:**
  - content-review-eval for any scenario whose fixture changed;
  - none if no fixture changed, since the header note is documentation only.

## Non-negotiables check

There is no conflict. The check parses with the shared `markdownParser()` and runs the existing rule functions, as Stage 1 requires. It adds no new `verify` step: `test:run` already runs both structure files.

## Verification

- **Stage 2 gate:**
  - `git status` lists test files only.
  - `npm run test:run` shows the new tests red only for real fixture failures or missing pieces.
  - `typecheck` passes.
- **Snapshot**, then Stage 3: `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:** review of `npm run review:diff`. In a scratch copy, break a CR draft's rule of thumb and delete the base's `## Start simple`, and confirm `verify` fails on each.
- **Stage 5:** `verify`, then `check:test-lock -- --clear`, and any eval the fixture changes call for.

## Review decisions

Stage 4 found the following, and finding triage confirmed every item. The spec is amended as each item says.

**Fix with a test (each is a vector the guard missed):**

- **An unregistered `Section:` value.** It silently turned off the systems-and-infrastructure rules. Every extracted section must now be a registry section (`getSection`).
- **Topic frontmatter keys.** These weren't checked: a draft with no `summary`, or with an extra key, passed. CR drafts now also go through `parseTopicMeta`, as published topics do. This amends criterion 3, which named only `structureProblems`.
- **A `### CR-` heading under a `##` retired block.** It was skipped silently, and the last retired block runs to the end of the file. That case now throws instead. This amends "(retired blocks excepted)".
- **A scenario swallowed by a neighbour's broken fence.** It wasn't reported missing, because the test's heading scan read fences the way the parser does. The ID check now compares against a raw line scan that ignores fences. The scan accepts `##` to `######` `CR-` headings, which also covers a `#### CR-` heading (theoretical).

**Fix, no new test:**

- The pipeline-log Escaped defect cell now names CR-03 too, since the stray fence dropped it.
- CR-02 and CR-03 are re-run at Stage 5.
- content-review-eval's Stage 3 says where a new `CR-*` goes, that it must pass the structure tests, and that a structural plant needs an opt-out in the spec.

**Round 2 (re-review; triage confirmed each finding).**

Fix with a test:

- The CS base also goes through `parseCaseStudy`, as published case studies do. A non-positive-integer `order` or an empty field is reported.
- The test's raw heading scan drops its "retired" toggle. A draft line containing "retired" no longer hides the next scenario behind a misleading ID mismatch.

Fix, no new test:

- docs/content.md and docs/case-studies.md point to the fixture coverage where they describe their structure tests.

Known limitation:

- **Date format on the base and the CR drafts.** No structure rule or loader checks the date; only the real-page tests do. Checking it here would copy a rule (against this spec) or change app code (out of scope). Both authoring docs show `YYYY-MM-DD`.
- **A new scenario heading that isn't ASCII `CR-`** (a non-breaking hyphen, or `CR07`) drops out of both scans. Authors copy an existing heading.
- **A new `CS-*` scenario with its own full draft isn't checked.** That falls outside the documented base-plus-replacement format.
- **A dead catalog link added to the CS base isn't checked.** It isn't a structure rule. This was already true before this change, and the base's premises catch a moved topic. It is a possible follow-up spec.

**After round 2 (the cap; Lows default to Known limitation):**

- **A new scenario heading that contains "retired" fails as a misleading ID mismatch.** For example `### CR-07 — … retired APIs`. The test's raw scan drops any line with that word. It fails loudly and misses nothing. The fix is to skip only `#`/`##` "retired" headings, to match the helper.
- **`###CR-07` with no space after the hashes isn't seen by either scan.** CommonMark doesn't treat it as a heading. It goes with the non-ASCII heading limitation, since authors copy an existing heading.
