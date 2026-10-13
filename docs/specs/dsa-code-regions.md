# Spec: DSA code regions instead of copied chunks

Status: approved 2026-10-12.

Saved on approval as `docs/specs/dsa-code-regions.md`. Branch `feat/dsa-code-regions`, from `main`.

## Context

Every DSA entry shows its code as python/typescript fence pairs under `## Implementation` or `## Walkthrough`. Today each fence is a hand-made copy of a slice of the entry's tested code file:

- `src/dsa/code/<slug>/<slug_underscored>.py`
- `src/dsa/code/<slug>/<slug>.ts`

`src/dsa/dsa-code-chunks.test.ts` only checks that the copies still match. So any code change edits two files, and the upcoming beginner-readable rewrite of all 28 entries would mean re-copying 56 files by hand.

The fix is for the code to live once:

- The code files mark named regions.
- The markdown names a region instead of holding code.
- The build fills the code in.

Code files never reach the bundle (docs/dsa.md), so readers see exactly what they see today. This was agreed with the user as step 3 of this session's cleanup order.

## Design

**Region markers** live in the code files, as VS Code's folding conventions:

- Python: a line `# region <name>` … `# endregion`
- TypeScript: a line `// #region <name>` … `// #endregion`

Rules for markers:

- Markers may be indented, to sit inside a class.
- `<name>` is lowercase kebab-case.
- Names are per file; the two languages usually reuse the same names.
- A region's text is the lines between its markers, with leading and trailing blank lines dropped.

**Region fences** in an entry look like ` ```python region=<name> `, with an empty body.

- The fence's language picks the file: `python` → `.py`, `typescript` → `.ts`.
- The entry's slug picks the folder.
- Fences elsewhere in an entry (a usage example, a `text` diagram) stay literal and untouched.

**Resolution** happens in `src/lib/code-regions.mjs`, a new module that runs at build and test time only:

- `parseRegions(source, language)` returns the file's regions in file order, or throws an error naming the file, line and problem.
- `resolveCodeRegions(markdown, { python, typescript, label })` replaces each region fence with a plain fence (` ```python `) holding that region's text, and returns the new markdown.
- It finds fences with the shared `markdownParser()` (`src/lib/markdown.mjs`) and splices by node position. That way it never matches a fence with a regex, and text outside the fences is byte-for-byte unchanged.

**Wiring:** `vite.config.ts`'s `markdownMeta` plugin handles every import of `src/dsa/entries/<slug>.md`:

- The `?raw` body glob, which the plugin now serves itself with `export default <JSON string>`.
- The `?meta`, `?dsaPrereqs` and `?words` views.

For each of these, the plugin:

- reads `src/dsa/code/<slug>/<slug_underscored>.py` and `.ts`;
- resolves the markdown first;
- calls `addWatchFile` on both code files, so a code edit reloads in dev.

Vitest reuses the plugin, so every test and the app see resolved markdown. Other `.md` files and other queries are unchanged.

**Invariant**, replacing the copy check. The entry's region fences, in the order the entry names them, must use each region of the file exactly once, in file order. Every non-blank line of the file must sit inside a region; marker lines don't count. This is today's "the shown chunks, in order, are the whole tested file", kept.

**Errors** throw at build or test time and name the entry, the file and the region:

- an unknown region name
- a region used twice, or never used
- regions used out of file order
- a non-blank line outside every region
- nested regions
- an unclosed region
- an `# endregion` with no open region
- a duplicate name in a file
- a malformed or non-kebab name
- a region fence with a non-empty body
- a region fence for an entry with no code folder
- a plain (literal) python/typescript fence under `## Implementation` or `## Walkthrough`, which must now be a region fence

**Migration**, done by the implementer with a throwaway script (not committed):

- For each of the 28 entries, wrap each existing chunk's lines in its code file in a region. Each region is named after the function, class or method the chunk starts with, in kebab-case; otherwise `part-<n>`.
- Replace each chunk fence with its region fence.
- The resolved markdown of every entry must equal today's file byte for byte.
- Blank lines between chunks stay outside regions.

## Acceptance criteria

1. **Region parsing** (`parseRegions`):
   - It returns each region's name and text for both marker styles, including indented markers inside a class.
   - Text excludes the markers and has its outer blank lines trimmed.
   - It throws, naming the line, on each of: nested, unclosed, a stray endregion, a duplicate name, a bad name.
2. **Resolution** (`resolveCodeRegions`):
   - A region fence becomes a plain fence holding the region's text.
   - A literal fence elsewhere and all prose are unchanged, byte for byte.
   - It throws naming the entry and region for each error in the Design list.
3. **Coverage**: it throws when a non-blank line lies outside every region, when a region is unused, and when regions are used out of file order. The check runs per language.
4. **Wiring:**
   - Importing an entry `?raw` (as `src/lib/dsa.ts` and the tests do) yields resolved markdown.
   - `?words` is unchanged for an entry whose prose is unchanged, since code isn't counted.
   - The rendered DSA page shows the same code tabs as before.
   - Non-DSA markdown (topics, case studies) is unaffected.
5. **Migration:**
   - Every entry's resolved markdown equals its pre-change file. Orchestrator check: diff against the copies saved before Stage 2, in the scratchpad.
   - No entry's markdown under Implementation/Walkthrough holds a literal python or typescript fence.
   - Every code file is fully covered by regions.
6. **Folder check:** `dsa-code-chunks.test.ts` keeps its allowlist part unchanged. Each code folder holds exactly its four files, every entry has a folder, and there are no subfolders.
7. **Code and tests still pass:** the region markers change nothing that runs. `npm run test:py` and `npm run test:run` pass, and Prettier accepts the marked `.ts` files.
8. **Docs** (reviewer):
   - `docs/dsa.md`'s "Code pairs and the code files" describes regions and region fences instead of copying. It gives the order rule, notes that VS Code folds the markers, and says how to split a region when a walkthrough wants a smaller chunk.
   - `.claude/skills/add-dsa-entry/SKILL.md` drops "copied from the finished code files" and its "Fix step" two-file rule in favour of regions.
   - The comment at the top of `vite.config.ts` lists the new behavior.

## Scope

- **In:**
  - `src/lib/code-regions.mjs` (new)
  - `vite.config.ts`'s `markdownMeta` plugin
  - `src/dsa/dsa-code-chunks.test.ts` (rewritten by Stage 2 for the region invariant)
  - new unit tests in `src/lib/code-regions.test.ts`
  - the 28 entries and 56 code files (markers and fences only)
  - `docs/dsa.md`, `add-dsa-entry/SKILL.md`
- **Out:**
  - any change to what the code does or how an entry reads (that is the later DSA rewrite)
  - the TS `MinHeap` copies
  - eval scenario drafts, which embed literal code on purpose
- **UI:** no new UI. Stage 4's reviewer opens one DSA page (heap) in the dev server and confirms both tabs show code at 375px and full width in both themes.

## Roles

- **Stage 2 test-writer:** rewrites `dsa-code-chunks.test.ts`'s chunk comparison into the region invariant over the real entries, keeping the folder allowlist. Writes `code-regions.test.ts` with fixtures in-memory. No locked script changes.
- **Stage 3 implementer:**
  - the module and the plugin wiring
  - the migration
  - the docs

  The implementer may split off extra agents for the migration under "Splitting a role" only if 28 entries are too many to read; one owner keeps the module.

## Evals

Editing `add-dsa-entry/SKILL.md` and its checklist names two evals: `skill-routing-eval` and `content-review-eval`. Both are batched with the docs-dedupe change that follows; this session runs them then.

## Verification

- **Stage 2/3/5 gates as usual:** test-lock, `npm run verify`.
- **Orchestrator:**
  - diff each entry's resolved markdown against the saved pre-change copies; all 28 must be identical
  - plant a missing region name and an uncovered line in a scratch copy and confirm the build or test fails naming the entry

## As built

- 27 of 28 entries resolve byte-identical to their pre-change files (orchestrator diff). `sorting.md`'s `partition` fence had a trailing blank line inside it; region text trims outer blank lines, so that fence is one line shorter and nothing else differs.
- To keep the rest identical, blank lines that a chunk didn't show were removed from nine Python files (two blank lines inside a chunk became one): `arrays_and_strings.py`, `binary_search_tree.py`, `binary_search.py`, `dynamic_programming.py`, `graph.py`, `hash_map.py`, `linked_list.py`, `stacks_and_queues.py`, `trie.py`. No `.ts` file changed beyond markers.
- Prettier writes an empty fence with one blank line inside, so region fences hold one blank line on disk; the parser reads the body as empty. `docs/dsa.md` says so.
- `parseRegions` also returns each region's opening `line`. Errors name the entry path and its code folder plus the language, rather than the code file's full path.
- `.claude/skills/content-audit/SKILL.md` repeated the old two-file fix rule and was updated too (beyond the spec's doc list).
- Planted in a scratch run against the real heap entry: an unknown region name and an uncovered line each throw naming the entry and the region or line.

## Review decisions

- Reject: "a code edit reloads the entry in dev" overstates it. Triage ran a dev server: editing a code file sends the same hot update as editing the `.md`.
- Known limitation: nine `.py` files have one blank line between top-level definitions inside a region (PEP 8 wants two); restoring two would add a blank line to the shown code. The DSA rewrite rewrites these files.
- Known limitation: region names are inconsistent (some first regions named after a definition, others `part-1`; 12 of 28 pairs differ across languages). Cosmetic; the DSA rewrite renames them.
- Deferred to the docs-dedupe change (re-review round 1): `evals/content-review/scenarios.md`'s DS base still uses literal fences, DS-01 says to edit "the entry's first typescript fence", and its intro says it follows `docs/dsa.md`'s template; reconcile it with region fences before the batched content-review-eval run.
- Known limitation, after the fix-round cap (round 2 re-review): the real-entries test's own marker reader requires a space or end of line after `endregion`, while the module accepts VS Code's `endregion\b` (so `// #endregion: name` builds but fails `test:run` with a line-mismatch message). A false failure, never a missed check.
- Known limitation (theoretical): a code comment that starts its line with `# region` followed by prose (`# region of the array we scan`) is read as a marker and fails the build with a clear name error.
- Not a gap: a literal fence tagged `py` or `ts` under Implementation/Walkthrough isn't matched by the module or this test, but `dsa-structure.test.ts` fails it as "not part of a python+typescript pair".
