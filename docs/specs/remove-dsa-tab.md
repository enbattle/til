# Remove the DSA tab

## Context

The user decided to remove the DSA tab entirely. Its content does not survive
anywhere: no archive tag, no migration into the catalog, and no `/dsa`
redirect. The live product, its docs and the AI harness are to read as if DSA
never existed.

**Option B (user's choice):** historical records stay as history. That covers:

- `docs/pipeline-log.md` rows;
- `docs/specs/*`;
- the trend rows in `evals/*/results/README.md`.

Git history keeps the old content. The inventory comes from three read-only
agents in the planning session (app code, tooling/CI, docs/harness), and its
key claims were spot-checked.

Once approved, this plan is saved as `docs/specs/remove-dsa-tab.md`, on the
branch `feat/remove-dsa-tab`.

## Acceptance criteria (each is a testable behaviour)

### App

1. **The header shows exactly two tabs:** Catalog and System Design. No
   SideNav or MobileNav renders a DSA list on any route, and `TABS` has no
   `dsa` id.
2. **`/dsa` and `/dsa/<any-slug>` render the not-found page,** like any other
   unknown section or topic. There is no redirect and no special case.
3. **Search indexes only topics and case studies.** A query that used to
   match only DSA entries (e.g. "binary search") returns only topic and case
   study results, or none. The recorded results in `search-content.test.ts`
   are re-recorded against the remaining corpus.
4. **No published topic or case-study body links to `/dsa/...`.**
   - The 9 links in `src/content/computing-fundamentals/` are reworded so
     each sentence stands alone. Where an existing catalog topic covers the
     idea, they may link to it instead. The links are in:
     - `big-o-notation.md` (4)
     - `cpu-caches-and-virtual-memory.md` (2)
     - `data-representation.md`
     - `encoding-hashing-and-encryption.md`
     - `stack-heap-and-garbage-collection.md`
   - The prose meets `docs/writing-standard.md`.
   - `catalog-gaps.test.ts` resolves links against topics and case studies
     only, so a `/dsa/x` link in a body is reported as dead.
5. **`MarkdownRenderer` has no code-tabs mode.** Adjacent `python`/`typescript`
   fences render as two ordinary code blocks. These are deleted:
   - `CodeTabs`
   - `CodeLanguageContext` and `useCodeLanguage` (the `til-code-language`
     storage key goes with them)
   - `rehypeCodePairs` and `fenceLanguage`
6. **`OrderedNav` accepts only a flat item list.** Grouped mode and
   `OrderedNavGroup` are deleted, and `CaseStudyNav` is unchanged in
   behaviour. `CodeBlock`'s `className` prop is removed, and its default
   margin is inlined.
7. **The build has no DSA code path.** Removed:
   - from `vite.config.ts`'s `markdownMeta`: the `?dsaPrereqs` view, the DSA
     `?raw` override and region resolution, `DSA_ENTRY`, `dsaEntrySlug`,
     `resolvedDsaEntry` and `ROOT`;
   - from `markdown.mjs` / `markdown.d.mts`: `dsaPrerequisites`, `sectionNodes`
     and `textOf`;
   - `code-regions.mjs` and `.d.mts`, with their `knip.json` ignore;
   - from `types.ts`: `DsaKind`, `DsaEntry` and `DsaGroup`;
   - from `vite-env.d.ts`: the `*.md?dsaPrereqs` declaration.

   Highlighter grammars are unchanged: `typescript` predates DSA, and
   `python` is used by 13 catalog fences.

8. **Deleted outright:**
   - `src/dsa/**`
   - `src/lib/dsa.ts`
   - `src/pages/DsaPage.tsx`, `src/pages/DsaEntryPage.tsx`
   - `src/components/DsaNav.tsx`
   - their tests: `App.dsa*.test.tsx`, `DsaNav.test.tsx`,
     `DsaEntryPage.test.tsx`, `dsa.test.ts`, `code-regions.test.ts`,
     `MarkdownRenderer.codeTabs.test.tsx`, `markdown-sections.test.ts`
   - `src/test/content.ts` loses `RAW_DSA_ENTRIES`, `rawDsaEntry` and
     `dsaEntryBody`; `render.tsx` and `structure.ts` lose
     `CodeLanguageProvider` and `codeTabs`.

### Tooling and CI

9. **The Python toolchain is gone.** That means:
   - `pytest.ini`, `requirements-dev.txt`, `scripts/test-python.mjs` and
     `scripts/python-wiring.test.mjs` are deleted;
   - there is no `test:py` script and `verify` has no `test:py` step;
   - `ci.yml` and `deploy.yml` have no setup-python or pip steps;
   - `dependabot.yml` has no pip ecosystem;
   - `.gitignore` has no Python block;
   - `check-test-lock.mjs` has no pytest, `conftest`, `pytest.ini` or
     `test-python` patterns, and its test drops those cases.
10. **`check-npm-script-refs` skips the records** `docs/specs/**` and
    `docs/pipeline-log.md`, as an exact allowlist, and still checks every
    other `.md` file. That includes a sibling such as `docs/specs-old.md` and
    `docs/pipeline-log-notes.md`. This is proven by a new
    `scripts/check-npm-script-refs.test.mjs`, which uses
    `src/test/guard-helpers.mjs`.
11. **`check-pipeline-log` still accepts historical rows.** Its Run regex keeps
    `add-dsa-entry`, `KINDS` keeps `code-bug`, `test-gap` and `narration`, and
    its existing tests stay unchanged. The log header marks `add-dsa-entry` and
    those three kinds as retired (historical rows only) without deleting the
    explanation.
12. **The scripts drop their DSA wiring:**
    - `check-bundle` `BODY_DIRS` lists topics and case studies only; its DSA
      describe block is deleted.
    - `check-raw-html` `NOT_SHIPPED` is `src/test/` only.
    - `inbound-links` no longer lists DSA entries.
    - `check-eval-premises` passes, and its SR-18 pin is replaced.
    - Each script's test is updated in step.
13. **The package metadata matches.** `package.json`'s `description` matches
    the README intro exactly, and neither mentions DSA. The size-limit names
    drop DSA. Each budget is re-measured after the build and lowered to the
    measured size plus about 4 KB, as in the 03ec22b precedent, with the
    numbers in the commit message.
14. **The hooks drop DSA.** `nudge-sdlc.js`'s reminder has no DSA clause.
    `nudge-precommit.js` `CONTENT_PATH` is
    `^src/(content|system-design/case-studies)/`.

### Docs and harness

15. **Live docs have no DSA.** Outside the records allowlist, `git grep -i
'dsa'` matches nothing. Allowlisted: `docs/specs/**` (including this
    spec), `docs/pipeline-log.md`, `evals/*/results/**`, the retirement
    notes, `scripts/check-pipeline-log*.mjs`, and
    `evals/docs-audit/results/README.md`'s history. The orchestrator checks
    this at Stage 5. It is a one-off check, not a permanent test.
    - `docs/dsa.md` and `.claude/skills/add-dsa-entry/` are deleted.
    - These are edited: `CLAUDE.md` (what-this-is, routing row, bounded
      exception, verify sentence), `README.md`, `docs/content.md`,
      `case-studies.md` (two tabs), `verification.md`, `DESIGN.md` (DSA nav,
      code tabs, a11y code-tab line), `DEFERRED_PRACTICES.md` (per-test
      timeout entry) and `content-review.md`.
    - `content-review.md`: the Sonnet-drafter evidence stays as a dated past
      result, without "DSA" in it.
16. **The Writing Standard changes.**
    - The heading "Case studies and DSA entries" becomes "Case studies", and
      every reference to it is updated: the add-case-study SKILL and
      checklist, content-audit, feature Stage 4, `content-review.md` and
      `case-studies.md`.
    - The "Code explains itself" bullet is deleted.
    - The "a problem" framing is deleted.
17. **Skills drop DSA.**
    - add-topic and content-audit drop DSA from their descriptions and their
      scope globs and steps.
    - content-review-eval drops `DS-*`.
    - docs-audit drops `src/dsa`.
    - feature drops `src/dsa/` and `docs/dsa.md` (Stage 2 instruction, Stage 4
      reviewer and triager, content globs).
    - skill-routing-eval drops `add-dsa-entry` from its options.
18. **Evals change.**
    - SR-18, SR-20 and SR-21 are retired in SR-13's format.
    - SR-07 and SR-11 are reworded.
    - The `DS-*` section of `evals/content-review/scenarios.md` is deleted, and
      a single DS-retired note is kept.
    - In `evals/README.md`, "added a skill" becomes "added or removed a skill".
    - `evals/docs-audit/results/README.md`'s "awaiting the user" line records
      Stage 2b proposals 2–5 as declined (moot: DSA removed). Proposal 1 stays
      open.
19. **`npm run verify` is green,** and `check:test-lock -- --verify` is clean
    after Stage 3.

## Review decisions

**Dropped at spec:** guard reject cases removed on purpose.

- `check-test-lock`'s Python cases (`conftest.py`, `test_x.py`, `pytest.ini`,
  `pyproject.toml`, `test-python.mjs`, the "added Python module" case).
  Python no longer exists here. A future Python test would need the patterns
  re-added.
- `check-npm-script-refs` no longer checks `docs/specs/**` or
  `docs/pipeline-log.md`. These are point-in-time records
  (`docs/specs/README.md`, the log header), and docs-audit already exempts
  them. Narrowed at Stage 4a: `docs/specs/README.md` and the log's header
  stay checked; only spec files and the log's table rows are skipped.
- `check-bundle`'s DSA-body case, `check-raw-html`'s `src/dsa/code`
  not-shipped cases, `inbound-links`' DSA case, and `check-eval-premises`'
  SR-18 premise pin.

**Known limitation (Stage 4):** `check-npm-script-refs` matches `.md` case-sensitively, so a `docs/x.MD` file is never checked. No such file exists, and no doc has authors create one; pre-existing, theoretical.

**Known limitation (Stage 4a round 2):** `check-npm-script-refs` skips every
`|`-led line of `docs/pipeline-log.md`, so a table in the log's header would
go unchecked. `check:pipeline-log` already fails `verify` on any second table
in that file, and the header has never held one.

**Known limitation (Stage 4a round 2):** the `docs/specs/` skip exempts every
file but `docs/specs/README.md`, so a case variant (`Readme.md`) or a non-spec
doc placed there would go unchecked. Neither exists, and no doc asks for one;
theoretical.

## Roles and stages

- **Stage 2 (test-writer, fresh)** owns every locked file:
  - all test edits and deletions above, including `src/test/*`;
  - `package.json`'s `test:py` and `verify`;
  - `.gitignore`;
  - `check-test-lock.mjs` and its test;
  - deleting `python-wiring.test.mjs` and `test-python.mjs`;
  - the new `check-npm-script-refs.test.mjs`.

  Each removed or narrowed test lists its mutation, or "removed with its
  behaviour" (friction proposal 1's intent).

- **Stage 3 (implementer, fresh)** owns everything else:
  - the app code;
  - `vite.config.ts` outside the `test` block;
  - the non-locked scripts and hooks;
  - CI, Dependabot and `knip`;
  - the 9 topic rewrites;
  - the docs, skills and evals;
  - the budgets.
- **UI surface: yes** (the tabs and nav change). Stage 4 drives the browser:
  - both themes, at 375px;
  - `/dsa` lands on not-found;
  - the 5 edited topics render.

**Evals at Stage 5:** skill-routing (CLAUDE.md, skills, hooks), content-review
(Writing Standard, `content-review.md`, checklists) and feature-review
(Stage 4 reviewer text).

**After merge, outside the repo:** delete the memory notes
`dsa-code-beginner-readable.md` and `cleanup-and-dsa-rewrite-plan.md`, and
update the others.

## Verification

- `npm run check:test-lock -- --verify`, then `npm run verify`.
- The criterion-15 grep.
- `npm run build` and `npm run size`, to record the new budgets.
- Manual: the dev server, the two tabs, `/dsa`, `/dsa/heap`, search for
  "binary search", and the 5 edited topics.

## As built

- Stage 2: criterion 15's allowlist also covers test files whose `/dsa`
  literals encode criteria 1, 2 and 4 (App.tabs, App.page-kinds, tabs,
  catalog-gaps, SearchDialog, search-content, site-description) and test
  comments citing this spec.
- Stage 2: `src/content/topic-structure.test.ts` imported `sectionNodes` and
  `textOf`; it now carries local copies, so criterion 7 can delete them from
  `markdown.mjs`.
- Stage 2: criterion 9 is also pinned by a new `scripts/toolchain.test.mjs`;
  criterion 10's test expects `check-npm-script-refs.mjs` to export
  `npmRefProblems(root)` and run nothing on import.
- Stage 3: `/dsa` paths reach `/not-found` through the same
  `<Navigate to="/not-found" replace />` as any unknown section or topic; a
  Stage 2 re-run corrected a test that expected the URL to stay on `/dsa`.
- Stage 3: `check-npm-script-refs` now runs only under `isMain` and no longer
  prints the "Valid scripts" list on failure. `hastText` is no longer exported
  from `src/lib/headings.ts` (knip flagged it once `MarkdownRenderer` stopped
  using it), and `urlsOf` in `markdown.mjs` lost its unused `nodes` parameter.
- Stage 3: budgets measured (brotli): main 99,966 → 95,728 bytes, limit 104 →
  100 KB; MarkdownRenderer 84,986 → 84,454 bytes, limit 95 → 88 KB.
- Stage 4a: criterion 10's exemption is narrowed to the records themselves.
  `check-npm-script-refs` skips every file under `docs/specs/` except
  `docs/specs/README.md`, and only the table rows of `docs/pipeline-log.md`
  (trimmed lines starting with `|`, as `check-pipeline-log` reads them), so
  the README and the log's header are checked.
