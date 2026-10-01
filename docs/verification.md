# Verifying a change

What each check proves and how to run it. [CLAUDE.md](../CLAUDE.md) has the
one command that matters; read this when a check fails, when you add or change
a check, or when a size budget moves.

`npm run verify` is exactly what CI runs (`ci.yml` calls it), and
is the final gate of every skill that changes the repo (the eval and audit
skills run only the checks they name). The deploy workflow runs it too, so a
commit that fails any check never goes live. The individual commands, if you need one:

```bash
npm run typecheck && npm run lint && npm run format:check
npm run check:colors && npm run check:tokens && npm run check:contrast && npm run check:npm-refs && npm run check:claude-md && npm run check:pipeline-log && npm run check:raw-html && npm run check:diagrams
npm run test:run && npm run test:py
npm run build
npm run size && npm run check:bundle
```

`npm run check:claude-md` fails if `CLAUDE.md` passes 150 lines or links to a
file that doesn't exist. `CLAUDE.md` is loaded into every session and
subagent on every turn, so it stays a router and detail lives in the docs it
links; raise the limit only deliberately, like a size budget.

The scripts that walk the tree (`check:colors`, `check:npm-refs`,
`check:raw-html`, `check:diagrams`, `check:bundle`, `npm run diagrams`) list
files with `listFiles` in `scripts/lib.mjs` (`git ls-files -co
--exclude-standard`), so an ignored file is never read and there's no
per-script skip list; `ROOT` and `escapeRegExp` live there too.
`check:raw-html` scans `.js`, `.jsx`, `.mjs`, `.ts` and `.tsx` under `src/`
(minus tests), and `check:colors` scans `.ts`, `.tsx`, `.mjs` and `.css`;
`.mjs` counts because `src/lib/markdown.mjs` ships to the browser.

`src/lib/text-encoding.test.ts` (part of `test:run`) fails on any tracked text
file holding double-encoded UTF-8. That happens when a UTF-8 file is read as
Windows-1252 and written back, as Windows PowerShell 5.1's
`Get-Content`/`Set-Content` do. It also fails on U+FFFD, which is what a file
saved in the ANSI code page decodes to. It scans `git ls-files` output (plus
untracked, unignored files) by extension and skips `public/`. A topic that
needs to show mojibake as an example would need an exemption there.

`npm run test:py` (`scripts/test-python.mjs`) runs pytest over the DSA
entries' Python code in `src/dsa/code` (docs/dsa.md). It needs Python 3.11+
with the pytest pinned in `requirements-dev.txt`
(`python -m pip install -r requirements-dev.txt`, or `py -m pip ...` on
Windows); CI and the deploy install both with `actions/setup-python` before
`verify`. It picks the first of `python3`, `python` and `py -3` whose
`--version` reports Python 3.11 or later, which skips the Windows Store stub,
and fails with those install instructions when there's no Python or no pytest.
It pins pytest to the root `pytest.ini` (`-c`, so no other config file is
read), sets `PYTHONSAFEPATH=1` so no root module can shadow one pytest
imports, and drops `PYTEST_ADDOPTS` and `PYTEST_PLUGINS` (docs/dsa.md).
It runs with bytecode and pytest's cache off, so it leaves no `__pycache__` or
`.pytest_cache` behind. `test:run` needs the same Python and pytest, since
`scripts/python-wiring.test.mjs` runs the real runner on scratch copies of the
tree (one with a planted failing test). The TypeScript half of each entry's
code is tested by vitest, in `test:run`, and `src/dsa/dsa-code-chunks.test.ts`
checks that the code an entry shows is exactly its tested code files and that
each code folder holds only its four files.

`npm run check:test-lock` and `npm run review:diff` are not part of `verify`
or CI: `/feature` uses them inside a run (`-- --snapshot`, then
`-- --verify`, then `-- --clear`). `review:diff` prints the reviewer's diff,
including new untracked files. `check:test-lock` proves none of these changed
after Stage 2 (a config part the snapshot lacks counts as `added`):

- every test file, vitest or pytest, including `conftest.py` and pytest's
  config files (`.pytest.ini` and `.pytest.toml` among them);
- the test runners' config: the `test` block of `vite.config.ts`, the `test*`
  scripts, `scripts/test-python.mjs`, and any root `pytest.py`, `_pytest.py`,
  `pytest/` or `_pytest/` path (a second layer behind the runner's own `-c`
  and `PYTHONSAFEPATH` pinning);
- the gate itself: the `check:test-lock` script string, each whole
  `&&`-separated `verify` step that starts with `npm run test` (in order,
  arguments included), the order of every other shell operator in `verify`
  (`||`, `;`, `&`, `|`, newline), every other `&&` step that isn't a bare
  `npm run <name>` with no arguments (an `exit 0` or `exec` step; adding or
  removing a plain check step stays free), and `scripts/check-test-lock.mjs` with the `scripts/lib.mjs` it imports;
- every ignore rule, because the lock lists files through git and a path added
  to one would otherwise drop out unseen: every `.gitignore` in any letter
  case (including one that ignores itself), `.git/info/exclude`, a
  `core.excludesFile`'s configured value and the contents of the file it
  names wherever it lives, and, while that is unset, every location git's
  default global ignore file could resolve to (`$XDG_CONFIG_HOME/git/ignore`,
  and `.config/git/ignore` under `HOME`, `USERPROFILE`,
  `HOMEDRIVE`+`HOMEPATH` and the OS home; only those that exist are hashed,
  so a different environment over the same files still matches);
- every nested git repository git lists, untracked (`dir/`) or staged as a
  submodule gitlink (`dir`), since pytest would collect a `conftest.py` inside
  one: a new one is `added: <dir>/`, an existing one is compared by its own
  `git ls-files -co` listing and file contents, and one git can't list (a
  pruned worktree) is `unreadable: <dir>/`. Agent worktrees under
  `.claude/worktrees/` are ignored by `.gitignore`, so they aren't nested repos
  here (vitest excludes them too, and pytest collects only `src/dsa/code`).

The global ignore files are machine files, so editing your own global
gitignore mid-run trips the lock. Known, fail-safe limitation: Claude Code's
runtime appends entries to `~/.config/git/ignore` and `.git/info/exclude`
itself (a permission grant can add one), which also trips `--verify` with
nothing weakened. The lock keeps failing closed rather than ignoring those
entries, because ignoring them would let anyone hide a file by writing one;
surface the failure to the user like any other.

`npx knip --no-progress` is an on-demand dead-code check (unused files,
exports and dependencies), not part of `verify` or CI and not a dependency
(npx fetches it); run it after removing or moving code, and expect no output.
`knip.json` holds its verified false positives: `.claude/hooks/*.js` are entry
points (Claude Code runs them from `.claude/settings.json`, which knip doesn't
read), `src/lib/markdown.d.mts` is used by tsc rather than imported, and
`d2` is an external binary, not an npm package. Why it isn't a CI gate is in
[DEFERRED_PRACTICES.md](DEFERRED_PRACTICES.md).

`npm run check:diagrams` needs no d2: it proves the committed SVGs match their
`.d2` sources and their own recorded bytes (the source and SVG hashes in
`public/diagrams/manifest.json`), that no diagram's recorded width exceeds
960 px (`MAX_WIDTH`, the width that still scales to 0.75 in the ~720 px
column), that the `--color-*` tokens recorded there
under `$tokens` still match `src/index.css` (its one top-level `:root` and one
`.dark` block; `check:contrast` and `check:tokens` read them through the same
`readThemeTokens` in `scripts/css-tokens.mjs`, which fails loudly on a second
block for a theme, a `--color-*` token declared anywhere else, such as under
`@media`, a value other than 3- or 6-digit hex, or an `@theme` color other
than `var(--color-<token>)` naming a token both blocks define)
and keep diagram text at 4.5:1 on every fill, that no `.d2` names a color or imports a file, that every `.d2`
sits at `<case>/<name>.d2` in lowercase kebab-case (the rule `npm run diagrams`
renders by, `SOURCE_PATH`), that no SVG is missing or orphaned and nothing
but `manifest.json` and `<case>/<name>.light.svg`/`.dark.svg` sits under
`public/diagrams/`, that every SVG passes an allowlist built from what d2 v0.9
emits, and that every diagram a case study references exists. References are
found by parsing the case study with the site's own markdown stack
(`diagramReferences` in `src/lib/markdown.mjs`, which also holds the
`isDiagramSrc` rule `MarkdownRenderer` uses and the topic-link and DSA
prerequisite extractors), so inline and reference-style
images count and an example inside code doesn't. The SVG allowlist: only listed
elements (no `<script>`, `<foreignObject>`, `<a>`, `<image>`, animation
elements, ...) and listed attributes, no event handlers, no comments, DOCTYPE
or processing instructions, and an XML declaration only in the exact form
`<?xml version="1.0"`, then optionally `encoding="utf-8"`, then optionally
`standalone="yes|no"`, single-spaced, then `?>`; attribute values with no backslash, quote or
character reference, `href`s only to `#fragment`s, and no function but
`url(#fragment)` (plus numeric transform functions in `transform`); `style`
attributes limited to a few numeric or keyword properties (`stroke-width`,
`font-size`, `text-anchor`, ...) with plain values; and in `<style>`, besides
rules with plain values and `font-family: "<name>"`, only `@font-face` blocks
whose one source is an embedded base64 `data:` font. Any other at-rule, quoted
string, function (`url()`, `image-set()`, ...) or CSS escape fails, so the
SVG, opened full size as a document, can't run script or fetch anything. The manifest format and the shared contrast and
safety code live in `scripts/diagram-manifest.mjs`. `npm run diagrams` is the one command that needs d2 (v0.9.x on PATH:
`scoop install d2`, `brew install d2`, or the install script at d2lang.com);
run it after adding or editing a `.d2` file and commit what it writes. It is
not part of `verify`, and CI never runs it.

`npm run dev` for manual checking: click through the home page, a section,
and a topic; open the System Design tab and a case study, follow a Contents
link and open a diagram full size, and check that a topic the case study links
(e.g. `/systems-and-infrastructure/caching`) shows its "Used in these case
studies:" back-link; toggle the theme and check the diagrams switch with it;
open the DSA tab and an entry, switch a code block to TypeScript and reload
(every block should stay on TypeScript); open search (`Ctrl`/`Cmd`+K) and
confirm a topic, a case study and a DSA entry are each findable by title and
by a body phrase.

`npm run size` checks the built JS chunks against the budgets in
`package.json`'s `size-limit` field — a change that pulls in a heavy new
dependency should fail this rather than silently regressing page-load
size. If a change legitimately needs more room, raise the specific
chunk's limit deliberately rather than letting it drift unnoticed. The limits
live in `package.json`, and the commit history records each raise with its
measured numbers.

The main chunk used to carry every topic body (search indexed them at load), so
each new topic grew it: its limit was raised three times for content alone, up
to 183 KB (179 KB brotlied). Loading bodies on demand is done: the main chunk
is now well under its 104 KB limit (`npm run size` prints the current
figure) (it was 100 KB until the eager
System Design question pages were replaced by lazily loaded case studies), and
each topic, case-study and DSA entry body is its own chunk. Adding content no longer
touches it; a case study's topic links reach it as a small build-time list (the
`?links` query), not as text. What still grows it is app code.
`npm run check:bundle` guards the split itself: after a build it fails if a
topic's, case study's or DSA entry's body text is in the main chunk, or in no
chunk at all. The markdown chunk's entry points at `MarkdownRenderer-*.js`
because `TopicPage`, `CaseStudyPage` and `DsaEntryPage` share it; the DSA code
tabs (`CodeTabs`) and the pages' shared header and prev/next nav are in it too.
Rollup would name that shared chunk after whichever of its modules runs last,
so `vite.config.ts` (`chunkFileNames`) names it after `MarkdownRenderer`.
