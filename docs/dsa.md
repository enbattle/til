# DSA entries

How the DSA tab's entries and their code are stored, structured, ordered and
tested. Read this before adding or changing an entry;
[CLAUDE.md](../CLAUDE.md) routes here, and the `add-dsa-entry` skill follows
it.

The header's third tab, **DSA** (`/dsa`), teaches data structures,
problem-solving patterns and algorithms at interview depth. Each entry is
about a five-minute read (the Writing Standard's "Case studies and DSA
entries" section) and walks through one real, commented implementation a few
lines at a time, in both Python and TypeScript, and that code is the same code
the entry's tests run.

**Migrating (2026-10).** The entries are being consolidated (42 to 28; the
list is under "Scope" below) and rewritten to the templates and budget on
this page, about five per pull request. An entry opts in with the frontmatter
line `template: 2`, and `dsa-structure.test.ts` then checks it against the
templates and budget on this page; one without the line is still checked
against the earlier templates (git history has them). Any other `template`
value fails the test, naming the file and the value. Only the structure test
reads the line; the loader ignores it. Every new or rewritten entry carries
`template: 2`. The last migration batch removes the earlier templates, the
line and this note.

Each merge below reads its old entries and code as research notes, deletes
them and their code folders, and repoints every link to an old slug
(`git grep -n "/dsa/<old-slug>"`). The new slugs are checked against Python's
standard-library module names. Every entry not listed keeps its slug and is
rewritten in place.

| New entry (slug)                                       | Kind           | Absorbs                                                                                                 |
| ------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------- |
| Arrays and strings (`arrays-and-strings`)              | data structure | `dynamic-array`, `strings` (done, DSA batch 1)                                                          |
| Stacks and queues (`stacks-and-queues`)                | data structure | `stack`, `queue-and-deque` (done, DSA batch 1)                                                          |
| Two pointers (`two-pointers`)                          | pattern        | `two-pointers`, `fast-slow-pointers`                                                                    |
| Heap patterns (`heap-patterns`)                        | pattern        | `top-k`, `k-way-merge`, `two-heaps`                                                                     |
| DP: memoization and tabulation (`dynamic-programming`) | pattern        | `dp-one-dimensional` (done, batch 1)                                                                    |
| DP: common shapes (`dynamic-programming-shapes`)       | pattern        | `dp-grids`, `dp-knapsack`, `dp-two-sequences`; a sentence each from `dp-intervals`, `dp-state-machines` |
| Sorting (`sorting`)                                    | algorithm      | `merge-sort`, `quicksort-quickselect`, `bucket-counting-sort` (counting sort as prose, no code)         |
| Breadth-first search (`breadth-first-search`)          | algorithm      | `graph-bfs`, `tree-bfs`                                                                                 |
| Depth-first search (`depth-first-search`)              | algorithm      | `graph-dfs`, `tree-dfs`                                                                                 |
| Shortest paths (`shortest-paths`)                      | algorithm      | `dijkstra`, `bellman-ford`                                                                              |

`prim-kruskal` keeps its slug under the title "Minimum Spanning Trees".

```
src/dsa/
  entries/<slug>.md                    # one entry
  code/<slug>/<slug_underscored>.py    # its Python code (stdlib only)
  code/<slug>/test_<slug_underscored>.py
  code/<slug>/<slug>.ts                # its TypeScript code (no imports)
  code/<slug>/<slug>.test.ts
  dsa-structure.test.ts                # the heading templates
  dsa-code-chunks.test.ts              # the chunks match the code files
```

Like case studies, entries live outside `src/content/`, so they are not a
catalog section (`registry.ts` has no `dsa` slug). They have their own loader,
`src/lib/dsa.ts`: frontmatter, prerequisites and word counts are eager (the
`?meta`, `?dsaPrereqs` and `?words` queries in `vite.config.ts`), and each body is its own lazy chunk
through the same `createBodyStore` as topics (`check:bundle` covers
`src/dsa/entries`). The code files never reach the app bundle; only the
markdown does.

## Frontmatter

```md
---
title: Binary Search
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
kind: algorithm
template: 2
---
```

`kind` is `data-structure`, `pattern` or `algorithm`:

- A **data structure** is a way of storing data, defined by what its
  operations cost (a hash map, a heap).
- An **algorithm** is a fixed procedure that solves a named problem, with a
  known result and cost (binary search, breadth-first search, Dijkstra's
  shortest paths). You run it as written.
- A **pattern** is a technique you adapt to a family of problems, where the
  work is recognizing the family and shaping the solution (two pointers, a
  sliding window, dynamic programming, backtracking).

When an entry could be either, ask whether its code changes from problem to
problem: an algorithm's doesn't, a pattern's does. `parseDsaEntry` throws
at load time, naming the file and field, if a field is missing or empty, if
`kind` is anything else, or if the file isn't `src/dsa/entries/<slug>.md` with
a lowercase kebab-case slug.

## Templates

The body's `##` headings are exactly, in order
(`src/dsa/dsa-structure.test.ts` checks the rendered page):

- **Data structure:** `Prerequisites`, `What it is`, `When to use it`,
  `Operations and costs`, `Implementation`, `Pitfalls`.
  `Operations and costs` holds a table (average and worst case per operation,
  plus space). `Implementation` holds at least one code pair.
- **Pattern** and **algorithm:** `Prerequisites`, `The idea`,
  `When to use it`, `Walkthrough`, `Complexity`, `Pitfalls`. `Walkthrough`
  holds at least two code pairs, each followed directly by a short paragraph
  (one to three sentences) that connects it to the next step.

Every kind ends the same way:

- `When to use it` is the part that transfers to a problem the entry never
  shows: the signals in a problem statement that point to this entry, as a
  short list.
- `Pitfalls` names the two to four mistakes people actually make, each tied
  to a specific line of the code and what goes wrong if it's written the
  obvious way.

The prose, tables included, is at most 1,150 words; code blocks don't count
(`dsa-structure.test.ts` counts them with `proseWordCount` in
`src/lib/markdown.mjs`). The same count, eager through the build-time `?words`
view, gives the entry page's "N min read" label (230 words a minute,
`readingMinutes` in `src/lib/reading-time.ts`). An intro
paragraph before `## Prerequisites` is fine. `dynamic-programming.md` is the
reference example on the new template; until each kind has one of its own,
copy its voice, length and comment style and take the headings from the
template above. The page builds its "On this page" list from these headings with
`h2Headings`, as a case study does.

## Code pairs and the code files

Every code example in `Implementation` or `Walkthrough` is a **pair**: a
` ```python ` fence directly followed by a ` ```typescript ` fence, with
nothing but a blank line between them. The entry page renders each pair as one
block with Python and TypeScript tabs (`CodeTabs`); the choice applies to every
pair on the site and is remembered in `localStorage` (`til-code-language`).
A lone fence, a pair in the other order, or a pair split by a paragraph renders
as plain code blocks, and the structure test fails it inside those two
sections.

The python fences in those sections, in order, must be the entry's `.py` file,
and the typescript fences the `.ts` file, compared line by line with blank
lines dropped (`src/dsa/dsa-code-chunks.test.ts`, which reads the fences with
`markdownParser()`). So a chunk may stop anywhere, even in the middle of a
function, and blank lines between chunks don't matter, but every other line of
the file appears exactly once, in order. Write the code files first, run their
tests, then copy them into chunks. Fences elsewhere in the entry (a usage
example, a `text` diagram in `What it is`) aren't compared.

The code files:

- `<slug_underscored>.py`: Python 3.11+ (CI pins its version in `ci.yml`), standard library only,
  with type hints. `<slug>.ts`: no imports, exported functions or classes.
  Both idiomatic for their language rather than a transliteration of each
  other; the APIs match in shape (`lower_bound` / `lowerBound`).
- One core implementation per entry, about 30–60 lines per language not
  counting comments. An entry that covers several shapes (the DP shapes, the
  heap patterns) gives each its own short function; a variant that changes
  one line is a sentence in the prose, not more code.
- Comments explain why, at the line where the obvious alternative would
  break, so the entry's prose doesn't have to
  (`lo = mid + 1  # mid was already checked; keeping it can loop forever`).
  They don't narrate what a line does. Both files carry the same reasons, in
  each language's comment style, since a reader sees only one tab.
- The slug's underscored form must not be a Python standard-library module
  name (`py -c "import sys; print('queue' in sys.stdlib_module_names)"`).
  pytest puts each code folder first on the import path, so a `queue.py` or
  `string.py` either loses to the standard module already imported or shadows
  it for every later import in the run. Name the entry instead: `arrays-and-strings`, `stacks-and-queues`.
- `test_<slug_underscored>.py` (pytest) and `<slug>.test.ts` (vitest) import
  the real code files and cover the edge cases, not only the happy path: empty
  input, duplicates, the boundaries, and a comparison against a brute-force
  or standard-library answer on seeded random inputs where one exists.
- A randomized comparison is one test per property that loops over its
  trials: at most 50, from a fixed seed (`random.Random(seed)` in pytest, a
  small seeded generator such as mulberry32 in vitest). Put the seed, and the step or input where cheap, in
  every assertion's message so a failure can be replayed. Don't parametrize
  over seeds (`parametrize("seed", …)`, `it.each` over seed arrays): it
  multiplies the test count and run time without adding coverage. Random
  inputs rarely hit the edges, so cover empty input and size 1 with explicit
  fixed cases. `src/dsa/code/heap/` shows the pattern in both languages.
- Prettier formats the `.ts` file and leaves the markdown's code alone when a
  chunk isn't a complete program, which is the usual case. Keep lines under 90
  characters so the chunks scroll less on a phone.

`npm run test:py` (`scripts/test-python.mjs`, part of `verify`) runs pytest
over `src/dsa/code` with the first Python 3.11+ it finds (`python3`, `python`,
then `py -3`, skipping the Windows Store stub). Install pytest with
`python -m pip install -r requirements-dev.txt` (`py -m pip ...` on Windows);
the pinned version is in `requirements-dev.txt`, and CI and the deploy install
it the same way. Use `npm run test:py` rather than a plain `python -m pytest`:
a plain run (or an IDE's test runner) writes `__pycache__/` into the code
folders, which the folder allowlist below rejects until you delete it.

Three things keep a stray file or setting from making `test:py` pass on
broken code. First, the runner pins pytest's config and import path.
`-c <root>/pytest.ini` makes pytest read only that file, never another config
file it would otherwise discover. `python -m` normally puts the
working directory first on `sys.path`, so a root module named like one pytest
imports (`pytest.py`, `pluggy.py`, `iniconfig.py`) would replace the real
one; the runner sets `PYTHONSAFEPATH=1` (the reason for 3.11+), which leaves
the working directory off `sys.path`. It also drops `PYTEST_ADDOPTS` and
`PYTEST_PLUGINS` from the environment, but nothing else: `PYTHONPATH` and any
pytest plugins installed in that Python still apply. Second, pytest puts each
test's own folder on `sys.path`, which `PYTHONSAFEPATH` doesn't change, so an
extra file in a code folder (an `__init__.py`, or a module or package named
like the code under test) could still change what a test imports.
`src/dsa/dsa-code-chunks.test.ts` (in `test:run`) treats the code tree as an
allowlist: each `src/dsa/code/<slug>/` belongs to an entry and holds exactly
its four files, with no subfolders, and every entry has its folder. Third,
`check:test-lock` locks the pytest files, every file pytest could read its
config from, the runner and the allowlist test, so a `/feature` implementer
can't change them after Stage 2 ([verification.md](verification.md) lists
everything it locks). The lock lists files through git, so a file inside an ignored path under
`src/dsa/code` (a `coverage/conftest.py`, say) is invisible to it; the
allowlist test is what rejects that one. Outside `src/dsa/code`, pytest loads
`conftest.py` only from the fixed folders above the code tree, none of them
ignored, and ignoring one would mean editing a locked ignore rule.

## Prerequisites and order

An entry's prerequisites are the `/dsa/<slug>` links inside its
`## Prerequisites` section, in order (`dsaPrerequisites` in
`src/lib/markdown.mjs`, run at build time). The page shows them as
**Before this** under the title. Link an entry there only when the prose
really needs it; with none, say so in prose (the structure test fails an empty
section). A `/dsa/` link anywhere else in the body is a "see also" and doesn't
count.

`DSA_ENTRIES`, which orders the landing page, the sidebar and prev/next, is
grouped by kind: data structures, then patterns, then algorithms
(`DSA_GROUPS`, from `groupDsaEntries` in `src/lib/dsa.ts`). The landing page
and the sidebar show each group under its own heading, numbered in one
sequence across them. The order comes from one topological pass over all
entries (`orderDsaEntries`): at each step it takes, among the entries whose
prerequisites are all placed, the first by kind, then title, then slug. The
groups then keep that order, kind by kind (`groupDsaEntries`). So a new entry
sits among its kind by title unless a prerequisite holds it back; one of a
later kind holds it until every entry of its own kind that's ready has gone,
which puts it at or near the end of its group. That prerequisite comes after
its dependent; today the only one is
`binary-search-tree` -> `binary-search`, and after the migration also
`backtracking` -> `depth-first-search` (a pattern that builds on an
algorithm). Their **Before this** links still work. `dsa.test.ts` pins that list, so a new backwards cross-group link fails
the test until someone extends the list on purpose (ask the user first).

A prerequisite cycle, a link to an entry that doesn't exist, or an entry
listing itself throws at load time, naming the entries. Only the vitest tests
that import `DSA_ENTRIES` catch it; `vite build` alone doesn't run that code,
but `verify` still fails because `test:run` comes before `build`.

Link a catalog topic where the prose uses it, as `[text](/<section>/<slug>)`.
Nothing checks catalog links or see-also `/dsa/` links in DSA entries, so
confirm each target exists (`ls src/content/*/`, `ls src/dsa/entries/`).
Catalog topics and case studies don't link back.

## Scope

The tab covers data structures, patterns and algorithms at interview depth;
`src/dsa/entries/` and each file's `kind` are the list. Fewer, broader entries
beat many narrow ones: a variant someone would learn in the same sitting
(fast and slow pointers, Bellman-Ford beside Dijkstra) is a section of the
entry it varies, not an entry of its own. The migration's target list, 28
entries:

| Kind           | Entries                                                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data structure | arrays and strings, hash map, linked list, stacks and queues, binary tree, binary search tree, heap, graph, trie, union-find                                                                                                                                         |
| Pattern        | two pointers (with fast and slow), sliding window, prefix sums, monotonic stack, intervals, greedy, backtracking, bit manipulation, heap patterns (top-k, k-way merge, two heaps), DP: memoization and tabulation, DP: common shapes (grid, knapsack, two sequences) |
| Algorithm      | binary search, sorting (merge sort, quicksort and quickselect, counting sort), breadth-first search and depth-first search (trees and graphs), topological sort, shortest paths (Dijkstra, Bellman-Ford), minimum spanning trees                                     |

Interval DP and state-machine DP get a sentence each in "DP: common shapes",
not entries. Segment trees and Fenwick trees are deliberately left out.
Adding an entry is a scope decision for the user, not a gap; a new entry still
goes through the `add-dsa-entry` skill.
