# Spec: Close the remaining tooling gaps (run A)

Status: approved 2026-10-01. Follows docs/specs/dedupe-app-scripts-tests.md; run B (step 3) covers the harness and docs.

## Context

The reviews of PR #31 (DSA tab) and PR #34 (dedupe) left gaps that were recorded but not fixed. The user asked for everything raised in the reviews, gaps and retros to be fixed. This run covers the tooling and app items; run B (step 3) covers harness and docs: retro edits, content-review eval DSA scenarios, the cosmetic FR hunk labels, shared content-skill stages, reviewer lists, eval file overlap, and the DEFERRED_PRACTICES and README trims.

The gaps:

1. An untracked nested git repo hides its files from `check:test-lock`. `git ls-files -o` lists it as one `dir/` entry, and pytest's `testpaths` would still collect a `conftest.py` inside it.
2. `check-test-lock.mjs` isn't in its own locked set, and neither is `scripts/lib.mjs`, which it imports for listing files. A later implementer could weaken the lock and then pass it.
3. `check:raw-html` and `check:colors` don't scan `.mjs` under `src/`, even though `src/lib/markdown.mjs` ships to the browser (NON_NEGOTIABLES #2 and #6).
4. A global `core.excludesFile` (outside the repo), and git's default global ignore file (`$XDG_CONFIG_HOME/git/ignore`, falling back to `~/.config/git/ignore`), can hide files from the lock. Today only an in-repo excludes file is hashed.
5. At a 360 px content width, the inline code `self._bucket(pair[0]).append(pair)` in `hash-map.md` overflows the page by 2 px. Inline code can't wrap anywhere, so any long code span can do this.

The one recorded limitation that stays: Claude Code's runtime may write its block to `.git/info/exclude` between `--snapshot` and `--verify`. Ignoring that block would let anyone hide files by writing inside it, so the lock keeps failing safe. The spec's Review decisions will say this.

## Scope

**In**

1. **Nested repos.** `check:test-lock` treats every untracked directory entry that `git ls-files -co --exclude-standard` lists, and that contains a `.git`, as locked:
   - a new one after `--snapshot` reports `added: <dir>/` and fails;
   - one present at both times is compared by the hash of its `git ls-files -co` listing plus file contents (its tracked and untracked file hashes).

   Simplest acceptable alternative, if hashing a nested repo's contents is disproportionate: lock its presence only, and say so in the docs.

2. **Self-lock.** `scripts/check-test-lock.mjs` and `scripts/lib.mjs` join the locked set.
   - Only a fresh test-writer can change them after Stage 2, the same as the Python runner.
   - Approved in advance by approving this spec: in this run's Stage 3 gate, `--verify` with the new script will report these two files (and the new config parts in item 4) as `added`, because the Stage 2 snapshot predates them. The orchestrator checks that every locked file is unchanged with the old script, re-takes the snapshot, and records it in As built. Any other lock failure still goes to the user.
3. **`.mjs` scanning.** Add `.mjs` to `check:raw-html`'s and `check:colors`' extension lists. Fix anything they then report in `src/`.
4. **Global ignore files.** `runnerConfig()` hashes the contents of:
   - the effective `core.excludesFile` wherever it lives;
   - when that is unset, git's default global ignore file.

   A missing file records `null`. The current "outside the repo → null" special case goes. Changing either file between `--snapshot` and `--verify` fails safely. Docs say these are machine files, so a user editing their own global gitignore mid-run would also trip it.

5. **Long inline code wraps.** `MarkdownRenderer`'s inline `code` gets `[overflow-wrap:anywhere]` (or the Tailwind equivalent), so a long code span breaks inside the content column. Fenced code blocks are unchanged; they already scroll horizontally.

**Out**

- Run B's harness and docs items.
- Content changes, apart from none: the inline-code fix makes a `hash-map.md` edit unnecessary.

## Acceptance criteria (Stage 2 tests)

1. `check:test-lock` after `--snapshot`:
   - `git init` in a new untracked folder plus a `conftest.py` inside it fails `--verify` and names the folder;
   - an existing nested repo whose files change fails (or, under the presence-only alternative, a documented test shows only presence is locked);
   - a run with no nested repo is unaffected.
2. Self-lock: after `--snapshot`, editing `scripts/check-test-lock.mjs` or `scripts/lib.mjs` fails `--verify`, and both appear among the locked files.
3. `check:raw-html` reports an `innerHTML` assignment in a planted `src/x.mjs`, and `check:colors` reports a hex colour in one. The repo stays clean.
4. Global ignore files:
   - with `core.excludesFile` pointing outside the fixture repo (a temp file), editing that file after `--snapshot` fails `--verify`;
   - with it unset and a fake `XDG_CONFIG_HOME/git/ignore`, editing that file fails;
   - an absent file is stable (`null` both times).
5. Inline code in rendered markdown carries the wrap class; fenced code blocks don't. This uses the real `MarkdownRenderer`.
6. `npm run verify` passes, no size limit is raised, and `npx knip` reports nothing new.

## Non-negotiables check

No conflicts. These are tightenings:

- #2 and #6: `.mjs` is now scanned.
- #9: the lock covers itself and more ignore sources.
- #1: long inline code no longer overflows at narrow widths.
- #3: no raise.

## UI surface

Inline code wrapping. Stage 4's browser check: `/dsa/hash-map` and a topic with long inline code, in a 360 and a 375 px iframe in both themes, confirming no page overflow and readable wrapping.

## Critical files

- `scripts/check-test-lock.mjs`, `scripts/check-raw-html.mjs`, `scripts/check-hex-colors.mjs`
- `src/components/MarkdownRenderer.tsx`
- tests (`scripts/checks.test.mjs`, `src/components/MarkdownRenderer.test.tsx`)
- docs: `docs/verification.md` (lock coverage, scanned extensions), the spec

Reuse:

- `listFiles` and `ROOT` from `scripts/lib.mjs`;
- the fixture helpers `ignoreRepo()` and `gitConfig()` in `scripts/checks.test.mjs`;
- the `sha` and `hash` helpers in `check-test-lock.mjs`.

## Pipeline

- **Stage 2:** a fresh test-writer.
  - Gate: only test files changed; criteria 1–5 are red; typecheck, lint and format are clean. Then lock.
- **Stage 3:** a fresh implementer.
  - Gate: `check:test-lock --verify`. The expected `added` entries are pre-approved (item 2). Anything else goes to the user.
  - Then `npm run verify`.
  - Plant a nested repo in a scratch copy and see `--verify` fail.
- **Stage 4:** a fresh reviewer and the browser check, then triage and a 4a fix loop capped at 2 rounds.
- **Stage 5/6:** the gate, the handoff, the retro and the pipeline-log row. Then ask before committing, pushing and merging.

## As built

- **Nested repos:** full content locking. Each untracked `dir/` entry that
  holds a `.git` is a locked key, hashed over its own `git ls-files -co`
  listing (without `--exclude-standard`, so its own ignore rules hide
  nothing) plus each file's content; a repo nested inside it is hashed the
  same way. A planted `git init` with a `conftest.py` made `--verify` exit 1
  with `added: src/dsa/code/sneaky/`.
- **Global ignore:** `core.excludesFile#contents` hashes the file wherever it
  lives; a new part, `default global ignore#contents`, hashes
  `$XDG_CONFIG_HOME/git/ignore` (falling back to `$HOME/.config/git/ignore`)
  while `core.excludesFile` is unset, and is null when it is set.
- **Stage 3 gate, as pre-approved in item 2:** the new script reported
  `added:` for `default global ignore#contents`, `scripts/check-test-lock.mjs`
  and `scripts/lib.mjs` only; HEAD's script reported all 65 previously locked
  parts unchanged; the snapshot was re-taken (68 parts).
- **`check:raw-html`'s** test-file filter now also skips `.test.mjs`/`.cjs`.
  Neither check found anything in `src/` once `.mjs` was scanned.
- **Sizes:** main chunk 94.95 kB, MarkdownRenderer 84.08 kB; no limit raised.
- **For run B:** `.claude/skills/feature/SKILL.md`'s Stage 3 locked-file list
  doesn't name `scripts/test-python.mjs`, the pytest files, the ignore files,
  `scripts/check-test-lock.mjs` or `scripts/lib.mjs`.

### Review fixes (Stage 4a, round 1)

The Stage 4 review found no High or Medium findings; the five Lows were all
confirmed by a triager. The lock-script changes went through a fresh
test-writer, since this run made `scripts/check-test-lock.mjs` a locked file.

- **Claude Code's appends to `~/.config/git/ignore`:** recorded as a known,
  fail-safe limitation in the script header and `docs/verification.md`.
- **A nested repo staged as a submodule gitlink** (listed without a trailing
  slash) is now locked: any listed directory holding a `.git` is a nested
  repo, keyed as `dir/`.
- **A `conftest.py` inside an ignored path:** rejected as a lock change (see
  Review decisions); `docs/dsa.md` now says the folder allowlist covers it
  under `src/dsa/code`.
- **The gate's own command:** `package.json`'s `check:test-lock` script string
  and the ordered `npm run test*` steps inside `verify` are new locked config
  parts; other `verify` steps stay free.
- **Windows home resolution:** while `core.excludesFile` is unset, every
  candidate default global ignore location is hashed together
  (`$XDG_CONFIG_HOME`, `HOME`, `USERPROFILE`, `HOMEDRIVE`+`HOMEPATH`,
  `os.homedir()`).
- **Stale lock lists** in `README.md` and `docs/dsa.md` updated;
  `docs/verification.md`'s coverage paragraph is now a list.
- **Lock gate:** `--verify` reported `modified: scripts/check-test-lock.mjs`,
  `added:` for the two new `package.json` parts, and
  `modified: default global ignore#contents`. The last one comes from the new
  hashing scheme: the file is unchanged since 2025-09-21. The snapshot was
  re-taken (70 parts).

The round-1 test-writer stopped before reporting; the orchestrator fixed one
character it left (a lost backslash in the `verify` test-step regex, so `\S*`
read as a literal `S*`; the reorder test caught it) and ran its gate.

### Review fixes (Stage 4a, round 2)

A fresh re-review of round 1 found one Medium and two Lows; a fresh
test-writer fixed all three.

- **Medium, `verify` weakened around a test step:** arguments on
  `npm run test:run` (`-- --exclude …`) or a `|| true` anywhere kept the locked
  tokens identical. Now each whole `&&` step that starts with `npm run test` is
  locked, arguments included, and so is the order of every other shell
  operator (`||`, `;`, `&`, `|`, newline).
- **Low, env-sensitive global ignore hash:** missing candidates were part of
  the hash, so a different `HOME` with the same files could fail `--verify`.
  Only existing candidates are hashed now, keyed by path.
- **Low, agent worktrees:** `.claude/worktrees/` was ignored only by this
  clone's `.git/info/exclude`. It's now in `.gitignore` (vitest already
  excludes it and pytest collects only `src/dsa/code`). A nested repo the lock
  can't list, such as a worktree whose gitdir was pruned, now fails closed
  with `unreadable: <dir>/` instead of a stack trace.
- **Lock gate:** `--verify` reported only this round's expected changes
  (`.gitignore`, the script, the tests, and the renamed `verify` part); the
  snapshot was re-taken (71 parts).

### Review fixes (Stage 4a, round 3, user-authorized)

- **A plain step that ends the shell before the tests** (`exit 0 && …`) still
  passed. The user approved a third round to close it with an allowlist: a
  new part, `verify non-npm steps`, locks every `&&` step that isn't exactly
  `npm run <name>` with no arguments (test steps excluded, since their own
  part locks them). Today that list is empty, so adding a plain check step
  stays free. `--verify` reported only the script, the tests and the new part;
  the snapshot was re-taken.

## Review decisions

- **Reject:** locking a `conftest.py` in an ignored path outside
  `src/dsa/code`. pytest loads conftest files only from fixed ancestors of the
  code tree, none of them ignored, and ignoring one needs an edit to a locked
  ignore source.
- **Known limitation:** Claude Code's runtime writing to `.git/info/exclude`
  or `~/.config/git/ignore` mid-run fails `--verify`. That fails safe, and
  ignoring those entries would let anyone hide files by writing one.
