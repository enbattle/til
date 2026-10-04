# Spec: run the slow guard tests in parallel

Status: approved 2026-10-04.

Baseline (`main` at abad3de, this machine, `npx vitest run`):

- 94s wall time, 2239 tests;
- `scripts/checks.test.mjs` 89s, `scripts/python-wiring.test.mjs` 31s;
- 285 test titles across those two files.

The next slowest file, `src/App.on-this-page.test.tsx` (26s), is out of scope.
So the "no file over about 25s" target in criterion 4 applies to the guard test
files.

## Context

After #57, vitest's wall time (about 110–140s) is set by one file.
`scripts/checks.test.mjs` holds 265 tests in 14 `describe` groups, about 136s
in total. Vitest runs files in parallel across workers but the tests within a
file one after another, so that file alone sets the floor. Its biggest groups
are `check-diagrams` (85 tests, about 61s) and the `check-test-lock` groups (79
tests, about 67s). Nearly every test starts a Node process, git, or both, with
`spawnSync`/`execFileSync`.

`scripts/python-wiring.test.mjs`'s "against a failing test" group spends about
34s running the pytest runner in 11 throwaway copies.

The user asked for this to be faster now. It's a **test-only** change: no
guard script, no app code, and no change to what any test asserts.

## Design

**Split by guard.** Move each guard's groups out of `scripts/checks.test.mjs`
into a test file named after the guard script, e.g.:

- `scripts/check-diagrams.test.mjs`
- `scripts/check-test-lock.test.mjs`
- `scripts/check-pipeline-log.test.mjs`

A group whose file would still take more than about 25s on this machine is
split further along its existing `describe` boundaries (e.g.
`check-test-lock`'s nested groups). Shared helpers (`tempDir`, `copyScripts`,
`gitInit`, `bundleRoot`, `run` and the temp cleanup) move to one test helper
module, `src/test/guard-helpers.mjs`. It's imported by the split files and is
not itself a test file. It lives under `src/test/`, which `check:test-lock`
already locks as test support, so an implementer can't weaken every guard test
through it.

**What stays in `scripts/checks.test.mjs`:** every allowlist vector table
NON_NEGOTIABLES #6 names. That includes the `svgProblems` tables, their encoding
and character-reference cases, and any other allowlist check's vector table.
Those tables already run in-process in milliseconds.

**Share identical runs.** Where several tests in a group run the same script
with the same arguments, root and environment, and only assert different things
about the result, run it once in a `beforeAll` and assert on the shared
result. One example is several `check-diagrams` tests running the script against
the real repository. A test that changes its fixture before running keeps its
own run.

**python-wiring.** In "against a failing test", tests that build the same
copy and run the runner with the same environment share one run. Any group
left above about 15s runs its tests concurrently (`describe.concurrent`), with
the one spawning helper made asynchronous and each test owning its own temp
root.

**Test environment.** The guard test files declare
`// @vitest-environment node`. They don't touch the DOM, and jsdom setup
costs time per file.

## Acceptance criteria

1. Every test title that existed in `scripts/checks.test.mjs` and
   `scripts/python-wiring.test.mjs` before still exists after, in some file,
   once.
   - The test-writer's report includes the before/after list diff: empty
     except for tests merged by "share identical runs", each named with the
     test that now asserts it.
   - The total test count may drop only by those merges.
2. NON_NEGOTIABLES #6's vector tables stay in `scripts/checks.test.mjs`.
3. No guard script, app file, fixture or config file changes. `git status`
   shows only test files and the new helper module, then docs in Stage 3.
4. `npm run test:run` passes, and its wall time drops by at least half from the
   baseline measured on `main` before Stage 2 (same machine, same command,
   recorded in the report). No single test file takes more than about 25s.
5. **Guard coverage gate (orchestrator, after Stage 2):** for at least 8 guard
   scripts, plant one regression each in a copy and confirm their tests now fail
   in the new files, as they did in the old file. The regressions are chosen
   after Stage 2: dropping a rejected vector, inverting an exit code, skipping a
   file. Nothing ends a loop early.
6. `check:test-lock` locks the new test files. Confirm a change to one is
   reported by `--verify`.

## Scope

In:

- `scripts/checks.test.mjs` (split), the new `scripts/*.test.mjs` files and
  `src/test/guard-helpers.mjs`;
- `scripts/python-wiring.test.mjs`.

Docs, Stage 3:

- `.claude/skills/feature/SKILL.md` (lines about 98, 193 and 303 say "a guard
  script's planted-violation cases go in `scripts/checks.test.mjs`"). This
  becomes "in that guard's test file under `scripts/`; NON_NEGOTIABLES #6's
  vector tables stay in `scripts/checks.test.mjs`".
- `docs/verification.md` and `scripts/check-diagrams.mjs:43`'s comment, if
  they name the file.
- Grep for others; the list isn't exhaustive.

Out:

- NON_NEGOTIABLES.md (unchanged, since its tables stay put);
- any guard script;
- the DSA, content and App test files;
- vitest config changes beyond the per-file environment docblock;
- the CI workflow.

User-facing UI: none, so Stage 4 has no browser check.

## Non-negotiables check

- #6: vector tables stay in `checks.test.mjs`, unchanged.
- #8–#10: roles separate, and the coverage gate is the orchestrator's own.
- The SKILL.md edit is a process-file edit. It gets an independent read and the
  skill-routing eval for the scenarios that depend on `/feature`.
- Nothing conflicts.

## Verification

- Before Stage 2: a baseline `npm run test:run` wall time on `main`.
- Stage 2 gate:
  - `git status`;
  - the full suite green;
  - the wall time and per-file times;
  - the title diff;
  - the guard coverage gate;
  - prettier and oxlint.
- Stage 3: `check:test-lock -- --verify` and `npm run verify`.
- Stage 4: review the split for lost or weakened tests and shared-state races,
  with the reviewer's own planted guard regressions.

## As built

**Wall time.** `npx vitest run` takes 48.7s, 51s and 54s across three runs,
against 94s. That's a cut of about 43–48%, short of criterion 4's "at least
half". `npm run verify` runs in 75s in total.

- With every guard file in parallel, the CPU saturates spawning Node and git.
  So per-file times in a full run are 40–46s, while each file run alone takes
  about 11s or less.
- The "no file over about 25s" target can't be met by splitting. It would
  need fewer process spawns per test, which changes how the tests work, so it's
  out of scope here.

**The split.**

- 15 guard files: `check-diagrams` and `check-test-lock` split four ways each,
  plus files for check-pipeline-log, raw-html, bundle, claude-md and hex-colors,
  and `lib`.
- `check-diagrams` has no nested describes, so its 45-case "fails on %s" table
  became two tables with the same title and body (`planted-1`, `planted-2`).
  That goes beyond "describe boundaries only".
- python-wiring: two tests share one runner run. "Against a failing test" is
  `describe.concurrent`, with an async spawn helper.

**Test support.**

- `src/test/setup.ts`'s DOM polyfills are guarded with `typeof window`, so they
  load under `// @vitest-environment node`.
- The diagram-token fixture moved to `src/test/diagram-tokens.json`, because
  `check:colors` scans `.mjs` under `src/` for hex values.

**Checks.**

- Titles: all 308 test titles under `scripts/` are identical before and after.
  No test was merged away; the shared run keeps both titles.
- Guard coverage gate: an `exit(1)` → `exit(0)` mutant at each guard's real
  violation exit, in 8 guards. The new files caught all 8; the old file caught
  7 of them, and `test-python` was caught only by the new python-wiring.
  - The first picks for check-bundle and check-test-lock were setup-error
    exits that no test exercises. Both suites missed those equally, so the
    mutants were moved to the real failure exits.
- The lock covers the new files: 171 locked, and a probe edit was reported.

## Review decisions

- Round 1 fixed (docs): two of the three SKILL.md places naming the per-guard
  file had left out the NON_NEGOTIABLES #6 exception.
- Known limitation: criterion 4's 50% target is missed (43–48%), and per-file
  times in a full run exceed 25s because of CPU contention (see As built).
  Going further means fewer process spawns per test, which is its own change.
- Pre-existing, not caused by this change: no test plants an `outerHTML`
  violation for `check-raw-html`. A mutant dropping it survives both the old
  and new suites. #6 doesn't require a vector table for this code-level lint,
  but the sink it names is untested.
