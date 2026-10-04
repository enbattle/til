# Spec: consolidate the randomized and On-this-page tests

Status: approved 2026-10-04.

## Context

The suite reports 2934 vitest and 3471 pytest tests. Most of that count is
randomized differential tests, which compare a DSA implementation against a
trusted reference (`heapq`, `sorted`, a `set`, a brute force) on seeded random
input. Several of them are parametrized one test per seed:

- pytest: `@pytest.mark.parametrize("seed", range(200))`, where 14 functions
  account for 2700 of the 3471 tests;
- vitest: `it.each` over seed arrays, e.g. `heap.test.ts` has 425 tests and
  takes 32s.

Others already loop over seeds inside one test (TS `union-find`, py
`quicksort-quickselect`). Seed counts run 150–300 per property, though such
bugs nearly always show within the first few dozen trials. Separately, the
"On this page" App tests grew across four runs into four files with some
repeated checks.

The user asked to consolidate both and to cut seed counts to what's needed,
without losing coverage. This is a **test-only** change: no app or DSA
implementation file changes.

## Design

**Randomized tests (both languages, every file under `src/dsa/code/`).**

- Each randomized property is one test that loops over its seeds. On failure,
  its assertion message names the seed (and, where cheap, the input), so the
  failing case can be replayed.
- **50 trials per property.** This applies to seeds and to generated random
  inputs alike: a test that draws `N` random lists from one RNG caps `N` at 50.
- Seeded generators and their base seeds stay as they are, so the first 50
  trials of every property are exactly the trials run today.
- Exhaustive (non-random) enumerations, such as every subset of a small set
  or every `k` for a list, are untouched.
- A property whose random inputs are drawn so small that 50 trials don't reach
  its edge cases (e.g. empty input, size 1) gets an explicit fixed case for
  them, if one isn't already in the file.
- `it.each` / `parametrize` over seeds is removed. `it.each` over meaningful
  fixed cases (e.g. bad inputs) stays.

**On-this-page App tests.**

- Merge `src/App.on-this-page.test.tsx`, `src/App.on-this-page-bar.test.tsx`
  and `src/pages/CaseStudyPage.headings.test.tsx` into one
  `src/App.on-this-page.test.tsx`.
- Keep `src/App.on-this-page-scroll-spy.test.tsx` separate, since its layout
  stubs differ.
- Remove checks asserted more than once. Known ones: "landing pages render no
  bar/nav" (two files), "panel links equal the right nav's" (two), and "no
  Contents nav" (two).
- Every behavior asserted before is still asserted once.

**How the pipeline runs for a test-only change.**

- **Stage 2:** a fresh test-writer does the consolidation. Its gate expects
  green, not red, since behavior is unchanged.
- **Stage 2 gate, mutation check:** before locking, the orchestrator plants at
  least 10 bugs (mutants) of its own choosing. They're chosen after Stage 2, so
  the test-writer can't fit to them. Each goes into an implementation file
  covered by a consolidated test, at least 8 entries across both languages.
  Each mutant must make both the old suite (from `main`) and the new suite
  fail. A mutant the old suite catches but the new one doesn't fails the gate.
- **Stage 3:** the implementer updates docs only.
- **Stage 4:** the reviewer independently plants its own mutants and checks
  the on-this-page merge against the behavior-map table.

## Acceptance criteria

1. No test under `src/dsa/code/` is parametrized over a seed. There's no
   `parametrize("seed", …)`, and no `it.each`/`test.each` over a seed or
   trial-number array.
2. Every randomized property runs at most 50 trials, starting from the same
   base seed as today.
3. A failing randomized test's message includes the seed. Shown by making one
   Python and one TypeScript property fail in a copy and reading the output;
   the test-writer quotes both outputs in its report.
4. `npm run test:run` and `npm run test:py` pass, and the reported totals drop
   (expected roughly ≤ 2000 vitest and ≤ 900 pytest). The `heap.test.ts` file
   time and the total `test:run` time drop. Before/after numbers go in the
   report.
5. The on-this-page tests live in two files (`App.on-this-page.test.tsx` and
   `App.on-this-page-scroll-spy.test.tsx`), and `CaseStudyPage.headings.test.tsx`
   and `App.on-this-page-bar.test.tsx` are gone. The test-writer's report
   includes a table mapping every removed test title to the test that now
   covers its behavior, or "duplicate of …".
6. Mutation gate (orchestrator): at least 10 mutants across at least 8
   entries, both languages, each caught by the old and the new suite.
7. No implementation file, content file or fixture changes (`git status`
   shows only test files, then docs in Stage 3).

## Scope

In:

- Test files: every `src/dsa/code/*/test_*.py` and `*.test.ts` with a
  randomized property, plus the four on-this-page test files above.
- Docs, Stage 3:
  - `docs/dsa.md` and `.claude/skills/add-dsa-entry/SKILL.md` step 2 ("compare
    against it on many seeded random inputs" becomes the one-test, 50-trial,
    seed-in-message convention);
  - any doc quoting test counts or the seed convention (grep; not exhaustive).

Out:

- `scripts/checks.test.mjs` and `scripts/python-wiring.test.mjs`. They're slow
  because they spawn processes, and their vector tables are required by
  NON_NEGOTIABLES #6.
- Per-content tests (one per topic, case study or entry).
- Any other test file.
- New guard scripts.

User-facing UI: none, so Stage 4 has no browser check.

## Non-negotiables check

- #6: the guard vector tables are untouched.
- #8–#10: roles stay separate. Test files change only through the test-writer,
  and the mutation gate is run by the orchestrator, not self-reported.
- #11: no commit without go-ahead.
- The `add-dsa-entry` SKILL.md edit is a process-file edit, so it gets the
  skill-routing eval scoped to SR-18 afterwards.
- Nothing conflicts.

## Verification

- Stage 2 gate:
  - `git status` (test files only);
  - `npm run test:run` and `npm run test:py` green, with lower counts;
  - typecheck, prettier and oxlint;
  - the mutation gate (criterion 6).
- Stage 3: `check:test-lock -- --verify` and `npm run verify`.
- Stage 4: a coverage-loss review, with the reviewer's own mutants.

## As built

- Counts:
  - vitest 2934 → 2229 (DSA code tests 1457 → 763; their file time 50s → 8s);
  - pytest 3471 → 782 (18.8s → 4.0s).
  - The vitest wall time is set by `scripts/checks.test.mjs` (out of scope), so
    total `test:run` time didn't drop.
- Stage 2 split the test-writer role into three agents with disjoint entry sets;
  writer A also merged the On-this-page files.
- The orchestrator's mutation gate: 11 mutants across 9 entries, both
  languages, each killed by both the old and new suites. A control run of the
  old copies without mutants passed.
- The reviewer's 11 further mutants: 10 killed by both suites. One survives
  both (below).

## Review decisions

- Known limitation: four aggregate "generator sanity" assertions (the strings
  palindrome hit-rate, the bellman-ford negative-cycle and negative-edge floors,
  in both languages) have no seed in their message. They check the test's
  own input generator, not the implementation, and fail only if the generator
  changes, which is visible in the diff.
- Accepted per this spec: intervals and dp-two-sequences now run only their
  first base seed's first 50 trials (the old later seeds are dropped). The
  generators were checked to yield the same leading inputs.

Pre-existing, not caused by this change:

- `k-way-merge`'s `kth_smallest` above rank 30 is never exercised: a mutant
  returning `None` there survives the old and new suites.
- `top-k`'s MinHeap test and `dijkstra`'s single random sequence have no seed
  message.
