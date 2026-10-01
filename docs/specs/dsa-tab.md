# Spec: DSA tab (Feature 2)

Status: approved 2026-09-30. Feature 2 of 2 (Feature 1: system-design-case-studies.md).

## Context

The site has two header tabs, Catalog and System Design. Feature 2 adds a third tab, **DSA**, that teaches data structures, patterns and algorithms at big-tech interview depth, in both Python and TypeScript. The agreed end state is 12 data structures (no segment or Fenwick trees), about 22 patterns (DP split into 6) and 8 algorithms (binary search, merge sort, quicksort/quickselect, bucket/counting sort, topological sort, Dijkstra, Bellman-Ford, Prim/Kruskal).

This run follows the case-study precedent the user chose: it ships **the infrastructure, three reference entries (one per kind) and an `add-dsa-entry` skill**. The other 39 entries are added afterwards in batches through that skill, each batch with its own review.

## Scope

**In**

- The `/dsa` landing page, `/dsa/:slug` entry pages, a third header tab, the sidebar and mobile nav, and search.
- The content type and loader: frontmatter eager, bodies lazy, prerequisites taken from links at build time.
- A Python/TypeScript code toggle, shared across the page and remembered.
- Code files beside each entry, tested by vitest (TS) and pytest (Python), with pytest added to `npm run verify` and to CI and deploy.
- A structure test for each kind, plus a test that an entry's code chunks match its code files.
- Three entries: `hash-map` (data structure), `two-pointers` (pattern), `binary-search` (algorithm).
- The `add-dsa-entry` skill; docs (CLAUDE.md router row, new `docs/dsa.md`, README, verification.md, DESIGN.md if the toggle adds a UI rule); skill-routing eval scenario.

**Out**

- The other 39 entries (follow-up batches).
- Any edit to `src/content/**` or `src/system-design/**`.
- Diagrams in DSA entries, interactive step-through (still deferred per CLAUDE.md), a code runner in the browser.
- Links from catalog topics or case studies into DSA (entries may link out to the catalog; back-links are not built).

## Design

### Content and code files

- Entry: `src/dsa/entries/<slug>.md`. Flat frontmatter: `title`, `summary`, `date`, `kind` (`data-structure` | `pattern` | `algorithm`).
- Code: `src/dsa/code/<slug>/<slug_underscored>.py` and `src/dsa/code/<slug>/<slug>.ts`, each self-contained (Python stdlib only; TS with no imports). Tests beside them: `test_<slug_underscored>.py` and `<slug>.test.ts`.
- **Code in the markdown.** Every code example is a _pair_: a ` ```python ` fence immediately followed by a ` ```typescript ` fence (nothing between them). In an entry, the python fences under `## Implementation` (data structure) or `## Walkthrough` (pattern/algorithm), in order, must equal the `.py` file, and the typescript fences must equal the `.ts` file, **compared line by line after dropping blank lines** (so a chunk may split a function anywhere, and the blank lines between chunks don't matter). Fences elsewhere in the entry (e.g. a usage example) aren't compared.
- A check over content uses `markdownParser()` from `src/lib/diagram-refs.mjs` (its `code` nodes), not a regex.

### Entry structure (enforced by test, on the rendered `h2`s like `case-study-structure.test.ts`)

- **Data structure:** `Prerequisites`, `What it is`, `Operations and costs` (holds a table), `Implementation`, `Invariants`, `Tricky lines`, `When to use it`.
- **Pattern / algorithm:** `Prerequisites`, `The idea`, `When to use it`, `Walkthrough`, `Complexity`, `Pitfalls`.
- `Walkthrough` has at least 3 code pairs, each followed by a prose explanation before the next pair (chunked line-by-line walkthrough). `Implementation` has at least 1 pair, and `Tricky lines` refers to specific lines in prose.

### Prerequisites and order

- An entry's prerequisites are the `/dsa/<slug>` links inside its `## Prerequisites` section, in order (build-time, via a `?dsaPrereqs` query in the existing `markdownMeta` plugin in `vite.config.ts`, using `markdownParser`). A section with no prerequisites says so in prose with no link. Other `/dsa/` links in the body are "see also" and don't count.
- `DSA_ENTRIES` is in a **topological order** over prerequisites: every prerequisite comes before its dependents. Ties go by kind (data structures, then patterns, then algorithms), then title. A prerequisite cycle, an unknown slug, or a self-link throws at load time, naming the entries, so a test and the build fail.
- The entry page shows **Before this**: the prerequisites as links (before the body, just under the title). It's hidden when there are none.

### Routes and UI

- `/dsa` (landing): an `h1` "Data Structures & Algorithms", an intro sentence, then one numbered list in `DSA_ENTRIES` order. Each card shows its number, title, a kind label (text, not color only) and summary.
- `/dsa/:slug` (`DsaEntryPage`, lazy like `CaseStudyPage`): a back link, `h1` and date, a kind label, **Before this**, a Contents list of `##` headings (reusing `h2Headings` and the Contents pattern from `CaseStudyPage`), the body via `LazyBody` / `MarkdownRenderer`, and prev/next by list order. An unknown slug goes to not-found.
- **Header:** the third tab, "DSA", links to `/dsa` with `aria-current="page"` on `/dsa` and `/dsa/*` (`isDsaPath` in `src/lib/dsa.ts`). It must fit at 375 px with no page scroll.
- **Sidebar and MobileNav:** `DsaNav` is a flat ordered list like `CaseStudyNav` (current page shown with `aria-current`, bold weight and an accent border). `SideNav` in `App.tsx` and `MobileNav` choose among three navs.
- **Code toggle:** `MarkdownRenderer` takes an opt-in `codeTabs` prop (only DSA pages pass it). With it on, each python+typescript pair renders as one `CodeTabs` block: a tablist ("Python", "TypeScript"; WAI-ARIA tabs with arrow-key movement) over one `CodeBlock`. The selected language is shared across the whole app through a `CodeLanguageProvider` (in `src/contexts/`, mirroring `ThemeContext`), stored in `localStorage` under `til-code-language` with every read and write in try/catch, and defaults to Python. Without `codeTabs`, rendering is unchanged (catalog and case studies aren't affected).
- **Search:** `SearchResult` gains `{ kind: 'dsa'; entry }`. Title and summary are searchable at once; bodies join `ensureFullTextSearch`. A result goes to `/dsa/<slug>` and is labelled "DSA".

### Python in verify

- `npm run test:py` runs `node scripts/test-python.mjs`. It finds an interpreter (`python3`, then `python`, then `py -3`; it skips the Windows Store stub by checking the version runs), then runs `-m pytest -q src/dsa/code`. It fails with install instructions when there's no Python or no pytest. It's added to `verify` right after `test:run`.
- `requirements-dev.txt` pins pytest. `ci.yml` and `deploy.yml` add `actions/setup-python` (pinned by SHA like the existing actions, Python 3.12) and `pip install -r requirements-dev.txt` before `npm run verify`. Dependabot's `pip` ecosystem is added for it.
- `check-test-lock.mjs` also locks `test_*.py`, `conftest.py` and `pytest.ini`/`pyproject.toml` if present. `review-diff` needs no change.

### Bundle

- DSA bodies are lazy chunks. `check:bundle`'s `BODY_DIRS` gains `src/dsa/entries`. Code files never enter the app bundle (only the markdown does). No size limit is raised; measure and record the main chunk.

### Reference entries (content)

Written to the Writing Standard (docs/writing-standard.md), with every claim verified:

- `hash-map`: hashing, buckets, load factor and resizing, amortized O(1); a separate-chaining implementation with get/put/delete/resize; invariants (load factor bound, key-in-bucket(hash) rule); tricky lines (resize rehash, delete in chain). Tests cover collisions, overwrite, delete, resize and missing keys.
- `two-pointers`: opposite-end and same-direction variants; the walkthrough is pair-sum on a sorted array (plus in-place dedupe if needed to show both); prerequisite: `hash-map` (the alternative it beats on space) or none, whichever the prose really needs.
- `binary-search`: the lower-bound form with the half-open invariant; the walkthrough explains `lo < hi`, `mid` and the `lo = mid + 1` / `hi = mid` updates; pitfalls (off-by-one, infinite loop, overflow note for fixed-width languages); binary search on the answer mentioned. Tests cover empty input, duplicates, and all-smaller and all-larger targets.
- Entries may link to catalog topics where the prose uses one.

### Process artifacts

- `.claude/skills/add-dsa-entry/SKILL.md`, modeled on `add-case-study`, including its batch mode: draft the entry + code + both test files, `npm run verify`, then one independent fresh-agent review against the Writing Standard plus a DSA checklist (the code is correct and idiomatic in both languages; the tests cover edge cases, not just the happy path; the walkthrough chunks explain _why_ each line; complexity claims are right; prerequisites are real). Re-review is capped at 2 rounds. The test-lock rules don't apply inside the skill (no `/feature`).
- `docs/dsa.md` holds the layout, frontmatter, templates, the pairing rule, prerequisites, running pytest and the 42-entry roadmap list. CLAUDE.md gets one router row plus mentions in "What this is" and "What's deliberately not built" (stays under 150 lines).
- `evals/skill-routing/scenarios.md` gets a scenario routing "add the heap entry to DSA" to `add-dsa-entry`.

## Acceptance criteria (become Stage 2 tests)

1. `parseDsaEntry(path, data)` returns slug/title/summary/date/kind. It throws, naming the file and field, when a field is missing, when `kind` isn't one of the three, or when the path isn't `/src/dsa/entries/<slug>.md`.
2. `orderDsaEntries(entries, prereqs)` returns a topological order with the stated tie-break, and throws naming the entries on a cycle, an unknown prerequisite slug or a self-link. Test it on fixtures. On the real content, every entry's prerequisites come before it in `DSA_ENTRIES`.
3. `dsaPrerequisites(markdown)` returns only the `/dsa/<slug>` links under `## Prerequisites`, in order and de-duplicated. A `/dsa/` link elsewhere, a link inside code, and a catalog link are all excluded. It uses `markdownParser`.
4. `getDsaEntry('binary-search')` returns the entry; an unknown slug returns undefined. `loadDsaEntryBody` returns the body without frontmatter and rejects an unknown slug. No DSA body is in the main chunk (`check:bundle` covers `src/dsa/entries`; a planted case in `scripts/checks.test.mjs` shows it fails when a DSA body is inlined).
5. Header: three tabs in order Catalog, System Design, DSA. DSA has `aria-current="page"` on `/dsa` and `/dsa/two-pointers`, and only there. Catalog is current elsewhere except System Design routes.
6. `/dsa` lists every entry in `DSA_ENTRIES` order, each linking to `/dsa/<slug>` with its title, kind label and summary visible.
7. `/dsa/binary-search` has exactly one `h1`; Contents links match the body's `##` ids; **Before this** lists exactly its prerequisite links, or is absent when there are none; prev/next appear only when neighbours exist. `/dsa/nope` shows not-found.
8. On DSA routes the sidebar and MobileNav show `DsaNav` (one link per entry, `aria-current` on the current one). System Design routes still show `CaseStudyNav`, and other routes `SectionNav`.
9. Code toggle, with the real `MarkdownRenderer` and `codeTabs`: a python+typescript pair renders one tablist with two tabs and shows only the Python code by default. Choosing TypeScript (click, or arrow key then activation) shows the TS code in **every** pair on the page and stores `typescript` in `localStorage`, and a fresh render reads it back. A `localStorage` that throws still renders (Python). A lone python fence, or a pair in the other order, renders as plain code blocks. Without `codeTabs`, a pair renders as two plain code blocks (catalog output unchanged).
10. Structure test (per kind, real entries, rendered DOM): the `h2`s are the kind's template in order; `Operations and costs` holds a table; `Walkthrough` has ≥3 pairs each followed by a paragraph; `Implementation` has ≥1 pair; every code fence in `Implementation`/`Walkthrough` is part of a python+typescript pair.
11. Chunk test: for each entry, the python chunks (and the typescript chunks) in `Implementation`/`Walkthrough`, with blank lines dropped, equal the matching code file with blank lines dropped. The failure message names the entry and language and shows the first differing line. A fixture shows it catches a changed line and a missing chunk.
12. TS tests (`src/dsa/code/*/*.test.ts`) and pytest tests (`test_*.py`) exist for all three entries, import the real code files, and cover the named edge cases. `npm run test:py` runs pytest and exits non-zero when a Python test fails. (Show this once in the scratchpad; the planted case can't live in vitest without Python on the machine, so it's a Stage 3 manual check, recorded in As built.)
13. `check:test-lock` locks `test_*.py` (a planted case in `scripts/checks.test.mjs`: an edited `test_x.py` fails `--verify`).
14. Search: `binary search` finds the entry by title at once, a body-only phrase finds it after full-text loading, and selecting it navigates to `/dsa/binary-search` with the label "DSA".
15. `/dsa` isn't a catalog section (`registry.ts` has no `dsa` slug; a test asserts it). `npm run verify` passes, including `test:py`, with no size limit raised.

## UI surface

Yes: header tab, landing, entry page, nav, code tabs, search. Stage 4 drives it in the browser in both themes and at 375 px, including the longest code line (horizontal scroll inside the code block, not the page), keyboard use of the tabs, and a reload that keeps the language.

## Non-negotiables check

No conflicts.

- #1: the tabs follow the WAI-ARIA tabs pattern, and the kind label is text; browser review.
- #2: token colors only.
- #3: no raise; lazy bodies.
- #4: the three entries meet the Writing Standard.
- #6: code goes through Shiki via `CodeBlock` as today; no raw HTML.
- #7: no new runtime scripts.
- #8–12: normal `/feature` flow.

## Critical files

- **New:** `src/lib/dsa.ts`, `src/lib/dsa-prereqs.mjs` (pure, imported by `vite.config.ts` and tests), `src/pages/DsaPage.tsx`, `src/pages/DsaEntryPage.tsx`, `src/components/DsaNav.tsx`, `src/components/CodeTabs.tsx`, `src/contexts/CodeLanguageContext.tsx` (+ hook), `src/dsa/entries/*.md`, `src/dsa/code/**`, `src/dsa/dsa-structure.test.ts`, `scripts/test-python.mjs`, `requirements-dev.txt`, `pytest.ini`, `.claude/skills/add-dsa-entry/SKILL.md`, `docs/dsa.md`.
- **Edit:** `src/App.tsx`, `src/components/Header.tsx`, `MobileNav.tsx`, `MarkdownRenderer.tsx`, `SearchDialog.tsx`, `src/lib/search.ts`, `src/types.ts`, `vite.config.ts` (`markdownMeta` query only; test block untouched), `scripts/check-bundle.mjs`, `scripts/check-test-lock.mjs`, `package.json`, `.github/workflows/{ci,deploy}.yml`, `.github/dependabot.yml`, CLAUDE.md, README, docs/verification.md, evals.
- **Reuse:** `createBodyStore` (`src/lib/content.ts`), `markdownParser` (`src/lib/diagram-refs.mjs`), `h2Headings`/`rehypeHeadingIds` (`src/lib/headings.ts`), `LazyBody`, `CodeBlock`, the `CaseStudyPage` Contents and prev/next markup (extract a shared component if it's copied twice), and the `ThemeContext` storage pattern.

## Pipeline and verification

- **Setup:** `git switch -c feature/dsa-tab`, then `py -m pip install pytest` locally, before Stage 2 (the test-writer has to see pytest go red).
- **Stage 2:** a fresh test-writer writes criteria 1–15 as tests: vitest files, the three `test_*.py` files, and `scripts/checks.test.mjs` cases. It doesn't write the entries or code files; a fixture entry is only for loader and chunk tests. Gate: only test files changed, and they're red. Lock with `--snapshot src/dsa/code/*/test_*.py` plus any fixtures.
- **Stage 3:** a fresh implementer writes the code, three entries, code files, skill and docs. Gate: `check:test-lock --verify` and `npm run verify`. Plant a failing Python test in a scratch copy to see `test:py` fail. Plant an inlined body for `check:bundle`.
- **Stage 4:** a fresh reviewer gets the spec, NON_NEGOTIABLES and the diff, and does the browser check. Then triage and a capped 4a.
- **Stage 5/6:** the final gate, the handoff, the retro and the pipeline-log row. No commit or push without the user's go-ahead.

## As built

Deviations and choices the spec left open, recorded by Stage 3:

- **`test:py` script line** was added to `package.json` by the orchestrator
  before the Stage 2 snapshot, since `check:test-lock` locks every `test*`
  script; the implementer added it to `verify`.
- **Code pairs** are merged by a small rehype pass inside `MarkdownRenderer`,
  used only with `codeTabs`, into one `<pre data-code-tabs>` that the `pre`
  override renders as `CodeTabs`. Without `codeTabs` the plugin list, and so
  the output, is unchanged. `CodeBlock` gained an optional `className`
  (default `my-5`, so its default markup is identical).
- **Tabs use manual activation:** arrows and Home/End move focus, Enter or
  Space selects, and the selected tab is the one tab stop.
  `CodeLanguageProvider` wraps `AppShell`.
- **Shared page parts:** `Contents` and `PrevNextNav` were extracted from
  `CaseStudyPage` and are used by both it and `DsaEntryPage`.
- **Test lock** also covers `*_test.py`, `tox.ini` and `setup.cfg`, which
  pytest also reads. `check:pipeline-log` accepts `add-dsa-entry <path>` rows.
- **`test-python.mjs`** requires Python 3.10+ (the code uses `X | None`) and
  runs pytest with `-p no:cacheprovider` and `PYTHONDONTWRITEBYTECODE=1`. It
  was seen failing (exit 1) on a planted `bucket.pop()` break in a scratch
  copy. It has no timeout, so a Python test that loops forever hangs `verify`.
- **`actions/setup-python`** is pinned to v7.0.0
  (`5fda3b95a4ea91299a34e894583c3862153e4b97`).
- **Prerequisites:** only `two-pointers` has one (`hash-map`). The order is
  hash-map, two-pointers, binary-search.
- **Sizes (brotli):** main chunk 93.55 → 94.94 kB (limit 104), MarkdownRenderer
  83.13 → 83.81 kB (limit 95); no limit raised.

### Review fixes (Stage 4a, round 1):

- **H1:** the hash map's first "Tricky lines" bullet no longer says
  `[[]] * capacity` only makes operations O(n). It now says answers stay right
  until a resize, after which `_resize` files every pair once per visit to the
  shared list: ten `put` calls leave 52 pair references, and `delete("k3")`
  returns `True` while `"k3"` is still found. With the bug only in `_resize`,
  the same happens one resize later. Checked by running all three variants.
- **H2:** the binary search pitfall now says `mid == lo` when the range holds
  one index (`hi == lo + 1`), with `[1]` searched for 5 as the example
  (`lo = 0`, `hi = 1`, `mid = 0` forever). The rest of the entry had no other
  "two indices" framing.
- **M1:** `check-test-lock.mjs` locks `pytest.toml` and `.pytest.toml`.
- **M2:** `check-test-lock.mjs` locks `scripts/test-python.mjs`. Its header
  comment, `docs/verification.md` and `docs/dsa.md` list the new files and say
  an implementer can't edit the runner after Stage 2.
- **L1:** `docs/dsa.md` and the `DSA_ENTRIES` comment say a bad prerequisite
  fails the vitest tests that import `DSA_ENTRIES`, and `verify` through them,
  not `vite build`.
- **L2:** the CI comment names the `add-dsa-entry` gate, and the
  `nudge-sdlc.js` reminder says "can skip these skills" instead of "both".

### Review fixes (Stage 4a, round 2):

- **1:** `check-test-lock.mjs` locks a root `pytest.py` or `_pytest.py` and
  anything under a root `pytest/` or `_pytest/` (`/^_?pytest(\.py$|\/)/`),
  which would shadow the real pytest when `test-python.mjs` runs
  `python -m pytest` from the root. Ordinary modules such as
  `src/dsa/code/x/pytest_helpers.py` stay unlocked. Its header comment,
  `docs/dsa.md` and `docs/verification.md` list the new paths.
- **2:** `docs/writing-standard.md` covers DSA entries and names
  `add-dsa-entry` among the reviewers given it; `docs/NON_NEGOTIABLES.md` adds
  `add-dsa-entry` Stage 3 to its reviewer list.
- **3b:** `content-audit` scopes `src/dsa/entries/*.md` too (description,
  intro, Stage 0, a DSA batch in Stage 1, a DSA-only check 6 that tests code
  claims against the files and tests under `src/dsa/code/<slug>/`, and a
  Stage 3 note that a code fix changes code, chunk and test together).
  `add-dsa-entry`'s description sends checking or revising an existing entry
  to `content-audit`. SR-11's "Why" in `evals/skill-routing/scenarios.md`
  names DSA entries in the default sweep; no scenario added.

### Review fixes (Stage 4a, extra round, user-authorized):

- **Runner (made by the test-writer, since `scripts/test-python.mjs` is locked
  test config):** pytest runs with `-c <root>/pytest.ini --rootdir <root>`, so
  it reads no other config file; the child environment sets
  `PYTHONSAFEPATH=1`, so the working directory isn't on `sys.path` and no root
  module can shadow one pytest imports, and drops `PYTEST_ADDOPTS` and
  `PYTEST_PLUGINS`. The minimum is now Python 3.11 (for `PYTHONSAFEPATH`),
  replacing the 3.10+ in As built.
- **Lock:** `check-test-lock.mjs`'s `PYTEST_CONFIG_FILE` also matches
  `.pytest.ini`, anywhere in the tree. The config-file and `pytest`/`_pytest`
  shadow entries are now a second layer behind the runner's pinning, which its
  header comment says.
- **Docs:** `docs/dsa.md` describes the runner's pinning and the real shadowing
  mechanism (`python -m` puts the working directory on `sys.path`, closed by
  `PYTHONSAFEPATH`); `docs/verification.md`, `README.md` and
  `add-dsa-entry/SKILL.md` say Python 3.11+.

### Review fixes (extra round 2, user-authorized): DRY cleanup and docs

Behavior, DOM text, accessible names and every name a test imports are
unchanged; the locked tests are the check.

- **1, sidebar navs:** `OrderedNav` (`src/components/OrderedNav.tsx`) is the
  one numbered sidebar list; `DsaNav` and `CaseStudyNav` are thin wrappers
  that pass their label, heading and items.
- **2, landing cards:** `NumberedCardList` is the numbered card list on
  `SystemDesignPage` and `DsaPage`, with an optional label line (the kind).
- **3, tab ownership:** `tabForPath` (`src/lib/tabs.ts`, from
  `isSystemDesignPath` and `isDsaPath`) decides the route's tab for
  `Header`, `App`'s `SideNav` and `MobileNav`.
- **4, stored choices:** `readStoredChoice` and `writeStoredChoice`
  (`src/lib/stored-choice.ts`) hold the try/catch localStorage read, check and
  write that `ThemeContext` and `CodeLanguageContext` both had; keys and
  defaults are the same.
- **5, hast helpers:** `HastNode` and `hastText` are exported once from
  `src/lib/headings.ts` and imported by `MarkdownRenderer`. `textOf` in
  `dsa-prereqs.mjs` (an mdast walker in plain JS) stays.
- **6, `markdownMeta`:** the queries are a `MARKDOWN_VIEWS` table keyed by
  query name, in the old precedence (meta, links, dsaPrereqs).
- **7, page parts:** `neighbours(list, item)` (`src/lib/neighbours.ts`, by
  slug) and `PageHeader` (back link, `h1`, meta line) are used by
  `CaseStudyPage` and `DsaEntryPage`. `TopicPage` is left for a later run.
- **8, `CodeTabs` keys:** a key-to-index table with modulo wrap-around
  replaces the nested ternary (manual activation unchanged).
- **9, `docs/dsa.md`:** no longer says nothing in the tree or environment can
  change the run. It names the three layers: the runner's `-c`,
  `PYTHONSAFEPATH` and `PYTEST_*` stripping (with `PYTHONPATH` and installed
  plugins still applying), the code-folder allowlist in
  `src/dsa/dsa-code-chunks.test.ts`, and the lock.
- **10, Python for `test:run`:** `README.md` and `docs/verification.md` say
  `npm run test:run` needs Python 3.11+ and pytest, since
  `scripts/python-wiring.test.mjs` runs the real runner. Criterion 12's
  parenthetical is out of date: that file now plants a failing Python test in
  vitest, so the planted case does live in `test:run` (on a machine with
  Python), besides the Stage 3 manual check recorded in As built.

- **Review of extra round 2 (fixed directly, docs only):** a plain `python -m pytest` writes `__pycache__/`, which the new folder allowlist rejects, while docs/dsa.md said a plain run "also works" and add-dsa-entry cleaned up after the final `verify`. docs/dsa.md now says to use `npm run test:py`, and the skill deletes the caches before the final `verify`. The allowlist stays strict.
- **Known limitation (pre-existing content):** at a 360px content width, inline code `self._bucket(pair[0]).append(pair)` in hash-map.md overflows by 2px; a true 375px viewport fits.

## Review decisions

- **Known limitation (user-approved 2026-09-30):** the content-review eval has
  no scenarios for `add-dsa-entry`'s Stage 3 review (a wrong complexity claim,
  a code/test gap, a clean control). They are added with the first DSA
  content batch; until then no eval trigger maps to that prompt.
- **Known limitation (after the round cap):** a new locked file whose path is
  also added to `.gitignore` is invisible to `check:test-lock` (it lists files
  with `git ls-files -co --exclude-standard`). This predates the feature; the
  `.gitignore` edit still shows in the reviewer's diff.
- **Extra round (user-authorized 2026-09-30, past the 2-round cap):** the
  round-2 re-review found the pytest shadow lock was a name blocklist (M2) and
  `.pytest.ini` was unlocked (M1). The runner is fixed as a class
  (`-c pytest.ini`, `PYTHONSAFEPATH=1`) in one extra round.
