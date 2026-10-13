# Verifying a change

What each check proves and how to run it. [CLAUDE.md](../CLAUDE.md) has the
one command that matters; read this when a check fails, when you add or change
a check, or when a size budget moves.

`npm run verify` is exactly what CI runs (`ci.yml` calls it), and
is the final gate of every skill that changes the repo (the eval and audit
skills run only the checks they name). The deploy workflow runs it too, so a
commit that fails any check never goes live. The chain itself, in order, is
the `verify` script in `package.json`; each step runs on its own as
`npm run <name>`.

`npm run lint` runs oxlint with `--deny-warnings`, so a warning fails it like an
error: a warning that prints on every run stops being read. Fix it, or silence
one line with an `oxlint-disable-next-line` comment that says why.

`npm run check:claude-md` fails if `CLAUDE.md` passes 150 lines or links to a
file that doesn't exist. `CLAUDE.md` is loaded into every session and
subagent on every turn, so it stays a router and detail lives in the docs it
links; raise the limit only deliberately, like a size budget.

The scripts that walk the tree (`check:colors`, `check:npm-refs`,
`check:raw-html`, `check:diagrams`, `check:bundle`, `check:eval-premises`,
`npm run diagrams`, `links:inbound`) list
files with `listFiles` in `scripts/lib.mjs` (`git ls-files -co
--exclude-standard`), so an ignored file is never listed and there's no
per-script skip list; `ROOT` and `escapeRegExp` live there too. Two of them
also read paths they're given rather than listed: `check:eval-premises` reads
each premise's target and runs `git apply --check` against the working tree,
and `links:inbound` checks its topic argument against the working tree, so
those reads don't go through the ignore rules.
`check:colors` scans `.ts`, `.tsx`, `.mjs` and `.css`; `.mjs` counts because
`src/lib/markdown.mjs` ships to the browser.
`check:raw-html` proves no shipped source file under `src/` names an HTML sink
(`dangerouslySetInnerHTML` only in `src/components/CodeBlock.tsx`) and no
raw-HTML markdown package is a dependency. It matches names, comments and
strings included, so reword a comment that names one; what it scans, the sink
list and what gets past it are in `scripts/check-raw-html.mjs`'s header.
It decodes escapes first, so `\u0069nnerHTML` fails too.
`scripts/check-pipeline-log.test.mjs` reads `docs/pipeline-log.md`'s header.

Each check script named here exports its logic as a function that takes the root it
checks (default: the repository, `ROOT`) and returns its problems as strings
(`diagramProblems`, `rawHtmlProblems`, `bundleProblems`, `hexColorProblems`,
`checkEvalPremises`; `pipelineLogProblems` takes the log's text), and runs its
command-line part only under `if (isMain(import.meta.url))` (`scripts/lib.mjs`).
Its tests call the function in-process on throwaway fixtures
(`src/test/guard-helpers.mjs`), with one spawned run of the script on the real
repository. A new check follows the same shape, with one test file per script;
no environment variable or argument points one of these at another root.
Older checks keep their spawned tests: `check:claude-md` (pointed at a
planted root through `CHECK_CLAUDE_MD_ROOT`), `check:contrast` and
`check:tokens`. `check:npm-refs` has no test of its own.

`check:tokens` proves `docs/DESIGN.md`'s token table matches the `--color-*`
tokens in `src/index.css`, in both directions and by value; `check:contrast`
proves text clears WCAG AA (4.5:1) on the surfaces it sits on, in both themes;
`check:npm-refs` proves every `npm run <name>` a markdown file names is a
script in `package.json`; `check:pipeline-log` proves every row of
`docs/pipeline-log.md` has its header's eight columns in their format and
follows the retro rules listed in `scripts/check-pipeline-log.mjs`'s header.

`src/lib/text-encoding.test.ts` (part of `test:run`) fails on any tracked text
file holding double-encoded UTF-8 (a UTF-8 file read as Windows-1252 and
written back, as Windows PowerShell 5.1's `Get-Content`/`Set-Content` do) or
U+FFFD; its header says what it scans. A topic that needs to show mojibake as
an example would need an exemption there. It stays the real gate;
`.claude/hooks/block-powershell-writes.js` only saves the redo, denying a
PowerShell command or inline script that writes a file (what it matches and
its known gaps are in its header; `scripts/block-powershell-writes.test.mjs`
holds its vectors).

`npm run check:eval-premises` proves the eval scenarios still rest on true
facts: every premise comment holds and every feature-review `diff` still
applies ([evals/README.md](../evals/README.md#running-any-eval); details in
`scripts/check-eval-premises.mjs`'s header).

`npm run links:inbound -- <section>/<slug>` is a tool, not a check: it lists
every link to a topic from topics, case studies and DSA entries (old paths in
`REDIRECTS` included), with the anchor and the sentence around each.
`add-topic`'s rewrite mode runs it before drafting.

`npm run test:py` (`scripts/test-python.mjs`) runs pytest over the DSA
entries' Python code in `src/dsa/code`, and fails with install instructions
when there's no suitable Python or no pytest. [docs/dsa.md](dsa.md) has how it
finds Python, what to install and how it pins pytest's config and import
path; CI and the deploy install both with `actions/setup-python` before
`verify`. It runs with bytecode and pytest's cache off, so it leaves no `__pycache__` or
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
  config files (`.pytest.ini` and `.pytest.toml` among them), everything under
  `src/test/` (the shared setup, render and guard-test helpers) and every vitest snapshot
  (`__snapshots__/*.snap`);
- the test runners' config: any `vitest.config.*` or `vitest.workspace.*`
  file, the `test` block of `vite.config.ts`, the `test*` scripts, the
  `pre`/`post` scripts npm runs around them and around `verify` (`pretest:run`,
  `preverify`), and `scripts/test-python.mjs`;
- the gate itself: the `check:test-lock` script string, the whole `verify`
  script string (one hash, so any edit to it, including a new check step,
  trips the lock; a new `verify` step belongs to the Stage 2 test-writer), and
  `scripts/check-test-lock.mjs` with the `scripts/lib.mjs` it imports;
- every ignore rule in the repository, because the lock lists files through
  git and a path added to one would otherwise drop out unseen: every
  `.gitignore` at any depth (including one that ignores itself) and
  `.git/info/exclude`;
- the fixture paths given to `--snapshot`.

The lock guards against a stage's slip, not a deliberate evasion: it doesn't
read global ignore files or `core.excludesFile`, and it doesn't look inside
nested git repositories. Agent worktrees under `.claude/worktrees/` are
ignored by `.gitignore` (vitest excludes them too, and pytest collects only
`src/dsa/code`). Claude Code's runtime can append entries to
`.git/info/exclude` itself (a permission grant can add one), which trips
`--verify` with nothing weakened; surface that failure to the user like any
other.

`npx knip --no-progress` is an on-demand dead-code check (unused files,
exports and dependencies), not part of `verify` or CI and not a dependency
(npx fetches it); run it after removing or moving code, and expect no output.
`knip.json` holds its verified false positives: `.claude/hooks/*.js` are entry
points (Claude Code runs them from `.claude/settings.json`, which knip doesn't
read), `src/lib/markdown.d.mts` and `src/lib/code-regions.d.mts` are used by tsc
rather than imported, and
`d2` is an external binary, not an npm package. Why it isn't a CI gate is in
[DEFERRED_PRACTICES.md](DEFERRED_PRACTICES.md).

`npm run check:diagrams` needs no d2: it proves the committed SVGs and
`public/diagrams/manifest.json` still match their `.d2` sources and the
`--color-*` tokens, that diagrams stay within `MAX_WIDTH` (why, in
[case-studies.md](case-studies.md)) and keep text at 4.5:1, that no `.d2`
names a color or imports a file, that every file sits where the naming rule
puts it, that every SVG passes a safety allowlist, and that every diagram a
case study references exists. The full list is in `scripts/check-diagrams.mjs`'s
header; the allowlist (`svgProblems`) and the manifest format are in
`scripts/diagram-manifest.mjs`, and the token reader all three token checks
share, with the shapes it rejects, is `readThemeTokens` in
`scripts/css-tokens.mjs`. References are found with the site's own markdown
stack (`diagramReferences` in `src/lib/markdown.mjs`), so an example inside
code doesn't count. `npm run diagrams` is the one command that needs d2 (v0.9.x on PATH:
`scoop install d2`, `brew install d2`, or the install script at d2lang.com);
run it after adding or editing a `.d2` file and commit what it writes. It is
not part of `verify`, and CI never runs it.

`npm run dev` for manual checking: click through the home page, a section,
and a topic; open the System Design tab and a case study, follow an "On this
page" link and open a diagram full size, and check that a topic the case study links
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

The main chunk carries no content bodies: each topic, case-study and DSA entry body is
its own chunk, loaded on demand, and `npm run size` prints the main chunk's
current size against its limit. Adding content barely touches it: what reaches
it is small build-time data, not text: a case study's topic links (the
`?links` query), a DSA entry's prerequisite list (`?dsaPrereqs`), and one word
count per topic, case study and DSA entry (`?words`, for the "N min read"
label).
What still grows it is app code.
`npm run check:bundle` guards the split itself: after a build it fails if a
topic's, case study's or DSA entry's body text is in the main chunk, or in no
chunk at all. The markdown chunk's entry points at `MarkdownRenderer-*.js`
because `TopicPage`, `CaseStudyPage` and `DsaEntryPage` share it; the DSA code
tabs (`CodeTabs`) and the pages' shared header and prev/next nav are in it too.
Rollup would name that shared chunk after whichever of its modules runs last,
so `vite.config.ts` (`chunkFileNames`) names it after `MarkdownRenderer`.
