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
`check:raw-html` scans `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`
and `.cts` under `src/` (minus tests, `src/dsa/code/` and `src/test/`, which
never ship to the browser), and `check:colors` scans `.ts`, `.tsx`, `.mjs`
and `.css`; `.mjs` counts because `src/lib/markdown.mjs` ships to the browser.
`check:raw-html` matches names, not syntax: it fails on any HTML sink name in
its `SINKS` list (`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`,
`srcdoc`, `insertAdjacentHTML`, `setHTMLUnsafe`, `parseHTMLUnsafe`,
`createContextualFragment`, `parseFromString`, `document.write`) as a
case-insensitive substring, or on the whole word `write` or `writeln`
(case-sensitive, so `document.write` is caught however the document is
reached), anywhere in a scanned file, comments and strings included, so it
fails closed; reword a comment that names one. It decodes the escape
sequences `\uXXXX`, `\u{…}` and `\xXX` first, so `\u0069nnerHTML` fails too. `dangerouslySetInnerHTML` is
allowed only in `src/components/CodeBlock.tsx`. It also fails on
`rehype-raw`, `rehype-dom-raw`, `hast-util-raw`, `markdown-to-jsx` or
`html-react-parser` in `package.json`. A name built at run time (`'inner' +
'HTML'`, `document['wr' + 'ite']`) gets past it, and so does one spelled with
another escape (an identity escape such as `'inner\HTML'`, or a backslash line
continuation inside a string); review covers those. oxlint's `react/no-danger` rule
(an error in `.oxlintrc.json`) also flags the JSX prop, and `CodeBlock.tsx`
disables it on its one line, with the reason.
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
`docs/pipeline-log.md` has its header's eight columns in their format, and that
a run with gate failures or findings doesn't close with a bare "nothing to
change" retro. For rows dated after `KINDS_AND_ROUNDS_ALLOWED_UNTIL` (in
`scripts/check-pipeline-log.mjs`) it also fails a content row
(`add-topic`, `add-case-study`, `add-dsa-entry`) with findings whose Retro
doesn't name them as `kinds: a, b` from the script's `KINDS` list, and any row
with a fix round but no gate failure, finding or `pre:N` to cause it.

`src/lib/text-encoding.test.ts` (part of `test:run`) fails on any tracked text
file holding double-encoded UTF-8. That happens when a UTF-8 file is read as
Windows-1252 and written back, as Windows PowerShell 5.1's
`Get-Content`/`Set-Content` do. It also fails on U+FFFD, which is what a file
saved in the ANSI code page decodes to. It scans `git ls-files` output (plus
untracked, unignored files) by extension and skips `public/`. A topic that
needs to show mojibake as an example would need an exemption there. It stays
the real gate; `.claude/hooks/block-powershell-writes.js` only saves the redo.
It is deliberately blunt: with comments and quoted string contents removed, it denies a
PowerShell command that runs `Set-Content`, `Add-Content`, `Out-File` or
`Tee-Object` (or the aliases `sc`, `ac`, `tee`) as a command word (at the
start of a line or after `;`, `|`, `&`, `(` or `{`), calls
`[IO.File]::Write*`/`Append*`, or redirects output (`>`, `>>`, `2>`, `*>`, ...)
to anything but `$null` (`2>&1` is fine). It also denies an inline
`node -e`/`--eval`/`-p`/`--print` or `python`/`py -c` script whose text writes a
file (`writeFileSync`, `open(path, 'w')`, `write_text`, ...), because
native-argument quoting can truncate or alter the text it passes. It resolves
no paths or variables, so a write to the scratchpad is denied too; the deny
message points to the Write or Edit tool, or the Bash tool. It catches slips,
not deliberate evasion. Any other tool, malformed input or an error allows the
command. `scripts/block-powershell-writes.test.mjs` holds its vectors, calling
its exported `denyReason(command)`.

`npm run check:eval-premises` proves the eval scenarios still rest on true
facts: each `<!-- premise: … -->` comment in `evals/*/scenarios.md` holds
(the forms are in
[evals/README.md](../evals/README.md)), no `premise:` comment is malformed, and
every `diff` block in `evals/feature-review/scenarios.md` passes
`git apply --check`. It parses the scenarios with `markdownParser()`, so a
premise shown in a code block isn't checked.

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
  file, the `test` block of `vite.config.ts`, the `test*` scripts and
  `scripts/test-python.mjs`;
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
read), `src/lib/markdown.d.mts` is used by tsc rather than imported, and
`d2` is an external binary, not an npm package. Why it isn't a CI gate is in
[DEFERRED_PRACTICES.md](DEFERRED_PRACTICES.md).

`npm run check:diagrams` needs no d2: it proves the committed SVGs match their
`.d2` sources and their own recorded bytes (the source and SVG hashes in
`public/diagrams/manifest.json`), that no diagram's recorded width exceeds
`MAX_WIDTH` (the limit and why are in [case-studies.md](case-studies.md)), that the `--color-*` tokens recorded there
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
