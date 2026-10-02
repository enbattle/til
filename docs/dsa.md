# DSA entries

How the DSA tab's entries and their code are stored, structured, ordered and
tested. Read this before adding or changing an entry;
[CLAUDE.md](../CLAUDE.md) routes here, and the `add-dsa-entry` skill follows
it.

The header's third tab, **DSA** (`/dsa`), teaches data structures,
problem-solving patterns and algorithms at interview depth. Each entry
explains its subject from zero background and walks through a real
implementation a few lines at a time, in both Python and TypeScript, and that
code is the same code the entry's tests run.

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
`src/lib/dsa.ts`: frontmatter and prerequisites are eager (the `?meta` and
`?dsaPrereqs` queries in `vite.config.ts`), and each body is its own lazy chunk
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
---
```

`kind` is `data-structure`, `pattern` or `algorithm`. `parseDsaEntry` throws
at load time, naming the file and field, if a field is missing or empty, if
`kind` is anything else, or if the file isn't `src/dsa/entries/<slug>.md` with
a lowercase kebab-case slug.

## Templates

The body's `##` headings are exactly, in order
(`src/dsa/dsa-structure.test.ts` checks the rendered page):

- **Data structure:** `Prerequisites`, `What it is`, `Operations and costs`,
  `Implementation`, `Invariants`, `Tricky lines`, `When to use it`.
  `Operations and costs` holds a table (average and worst case per operation,
  plus space). `Implementation` holds at least one code pair.
  `Tricky lines` names specific lines of the code in prose and says what goes
  wrong if they're written the obvious way.
- **Pattern** and **algorithm:** `Prerequisites`, `The idea`,
  `When to use it`, `Walkthrough`, `Complexity`, `Pitfalls`. `Walkthrough`
  holds at least three code pairs, and each pair is followed directly by a
  paragraph that explains why those lines are written the way they are.

An intro paragraph before `## Prerequisites` is fine. `hash-map.md`,
`two-pointers.md` and `binary-search.md` are the reference examples for each
kind. The page builds its Contents list from these headings with
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

- `<slug_underscored>.py`: Python 3.11+ (CI runs 3.12), standard library only,
  with type hints. `<slug>.ts`: no imports, exported functions or classes.
  Both idiomatic for their language rather than a transliteration of each
  other; the APIs match in shape (`lower_bound` / `lowerBound`).
- The slug's underscored form must not be a Python standard-library module
  name (`py -c "import sys; print('queue' in sys.stdlib_module_names)"`).
  pytest puts each code folder first on the import path, so a `queue.py` or
  `string.py` either loses to the standard module already imported or shadows
  it for every later import in the run. Name the entry instead: `dynamic-array`,
  `strings`, `queue-and-deque`.
- `test_<slug_underscored>.py` (pytest) and `<slug>.test.ts` (vitest) import
  the real code files and cover the edge cases, not only the happy path: empty
  input, duplicates, the boundaries, and a comparison against a brute-force
  or standard-library answer on many generated inputs where one exists.
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

`DSA_ENTRIES`, which orders the landing page, the sidebar and prev/next, is a
topological order over prerequisites: every prerequisite comes before the
entries that need it, and ties go by kind (data structures, then patterns,
then algorithms), then title. A prerequisite cycle, a link to an entry that
doesn't exist, or an entry listing itself throws at load time, naming the
entries. Only the vitest tests that import `DSA_ENTRIES` catch it; `vite build`
alone doesn't run that code, but `verify` still fails because `test:run`
comes before `build`.

Link a catalog topic where the prose uses it, as `[text](/<section>/<slug>)`.
Nothing checks catalog links or see-also `/dsa/` links in DSA entries, so
confirm each target exists (`ls src/content/*/`, `ls src/dsa/entries/`).
Catalog topics and case studies don't link back.

## Roadmap

The tab's planned end state is 42 entries. Twenty-six are written; the rest are
added in batches with the `add-dsa-entry` skill. Names are working titles.

- **Data structures (12):** array and dynamic array (done), string (done),
  linked list (done), stack (done), queue and deque (done), hash map (done),
  heap and priority queue (done), binary tree (done), binary search tree
  (done), trie (done), graph (done), union-find (done). No segment trees or
  Fenwick trees.
- **Patterns (22):** two pointers (done), sliding window (done), prefix sums
  (done), fast and slow pointers (done), monotonic stack (done), intervals
  (done), top-k with a heap (done), two heaps (done), k-way merge (done), tree
  depth-first search (done), tree breadth-first search (done), graph
  breadth-first search (done), graph depth-first search (done), backtracking,
  greedy, bit
  manipulation, and dynamic programming split into six: one-dimensional,
  grids, knapsack, two sequences (longest common subsequence, edit distance),
  intervals, and state machines.
- **Algorithms (8):** binary search (done), merge sort, quicksort and
  quickselect, bucket and counting sort, topological sort, Dijkstra,
  Bellman-Ford, Prim and Kruskal.
