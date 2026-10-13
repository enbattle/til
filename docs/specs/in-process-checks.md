# Spec: check scripts in-process, slimmer guards

Status: approved 2026-10-12.

Saved on approval as `docs/specs/in-process-checks.md`. Branch `chore/in-process-checks`, cut from `chore/quick-wins` (#117), which also touches `.gitignore` and `scripts/check-pipeline-log.mjs`.

## Context

A redundancy audit (this session) found that most of the repo's tooling weight is in guard scripts and their tests.

- **Test files split for wall time.** The check scripts do all their work at module top level and end in `process.exit`. Their tests therefore copy the script into a temp git repo and spawn `node` once per case (`src/test/guard-helpers.mjs` `run`/`copyScripts`/`testLockRepo`/`diagramRepo`). The scripts suite takes ~57 s of wall time. Several files were split only to spread that load: `check-diagrams.planted-1/-2/.references`, `check-test-lock.nested/.python/.gate`, and the `*.cli.test.mjs` files.
- **Guards sized for an adversarial agent.** Three guards defend against an agent deliberately evading them, which this single-maintainer repo doesn't face.
  - `check-test-lock` is 434 lines plus 836 lines of tests. It fired 3 times, always on its own widening (pipeline-log rows 82–84). Its global-gitignore layer is also tripped by Claude Code's own writes.
  - The PowerShell hook is 550 lines plus 604 lines of tests. It cost 34 agents across two runs, still lists ~20 gaps, and `text-encoding.test.ts` is the real gate.
  - `check-raw-html` is an `oxc-parser` AST walker: 308 lines plus 632 lines of tests, guarding a rule with exactly one allowed use (`CodeBlock.tsx`).
- **Config-text assertions.** `python-wiring.test.mjs` asserts config text that fails loudly elsewhere anyway.

The user reviewed each guard change for quality impact and approved them. That includes amending `docs/NON_NEGOTIABLES.md` #6's wording; #9 keeps its meaning. The user also approved amending `/feature` Stage 1's "guard over source code matches an AST" bullet, which the new raw-HTML check no longer follows.

Intended outcome:

- Every guard's logic is callable in-process.
- One test file per script.
- ~3,000 fewer lines.
- A faster `test:run`.
- No loss of any check that has caught a real defect.

## Design

**CLI pattern** (already used by `scripts/check-eval-premises.mjs:124,158` and `scripts/inbound-links.mjs`):

- Each script exports a function that takes the root as an argument (default `ROOT` from `scripts/lib.mjs`) and returns its problems as strings.
- A main guard (`process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`) prints and exits.
- Add `isMain(importMetaUrl)` to `scripts/lib.mjs` and use it everywhere.
- No `CHECK_*_ROOT` / `INBOUND_LINKS_ROOT` environment variables and no argv root paths remain.

**Exports:**

| Script                                     | Exported function                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `check-diagrams.mjs`                       | `diagramProblems(root)`                                                                          |
| `check-raw-html.mjs`                       | `rawHtmlProblems(root)`                                                                          |
| `check-pipeline-log.mjs`                   | `pipelineLogProblems(text)` (pure, on the file text)                                             |
| `check-eval-premises.mjs`                  | `checkEvalPremises(root)` (env var removed)                                                      |
| `inbound-links.mjs`                        | CLI root from the repo only                                                                      |
| `check-bundle.mjs`                         | `bundleProblems(root)`                                                                           |
| `check-hex-colors.mjs`                     | `hexColorProblems(root)`                                                                         |
| `check-test-lock.mjs`                      | `snapshotLock(root, fixtures)`, `verifyLock(root)` (returns the change lines), `clearLock(root)` |
| `.claude/hooks/block-powershell-writes.js` | `denyReason(command)` → string or null                                                           |

`check-test-lock` keeps the snapshot inside the git dir.

**check-test-lock, slim.**

Locks:

- `TEST_FILE`, snapshots, `vitest.config|workspace.*`
- everything under `src/test/`
- the `test` block of `vite.config.ts`
- the `test*` scripts and the `check:test-lock` script string
- **the whole `verify` string** (one hash, replacing the step/operator parsing)
- every `.gitignore` (lowercase name, any depth, including one that ignores itself)
- `.git/info/exclude`
- pytest test/`conftest.py` files and pytest config files
- `scripts/test-python.mjs`, the lock script and `scripts/lib.mjs`
- fixture paths given to `--snapshot`

Dropped:

- global-ignore candidates (HOME/USERPROFILE/HOMEDRIVE/XDG/homedir)
- `core.excludesFile`
- nested-repo/worktree locking (`isRepoDir`, `nestedRepoHash`, `unreadable`)
- case-insensitive `.gitignore`
- `PYTEST_SHADOW`

Consequence, documented: adding any step to `verify` mid-run trips the lock, so a new `verify` step belongs to the Stage 2 test-writer. Stage 2's instruction already allows it.

**PowerShell hook, blunt.** About 50 lines.

- **Reads:** stdin JSON. Non-PowerShell tool calls and any error → allow (exit 0, no output).
- **Denies a command whose text, after removing quoted string contents:**
  - names `Set-Content`, `Add-Content`, `Out-File` or `Tee-Object` (any case), or the aliases `sc`, `ac`, `tee` as a command word
  - calls `[IO.File]::`/`[System.IO.File]::` `Write*`/`Append*`
  - has a `>`/`>>`/`n>`/`*>` redirection whose target isn't `$null`. `2>&1`-style stream merges are fine.
- **Separately denies**, on the full text: `node` with `-e`/`--eval`/`-p`/`--print`, or `python`/`py`/`python3` with a `-c` flag (including combined flags like `-Ic`), whose text contains `writeFileSync`, `writeFile`, `appendFile`, `createWriteStream`, `open(` with `'w'`/`'a'`, `write_text` or `write_bytes`.
- **No path or variable resolution.** A write to the scratchpad is denied too.
- **Deny message:** names the reason (5.1 re-encoding / native-argument truncation) and points to the Write/Edit tools or the Bash tool.
- `.claude/settings.json` wiring is unchanged.

**check-raw-html, simple.**

- `rawHtmlProblems(root)` flags `rehype-raw`/`rehype-dom-raw` in `dependencies`/`devDependencies`.
- It scans non-test `.js/.jsx/.mjs/.ts/.tsx` files under `src/` (current scope) for a case-insensitive substring match of any sink name: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `srcdoc`, `insertAdjacentHTML`, `setHTMLUnsafe`, `parseHTMLUnsafe`, `createContextualFragment`, `document.write`.
- `dangerouslySetInnerHTML` is allowed only in `src/components/CodeBlock.tsx`.
- A name in a comment or string counts. This fails closed, by design.
- `.oxlintrc.json` turns on `react/no-danger` as an error. `CodeBlock.tsx` gets one `// oxlint-disable-next-line react/no-danger` with its reason (Shiki's escaped output).
- Remove the `oxc-parser` devDependency and the test's NON_NEGOTIABLES #6 `SPAN_TABLE` coupling.

**python-wiring.test.mjs.**

- Keep:
  - `verify` runs `test:py` right after `test:run`
  - `test:py` runs `scripts/test-python.mjs`
  - the runner passes on a clean scratch tree and fails with a planted failing test
  - it leaves no `__pycache__`/`.pytest_cache`
  - the no-Python install message and the 3.11+ requirement
- Drop:
  - the requirements pin text, pytest.ini text, workflow step-order/SHA and dependabot pip assertions
  - the import-shadowing vectors
- `scripts/test-python.mjs` keeps `-c pytest.ini`, `PYTHONSAFEPATH=1` and its env scrub.

## Acceptance criteria

Each criterion is proven by the Stage 2 tests unless marked "orchestrator" or "reviewer".

1. Each exported function in the table returns `[]` on the real repo and a problem naming the file for a planted violation, called in-process (no `node` child process). Every current planted case of `check-diagrams`, `check-eval-premises`, `check-pipeline-log`, `check-bundle` and `check-hex-colors` survives as an in-process case.
2. Each CLI keeps exactly one spawn test: it exits 0 with its success message on the real repo. For `check-test-lock`, an unknown mode exits 2 with the usage line; it must not touch the real snapshot.
3. No file under `scripts/` or `src/test/` reads `CHECK_*_ROOT` or `INBOUND_LINKS_ROOT`. Orchestrator: `git grep`.
4. One test file per script. The split files merge into their base files:
   - `check-diagrams.{planted-1,planted-2,references}.test.mjs` → `check-diagrams.test.mjs`
   - `check-test-lock.{nested,python,gate}.test.mjs` → `check-test-lock.test.mjs`
   - `check-eval-premises.cli.test.mjs` and `inbound-links.cli.test.mjs` → their base files

   `guard-helpers.mjs` drops `run`, `copyScripts` and the spawn-based fixtures.

5. Test lock:
   - `verifyLock` reports `modified`/`added`/`deleted` for a test file, a `src/test/` file, a snapshot, a `vitest.config.ts`, the vite `test` block, a `test*` script, the `check:test-lock` script, **any edit to `verify`** (including appending a step such as `&& npm run check:colors`), a `.gitignore` at the root and nested, `.git/info/exclude`, a `conftest.py`, a `test_x.py`, a `pytest.ini`/`pyproject.toml`, `scripts/test-python.mjs`, `scripts/check-test-lock.mjs`, `scripts/lib.mjs`, and a fixture path given at snapshot.
   - It reports nothing for an edit to an app file or to a non-test part of `vite.config.ts`/`package.json`.
   - A missing snapshot is an error. A non-file fixture argument is rejected.
   - A config part absent from the snapshot is `added`.
   - It does not read `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME` or `core.excludesFile`. Test: changing those environment variables or that config between snapshot and verify reports nothing.
6. Hook (`denyReason`):
   - **Denies:**
     - `Set-Content a.txt x`, `x | Out-File a.md`, `ac f y`, `"x" | tee f`, `echo x > f.txt`, `echo x >> f`, `dir 2> err.txt`
     - `[IO.File]::WriteAllText('a', 'b')`
     - `node -e "require('fs').writeFileSync('a', process.argv[1])" $t`
     - `python -c "open('a','w').write('x')"`
     - `py -Ic "..."` with `write_text`
   - **Allows:**
     - `Get-Content a.md`, `git status`, `npm run verify`
     - `Write-Output "a > b"`, `Select-String 'Set-Content' file` (inside quotes)
     - `cmd 2>$null`, `x > $null`, `x *> $null`, `x 2>&1 | Select-Object -First 5`, `x | Out-Null`
     - `node -e "console.log(1)"`, `node scripts/x.mjs`
   - **Tool calls:** a Bash tool call is allowed. Malformed JSON → allow.
   - One spawn test runs the hook file with PreToolUse JSON and gets the deny JSON. The hook source is under 120 lines including comments (raised to 160 in review round 1; see As built).
7. Raw HTML:
   - Each sink name, in any letter case, in a non-test app file fails, naming the file.
   - `dangerouslySetInnerHTML` in `CodeBlock.tsx` passes, while `innerHTML` in `CodeBlock.tsx` fails.
   - A test file is ignored.
   - `rehype-raw` or `rehype-dom-raw` in either dependency field fails.
   - `npx oxlint` with the repo config errors on a JSX `dangerouslySetInnerHTML` in a temp `.tsx` outside `CodeBlock.tsx`.
   - `oxc-parser` is not in `package.json`.
8. Python wiring: the keep list above holds, the drop list is gone, and `test-python.mjs` behavior is unchanged.
9. Speed (orchestrator, measured, reported in the handoff rather than tested): `npx vitest run scripts src/test` is reported against the 57 s baseline. Target: under 25 s.
10. Docs (reviewer):
    - `docs/verification.md`'s lock list and `check:raw-html`/hook/python sections match the new behavior.
    - `docs/NON_NEGOTIABLES.md` #6 names `check:raw-html` plus the `react/no-danger` lint rule. #9 still reads true.
    - `.claude/skills/feature/SKILL.md` Stage 1's guard bullet becomes: a guard over source code matches parsed syntax or a plain name the sink can't be reached without, never a regex over how the code is spelled. It drops the pointer to `check-raw-html.mjs`'s route list.
    - `docs/dsa.md:182` and `docs/DEFERRED_PRACTICES.md:42` are updated where they describe removed behavior.

## Scope

- **In:**
  - `scripts/check-*.mjs`, `scripts/inbound-links.mjs`, `scripts/lib.mjs`
  - their tests, `src/test/guard-helpers.mjs`
  - `.claude/hooks/block-powershell-writes.js` and its test
  - `.oxlintrc.json`, `src/components/CodeBlock.tsx` (one disable comment)
  - `package.json`/`package-lock.json` (drop `oxc-parser`)
  - the docs named in criterion 10
- **Out:**
  - `check-pipeline-log`'s rules (only made in-process)
  - `check-claude-md`, `check-contrast`, `check-design-tokens`, `check-npm-script-refs` (their tests don't spawn)
  - `render-diagrams.mjs`
  - CI workflows
  - any app behavior

No UI surface, so Stage 4 does no browser check.

## Roles and locked files

- **Stage 2 test-writer** writes all tests. These scripts are locked by `check-test-lock` today, so the spec assigns them to the test-writer:
  - `scripts/check-test-lock.mjs`, `scripts/lib.mjs`, `scripts/test-python.mjs`
  - `src/test/guard-helpers.mjs`
  - `vite.config.ts`'s test block if needed

  The test-writer writes the test-lock tests first, shows them red, then rewrites the script.

- **Stage 3 implementer** does every other script, the hook, `.oxlintrc.json`, `CodeBlock.tsx`, `package.json`, and the docs.
- **Lock widening:** none expected. The new lock narrows. At Stage 2's gate the snapshot is taken with the new script.

## Evals

Editing a `SKILL.md` and NON_NEGOTIABLES names three evals: `skill-routing-eval`, `content-review-eval` and `feature-review-eval`. Also re-read `evals/feature-review/scenarios.md:108` for the `check:raw-html` premise.

The evals are batched with the upcoming docs-dedupe change, which edits the same files, as proposed for #117. They are listed in the handoff as pending.

## Verification

- **Stage 2 gate:** red tests for missing exports and missing behavior, and green where unchanged.
- **Stage 3/5 gate:** `npm run check:test-lock -- --verify` and `npm run verify`.
- **Orchestrator checks:**
  - plant a regression in a scratch copy for the raw-HTML check (an `innerHTML` in an app file) and for the hook (pipe a `Set-Content` PreToolUse JSON), and confirm each fails
  - `git grep -n "CHECK_.*_ROOT\|INBOUND_LINKS_ROOT"` is empty
  - measure `npx vitest run scripts src/test` against the 57 s baseline
  - `wc -l` of the changed scripts and tests, for the handoff

## Clarifications (Stage 2)

- Criterion 3 covers the scripts in scope. `check-claude-md.mjs` is out of scope and keeps `CHECK_CLAUDE_MD_ROOT`; `scripts/checks.test.mjs` keeps its spawns of the out-of-scope `check-contrast` and `check-design-tokens`.
- `check-bundle`'s real-repo and spawn tests are skipped when `dist/assets` doesn't exist (`verify` runs the tests before the build).
- The hook's single spawn test makes three runs (PowerShell denied, Bash allowed, malformed JSON allowed), since `denyReason` can't reach the last two.

## As built

- Criterion 5's example step is `&& npm run check:colors`, not `check:x`: `check:npm-refs` rejects a doc naming an npm script that doesn't exist (edited by the implementer).
- `check:raw-html` cuts the allowed `dangerouslySetInnerHTML` out of `CodeBlock.tsx` before scanning it, since the name contains `innerHTML`; any other sink name there still fails.
- The hook imports `isMain` from `scripts/lib.mjs`; the deny path was confirmed with the project path spelled five ways (`C:/`, `c:/`, `/c/`, backslashes, lowercase).
- `bundleProblems` returns a "dist/assets does not exist" problem instead of exiting, and skips body folders that don't exist.
- Measured: `npx vitest run scripts src/test` 23.3 s (57 s before). `check-raw-html.mjs` 75 lines (308), the hook 127 lines after fix round 1 (550); the line-count test allows up to 160, raised from 120 in round 1 for the known-gaps header, `check-test-lock.mjs` 225 lines (434).

- Beyond the spec, from review round 1: `check:raw-html` also flags the whole word `write`/`writeln` (case-sensitive) and `parseFromString`, flags `hast-util-raw`, `markdown-to-jsx` and `html-react-parser`, scans `.mts`/`.cts`/`.cjs`, and skips `src/dsa/code/` and `src/test/`, which never ship to the browser. The `write` word fails closed on comments such as "write the value back" and on `navigator.clipboard.write`; `src/types.ts`'s "write-up" became "entry".

## Review decisions

- Known limitation: the PowerShell hook still allows `node --input-type=module -e …`, an assignment (`$r = node -e …`), `python -X utf8 -c …`/`python3.12 -c …` and `fs.openSync` + `writeSync`. These were gaps in the old hook too; its header lists them, and `text-encoding.test.ts` catches the encoding damage (not truncation).
- Known limitation: `inbound-links`' argument checks (no argument, unknown topic, wrong form or case, `..`) lost their tests with the CLI test file; behavior is unchanged and it is a tool, not a gate (criterion 2 allows one spawn test).
- Stage 5 list (already there): npm's `pretest:run`/`posttest:run` lifecycle scripts aren't locked by `check:test-lock`.
- Known limitation: `check:raw-html` doesn't know `document.execCommand('insertHTML', …)` or HTML handed to an iframe as a `data:text/html` or Blob URL; the old check didn't either, and no doc claims them.
- Known limitation: the hook still allows `Start-Process -RedirectStandardOutput`, `Export-Csv`, `New-Item -Value`, `Invoke-Expression "Set-Content …"`, `py -3.12 -c`, `python -W ignore -c` and `open(str(p), 'w')` (the old hook did too), and denies a nested `"` inside `$( )` (as the old hook did).
- Stage 5 list (already there): `python-wiring.test.mjs`'s `beforeAll` runs pytest under vitest's default 10 s hook timeout and times out on a loaded machine; `check-bundle`'s real-repo and spawn tests are skipped wherever `dist/` is missing, which includes CI.
- Fixed after Stage 5, at the user's request (test first, then the fix): the hook's quote stripping now removes `#` and `<# … #>` comments in the same pass, so a write after a comment holding an apostrophe (`# don't touch`, then `Set-Content out.md 'x'`) is denied again, as the old hook did. The two doc follow-ups in the next-but-one entry are fixed in the same change.
- Known limitation, after the cap: the hook also allows `open('a', mode='w')`, `New-Object System.IO.StreamWriter(...)`, `[IO.File]::OpenWrite(...)` and `$r = Set-Content ...`.
- Known limitation, after the cap: `check:raw-html` decodes `\u` and `\x` escapes but not JavaScript identity escapes (`'inner\HTML'`) or a backslash line continuation inside a string; both are evasion-shaped. Follow-up doc fixes: `/feature` Stage 1's "escapes decoded" should name the `\u`/`\x` escapes, and `docs/verification.md:45` and the script header lost their escaped example (`innerHTML`).
