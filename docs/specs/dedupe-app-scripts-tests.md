# Spec: Remove duplicated code in the app, scripts and tests (step 2)

Status: approved 2026-09-30. Follows docs/specs/dsa-tab.md (step 1); the harness and docs pass is step 3.

## Context

A DRY/YAGNI audit after the DSA tab (PR #31) found that each content type was added by copying the one before. The DSA branch removed the copies it introduced. This run removes the older ones in the app code, the check scripts and the tests, and closes the test-lock gap found during the DSA review: a new file whose path is added to `.gitignore` is invisible to `check:test-lock`.

Behavior is unchanged. The one intended exception is that link extraction moves from a regex to the site's markdown parser, so reference-style links count and a link inside inline code doesn't. On the real corpus this changes nothing: all 83 content files give identical links either way, which I checked before writing this spec.

The harness and docs pass (shared stages for the content skills, the reviewer lists, eval file overlap, trimming DEFERRED_PRACTICES and the README, and retro edits #1 and #2) is step 3, a separate run.

## Scope

**In**

1. **One link extractor (A1).** Move `markdownParser`, `isDiagramSrc`, `diagramName` and `diagramReferences` from `src/lib/diagram-refs.mjs`, and `dsaPrerequisites` from `src/lib/dsa-prereqs.mjs`, into one plain-JS module, `src/lib/markdown.mjs` with a `markdown.d.mts`.
   - Add `extractTopicRefs` and `extractCaseStudyRefs`, rewritten on the parser: they share one walk that collects `link` and `linkReference` URLs, resolves references through `definition`s and skips code.
   - Delete `src/lib/markdown-links.ts` (regex plus its own fence stripper), `diagram-refs.mjs/.d.mts` and `dsa-prereqs.mjs/.d.mts`.
   - Repoint the importers: `vite.config.ts`, `src/lib/headings.ts`, `MarkdownRenderer.tsx`, `Diagram.tsx`, `system-design.ts`, `scripts/check-diagrams.mjs`, and the tests.
   - The `TopicRef` type moves with the extractors.
2. **One loader shape (A2).** `createCollection` in `src/lib/content.ts`, next to `createBodyStore`, takes the eager meta glob, the lazy body glob, a `parse(path, data)` and a `key(path)`.
   - It returns the parsed items and a `get(key)`, plus `loadBody(key)` (rejects an unknown key) and `loadAllBodies()`.
   - `content.ts`, `system-design.ts` and `dsa.ts` use it. Each keeps its literal `import.meta.glob` calls (Vite requires literals), its own sort or order, and every export it has today.
3. **Topic page joins the shared parts (A3).** `TopicPage` uses `PageHeader`, `PrevNextNav` and `neighbours` (the DSA branch added them).
   - `sectionNeighbors` becomes `neighbours` over the section's topics. Delete it if nothing else uses it.
   - "Used in these case studies" stays as it is.
4. **Small app leftovers (A11).**
   - `topicsBySection()` becomes a module constant, built once.
   - `HomePage` and `SectionPage` use `getSection` / `TOPICS.filter` instead of `groups.find(...)`.
5. **Script helpers (S1–S3).** `scripts/lib.mjs` exports:
   - `ROOT`;
   - `listFiles({ under, ext })` on `git ls-files -co --exclude-standard`, which respects `.gitignore` and so replaces each hand-kept skip list;
   - `escapeRegExp`.

   Used by:
   - `check-bundle`, which also replaces its `bodyOf` with `parseFrontmatter` from `src/lib/frontmatter.ts` (Node 22.18+ strips the types; the engines floor is 22.22.2);
   - `check-diagrams`, `check-hex-colors`, `check-npm-script-refs`, `check-raw-html` and `render-diagrams`;
   - `check-test-lock` and the other scripts that define `ROOT`.

   `check-bundle` keeps reading `dist/assets` directly; it's build output, not tracked.

6. **The `.gitignore` lock gap.** `check:test-lock` also locks every `.gitignore` in the tree and `.git/info/exclude`. Adding a path to an ignore file after Stage 2 then fails `--verify`, so a new ignored runner file (a root `vitest.config.ts`, a `conftest.py`) can't hide. This pins the exclusion list, an allowlist, rather than hunting ignored files by name.
7. **Shared test helpers.** `src/test/render.tsx` exports `renderAt(path, ui?)` (providers, `MemoryRouter`, a location probe) and `LocationDisplay`, plus `escapeRegExp` for tests.
   - Current copies: `LocationDisplay` ×6, `renderAt` ×3, `renderDialog` ×4, `renderNav` ×3, `renderHeader` ×3, and `escapeRegExp` ×4.
   - Duplicated content-test helpers (`rawFor`, `without`, `bodyOf`, `chromeLinks`) go into a `src/test/content.ts` where two or more files share one.
   - Test files are not merged; that would be cosmetic churn.

**Out**

- Harness and docs (step 3), except where a doc names a moved or deleted file.
- A shared related-links component. "Used in these case studies", "Go deeper" (with summaries) and "Before this" differ in heading, layout and content, so one component would need options for each. That's YAGNI, considered and rejected.
- Merging the three color checks: they test different things.
- The SVG allowlist size (NON_NEGOTIABLES #6).
- Content changes.

## Acceptance criteria (Stage 2 tests)

1. `extractTopicRefs` / `extractCaseStudyRefs` (from `src/lib/markdown.mjs`):
   - every existing case in `markdown-links.test.ts` still holds;
   - a reference-style link `[a][r]` plus `[r]: /alpha/one` counts;
   - a link inside inline code does not;
   - a link inside an indented code block does not.
2. On the real corpus, `topicsForCaseStudy` and `caseStudiesForTopic` return the same lists as before. Pin them as data in the test: today's 16 case studies' topic slugs, taken from `main` when the test is written.
3. `src/lib/markdown-links.ts`, `diagram-refs.mjs` and `dsa-prereqs.mjs` no longer exist, and no file under `src/`, `scripts/` or `vite.config.ts` imports them. `dsaPrerequisites` and `diagramReferences` keep their existing tests, imported from the new path.
4. `createCollection`, unit-tested with fake globs:
   - `get` finds an item by key and returns undefined for an unknown key;
   - `loadBody` strips frontmatter, returns the same promise twice and rejects an unknown key;
   - `loadAllBodies` returns every body;
   - a path that `key()` rejects is skipped.

   The existing loader tests for topics, case studies and DSA entries pass unchanged apart from import paths.

5. A topic page renders the same:
   - its back link, `h1` and date;
   - prev/next within the section, in title order, with the nav absent when the section has one topic (existing `TopicPage` tests);
   - the prev/next nav now has an accessible name, "More in <section label>". That is the one visible change: `PrevNextNav` requires a label.
6. Scripts:
   - every check behaves as today on the repo (`npm run verify` green);
   - `listFiles` skips `.gitignore`d files: a planted case in `scripts/checks.test.mjs` with an ignored `.ts` file containing a hex colour, which `check:colors` must not report;
   - `check-bundle`'s fragment for a file with a BOM and CRLF frontmatter is the same as before.
7. `check:test-lock`: after `--snapshot`, each of these fails `--verify`:
   - an edited root `.gitignore`;
   - an added nested `src/.gitignore`;
   - an edited `.git/info/exclude`.

   An unrelated edit to a non-locked file still passes.

8. Test helpers: `src/test/render.tsx` exists and the duplicated helpers are gone. Mechanically: no test file defines `LocationDisplay` or `escapeRegExp`, which a grep test checks.
9. `npm run verify` passes; no size limit is raised, and the main chunk does not grow; `npx knip` reports nothing new.

## Non-negotiables check

No conflicts.

- #2: no colour changes.
- #3: no raise.
- #6: no change to how markdown renders, so no raw HTML; the SVG allowlist is untouched.
- #9: `.gitignore` joins the locked set, so a later implementer can't loosen the lock through it. It's a tightening.

## UI surface

Small. The topic page gains the shared header and a labelled prev/next nav; the landing pages are unchanged. Stage 4 does a short browser check: a topic page, home, and a section page, in both themes at 375 px.

## Critical files

- **New:** `src/lib/markdown.mjs`, `src/lib/markdown.d.mts`, `scripts/lib.mjs`, `src/test/render.tsx`, `src/test/content.ts` (if shared).
- **Delete:** `src/lib/markdown-links.ts`, `src/lib/diagram-refs.mjs/.d.mts`, `src/lib/dsa-prereqs.mjs/.d.mts`.
- **Edit:**
  - `src/lib/{content,system-design,dsa,headings}.ts`;
  - `src/components/{MarkdownRenderer,Diagram}.tsx`;
  - `src/pages/{TopicPage,HomePage,SectionPage}.tsx`;
  - `vite.config.ts` (its plugin only);
  - the 6 walking scripts plus `check-test-lock.mjs`;
  - tests via Stage 2;
  - `knip.json` if its entries name deleted files;
  - `docs/verification.md` and `docs/dsa.md` where they name `diagram-refs.mjs`, `dsa-prereqs.mjs` or the lock's file list.
- **Reuse:**
  - `createBodyStore` (`src/lib/content.ts`) and `parseFrontmatter` (`src/lib/frontmatter.ts`);
  - `PageHeader`, `PrevNextNav` and `neighbours`, all from PR #31;
  - `git ls-files` listing, as in `check-test-lock`.

## Pipeline

- **Stage 2:** a fresh test-writer writes criteria 1–8:
  - new cases in `markdown-links.test.ts`, moved to `markdown.test.ts`;
  - `createCollection` tests;
  - the `scripts/checks.test.mjs` planted cases;
  - the shared helpers, with existing tests repointed to them.

  Gate: only test files changed, and the new-behaviour tests (1 reference/inline code, 3, 4, 6 ignored file, 7, 8) are red. The test-writer must also run `npm run typecheck` (last run's lesson). Then lock.

- **Stage 3:** a fresh implementer. Gate: `check:test-lock --verify` and `npm run verify`; plant a `.gitignore` edit in a scratch copy and see `--verify` fail.
- **Stage 4:** a fresh reviewer gets the spec, NON_NEGOTIABLES and the diff, plus the short browser check. Then triage, and a 4a fix loop capped at 2 rounds.
- **Stage 5/6:** the final gate, the handoff, a retro (proposals go to step 3), and the pipeline-log row. Ask before committing.

## As built

Deviations and choices the spec left open, recorded after Stage 3:

- **Main chunk +0.04 kB brotli** (94.95 → 94.99 kB; raw 366.10 → 365.82 kB).
  Brotli compressed the three near-identical loader copies cheaply, and
  `createCollection`'s option and result names can't be minified. Accepted by
  the user as noise against criterion 9; no limit raised. MarkdownRenderer
  chunk 83.83 → 84.14 kB (limit 95): `PageHeader`, `PrevNextNav` and
  `neighbours` are now shared by all three content pages, so they moved there.
- **Parse cache in `src/lib/markdown.mjs`:** Stage 3 cached parsed trees by
  text (64 entries) because a locked test called `extractTopicRefs` topics ×
  case studies times. That test now computes the refs once, so the cache never
  hit in production; Stage 4a removed it and each call parses fresh.
- **`chunkFileNames` in `vite.config.ts`:** any chunk containing
  `MarkdownRenderer.tsx` is named `MarkdownRenderer-[hash].js`. Once
  `TopicPage` used the shared page parts, Rollup named that chunk after
  `neighbours`, which broke size-limit's path.
- **Unknown-key error text** is now `Unknown item "<key>"` for all three
  collections; nothing reads it.
- **`listFiles`** returns git path order, drops tracked files deleted from
  disk, and doesn't see ignored files (so `check:diagrams`' orphan scan skips
  ignored files under `public/diagrams`, which can't be committed anyway).
- **Lock:** every `.gitignore` git lists, plus any `.gitignore` git itself
  reports as ignored (so a self-ignoring one stays locked), in both
  `--snapshot` and `--verify`'s added-file check; `.git/info/exclude`, found
  with `git rev-parse --git-path`; and `core.excludesFile`: its configured
  value (`git config --path --get`, null when unset) and the hash of the file
  it names, resolved against the repository root (null when missing or
  outside the repository). Setting it, changing it, or editing that file after
  `--snapshot` fails `--verify`. The snapshot was re-taken with the user's
  approval when the widened lock reported the unchanged `.gitignore` as added.
  A planted `.gitignore` edit makes `--verify` exit 1.
- **Not covered:** an excludes file outside the repository (a global
  `core.excludesFile` such as `~/.gitignore`, or git's default
  `$XDG_CONFIG_HOME/git/ignore`) can also hide files from
  `--exclude-standard`. Setting or changing the `core.excludesFile` value is
  caught from any config scope, but edits to a file outside the repository
  are not.
- **Net lines** (excluding tests and docs): app −22, scripts −35,
  `vite.config.ts` and `knip.json` +15; net −42.

### Review fixes (Stage 4a, round 1)

- **H1:** `scripts/check-test-lock.mjs` now uses `lockedFiles()` (which adds
  self-ignored `.gitignore` files) in `--snapshot` and in `--verify`'s
  added-file loop; it was defined but never called. It also records
  `core.excludesFile`'s value and, when the file is inside the repository,
  that file's hash. The script header and `docs/verification.md` say exactly
  what is locked and that an excludes file outside the repository is not.
- **L2:** the parse cache in `src/lib/markdown.mjs` is removed; each call
  parses fresh.
- **L3:** `evals/feature-review/scenarios.md` FR-04 and FR-07 no longer import
  the deleted `sectionNeighbors`; their `content.test.ts` hunks quote the
  current imports and line numbers, and the `content.ts` hunk headers in
  FR-04 and FR-06 point at `recentTopics`' current line (195). What each
  scenario plants or controls is unchanged.
- **L4:** the comments in `scripts/check-npm-script-refs.mjs` and
  `scripts/lib.mjs` (`listFiles`) no longer say agent worktrees are
  `.gitignore`d: `git ls-files -o` lists a nested repo or worktree as one
  directory entry and never walks into it.

### Review fixes (Stage 4a, round 2)

- **FR-04 format defect:** the clean-control scenario's added import was 92
  characters, over `.prettierrc`'s `printWidth` of 90. It is now written in
  Prettier's multi-line form (one name per line, trailing comma) with the hunk
  header counts adjusted (`-1,4 +1,10`, `-68,3 +74,14`). The removed import
  stays one line (74 characters, which Prettier keeps joined).
- **Case-insensitive ignore file:** `IGNORE_FILE` in
  `scripts/check-test-lock.mjs` now matches `.gitignore` in any case, since
  git honours `.GITIGNORE` when `core.ignorecase=true`.
- **Missing config part:** `--verify` now reports any config part
  `runnerConfig()` produces that the snapshot lacks as `added: <part>` and
  fails, instead of comparing only the parts the snapshot has.

## Review decisions

- **Reject — H1 case D:** an edit to the tracked root `.gitignore` is already
  caught (`--verify` reports `modified: .gitignore`).
- **Known limitation:** if Claude Code's runtime writes its block to
  `.git/info/exclude` between `--snapshot` and `--verify`, `--verify` fails
  spuriously. That is fail-safe, and it was observed as a one-time write,
  unchanged for 17 days.
- **Pre-existing, not fixed here:** `check:raw-html` and `check:colors` don't
  scan `.mjs` files under `src/`.
- **Pre-existing, not fixed here:** a nested `git init` inside a new untracked
  folder hides its files from the lock (git lists it as one directory entry),
  and `scripts/check-test-lock.mjs` is not in its own locked set.
