# Spec: one implementation for the shared content plumbing

Status: approved 2026-10-12.

Saved on approval as `docs/specs/content-dedupe.md`. Branch `refactor/content-dedupe`, from `main`.

## Context

The redundancy audit in this session found that the three content types (topics, case studies, DSA entries) repeat the same plumbing in several places:

**Loaders.** `parseTopicMeta`, `parseCaseStudy` and `parseDsaEntry` repeat the same required-field loop (`src/lib/content.ts:27`, `system-design.ts:39`, `dsa.ts:63`). All three wrap their parse with `{ ...parse(), words: wordFiles[path] }`.

**Frontmatter checks.** The allowed-key check lives only in the case-study and DSA structure tests; topics have none. Those tests also re-check missing keys that the loaders already throw on.

**Markdown walking.** `textOf` is written four times (`markdown.mjs:116`, `topic-structure.test.ts:38`, `where-youll-meet-this.test.ts:20`, `dsa-code-chunks.test.ts:43`). The "blocks under `## X`" walk is written in five places.

**Structure tests.**

- `case-study-structure.test.ts` and `dsa-structure.test.ts` duplicate `renderBody`, `section`/`blocksAfter`, `frontmatterProblems`, the word-budget check and the "has no template line" test.
- `where-youll-meet-this.test.ts` re-loads and re-parses topic bodies that `topic-structure.test.ts` already reads. It also uses its own word counter, which includes code.

**Search.** `src/lib/search.ts` keeps one result variant, one build branch and one loader dependency per content type. `SearchDialog.tsx` then switches on the kind again to get key, path and label. `search-dsa.test.ts` largely repeats `search-index.test.ts` for one more kind.

**Loader tests.** Each loader's suite repeats the same same-promise and reject-unknown body tests. `content-loading.test.ts` already covers those through `createCollection`.

The outcome is one implementation of each, behaviour unchanged, with fewer and smaller test files. This is step 4 (content side) of this session's cleanup order; the UI-side dedupe (tabs, URL helpers, the modal hook, App/nav tests) is a separate run.

## Design

1. **Frontmatter fields.** `src/lib/frontmatter.ts` gains `checkFields(name, data, { required, allowed })`:
   - It throws `<name> is missing required frontmatter field "<f>"` for the first missing or empty required field, in listed order. This is today's message.
   - It throws `<name> has an unknown frontmatter field "<f>"` for any key not in `allowed`. This is new at load time.
   - The three parsers call it:
     - topics: required and allowed `title, summary, date`
     - case studies: `+ order`
     - DSA: `+ kind`
   - The type-specific checks (`order` is a positive integer, `kind` is one of the kinds) stay in their parsers.
2. **Words.** `createCollection` (`src/lib/content.ts`) takes an optional `words` record keyed by file path and sets `words` on each item. The three `{ ...parse(), words }` wrappers go away.
3. **Markdown helpers.** `src/lib/markdown.mjs` exports `textOf(node)` and `sectionNodes(tree, heading)`, which returns the top-level nodes under a `## heading` up to the next heading of depth ≤ 2. `dsaPrerequisites` and `code-regions.mjs` use them. So do the tests, apart from `dsa-code-chunks.test.ts`, whose region reader stays independent on purpose. `markdown.d.mts` declares both.
4. **Structure tests** (Stage 2's work). A shared `src/test/structure.ts`:
   - `renderBody`
   - DOM `section(heading)` / `blocksAfter`
   - a word-budget helper
   - a frontmatter-allowlist helper

   The case-study and DSA structure tests use it. Those tests also change as follows:
   - The "has no template line" tests go; the load-time allowlist now rejects `template:`.
   - Their header comments point to `docs/case-studies.md` / `docs/dsa.md` instead of restating the rules.
   - The case-study test uses `isDiagramSrc` from `markdown.mjs` instead of its own regex.

5. **"Where you'll meet this".** `where-youll-meet-this.test.ts` folds into `topic-structure.test.ts`. The section must be last and hold at least 25 words, counted with `proseWordCount` over that section's nodes. Stage 2 confirms that every current topic still passes with that counter. If any falls under 25 because code no longer counts, the test-writer reports it rather than lowering the bar.
6. **Search.**
   - `createSearchIndex` takes a list of sources `{ items, loadBodies }`. Each item is `{ key, path, label, title, summary }`.
   - Results are those items, so there is one result shape.
   - `SearchDialog` drops its per-kind switch.
   - Ranking, `FUSE_OPTIONS`, labels, paths and the full-text flow are unchanged.
   - `search-dsa.test.ts` folds into `search-index.test.ts` as a `describe.each` over the three kinds.
   - The duplicate "empty query returns nothing" test goes.
7. **Loader tests.** The per-loader same-promise and reject-unknown body tests go; `createCollection`'s own tests keep them. Each loader keeps its parse-contract tests: missing or empty field, unknown field, `order`, `kind`.

## Acceptance criteria

1. **Field checks:**
   - Each loader throws its current message for a missing or an empty required field.
   - Each loader now throws `has an unknown frontmatter field "x"` for an unknown key. This includes topics, which had no check before.
   - `checkFields` has direct unit tests: order of reporting, empty versus missing, unknown key.
2. **Words:** `TOPICS`, `CASE_STUDIES` and `DSA_ENTRIES` items carry the same `words` as today, checked against the `?words` view per file. `createCollection` with a `words` record sets it, and leaves it out without one.
3. **Markdown helpers:**
   - `textOf` and `sectionNodes` have unit tests, including a heading at end of file, a deeper subheading inside the section, and a missing section.
   - `dsaPrerequisites` output is unchanged for every real entry.
   - Repo grep, orchestrator: no other `function textOf` remains outside `markdown.mjs` and `dsa-code-chunks.test.ts`.
4. **Structure tests:**
   - Every rule the case-study and DSA structure tests enforce today is still enforced.
   - Stage 2 lists each test it removes and why: duplicate or superseded.
   - A planted violation per rule still fails. Shown by the existing fixture tests, now running through the shared helpers.
5. **"Where you'll meet this":** `where-youll-meet-this.test.ts` no longer exists. `topic-structure.test.ts` fails a systems-section topic whose section isn't last, and one whose section holds fewer than 25 prose words.
6. **Search:**
   - For a query matching a topic, a case study and a DSA entry, the results' order, titles, paths and labels are identical before and after. Stage 2 records the current output for a set of queries as a fixture-free expectation.
   - Full-text search still finds a body-only match for each kind.
   - `SearchDialog` renders the same items.
7. **Behaviour unchanged overall:** `npm run verify` green, and every page renders as before. Stage 4 does a quick browser pass of search, one topic, one case study and one DSA entry.

## Scope

- **In:**
  - `src/lib/{frontmatter,content,system-design,dsa,search,markdown}.ts|mjs`
  - `src/lib/code-regions.mjs` (use the shared helpers)
  - `src/components/SearchDialog.tsx`
  - the structure, loader and search tests, plus a new `src/test/structure.ts`
  - `docs/verification.md` / `docs/content.md` if they name removed test files
- **Out:**
  - one combined build-time view per type (`?card`); the audit rated it marginal
  - tabs, URL helpers, the modal hook, the App/nav test consolidation (next run)
  - any change to content
- **UI:** search output must be identical. Stage 4 checks the search dialog in the browser.

## Roles

- **Stage 2 test-writer:**
  - all test files and the new `src/test/structure.ts`, which is test support under the lock
  - the tests for the new helpers, `checkFields` and the search source shape, written to fail first
  - the consolidation and removals, each listed in its report
- **Stage 3 implementer:** the app code and docs.

## Evals

None. No `SKILL.md`, `CLAUDE.md`, NON_NEGOTIABLES or checklist edits are planned. If `docs/content.md` changes only to drop a test-file name, the skill-routing eval isn't triggered: `evals/README.md` names docs that CLAUDE.md's routing table points to, and a test-file mention there is not a routing change. The run says so if that happens.

## Verification

- Stage gates as usual.
- Orchestrator checks:
  - grep for leftover `textOf` copies
  - `wc -l` before and after for the touched test and lib files
  - confirm the search-output expectation the test-writer recorded matched the old code (it is red only where the API shape changed)

## Clarifications (Stage 2)

- `docs/content.md` and `.claude/skills/add-topic/SKILL.md` name the deleted `where-youll-meet-this.test.ts`; the implementer updates both to point at `topic-structure.test.ts`. That `SKILL.md` and routed-doc edit names `skill-routing-eval`, which this session runs with the docs-dedupe change.
- The search contract the tests pin: `createSearchIndex(sources)`, `SearchSource = { items: SearchResult[]; loadBodies(): Promise<Map<string, string>> }`, `SearchResult = { key, path, label, title, summary }`, results are the item objects, ties break by source order then item order, and the default instance's source order is topics, case studies, DSA.

## As built

- `checkFields` sits before `unquote` in `frontmatter.ts`, so `evals/feature-review/scenarios.md` FR-01's diff, anchored at the end of that file, still applies.
- FR-07's two premises in `evals/feature-review/scenarios.md` quoted the removed required-field loops; they now name `TOPIC_FIELDS`, `CASE_STUDY_FIELDS` and `checkFields`' message. FR-07's expected outcome is unchanged. This is an `evals/` edit; its eval runs with the docs-dedupe change.
- `createCollection` has typed overloads: with `words` it returns items typed `T & { words: number }`.
- The default search index re-keys case-study and DSA bodies to `system-design/<slug>` and `dsa/<slug>` to match the item keys.
- `docs/case-studies.md` and `docs/dsa.md` now say the loader throws on an unknown key at load time.

## Review decisions

- Reject: a reference-style link whose definition sits outside the "Where you'll meet this" slice would change its word count. Triage built the shape on purpose and the count didn't change; no content uses reference definitions.
- Known limitation, after the fix-round cap (theoretical): the "last section" check compares the last depth ≤ 2 heading anywhere in the tree by its text, so a nested `> ## Where you'll meet this` after a later `##`, or a nested duplicate of the section, passes; the deleted test counted nested matches and failed both. No doc invites a nested "Where" heading. A raw HTML heading after the section also passes, as it did before.
