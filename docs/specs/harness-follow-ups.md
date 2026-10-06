# Spec: harness follow-ups from the 2026-10-06 docs audit

Approved 2026-10-06.

## Context

The 2026-10-06 docs audit (#83) read 119 pipeline-log rows as a set and made four proposals. It also listed copied facts and a stale comment. The user approved all of them as recommended.

A separate direct PR, `docs/dedupe-canonical-facts`, moves each duplicated fact in the prose docs to one home. It merged first, as #85. It also moves a few rules that only the skills stated into the docs: the case-study requirement details, and the DSA prerequisite phrasing. Separate loops keep their own caps, such as content-review's two rounds. This spec covers the parts that are code, tests, a hook or a /feature process edit:

1. **No record of what each review found.** Batch content rows record only H/M/L counts, so a later audit can't see which kinds of finding recur. It also missed a row that logged a fix round with no findings.
2. **PowerShell writes corrupt text.** Writing repo files from Windows PowerShell 5.1 re-encodes them. `Set-Content`/`Out-File` default to the ANSI code page or UTF-16, and `-Encoding utf8` adds a byte-order mark. This forced redos twice. `src/lib/text-encoding.test.ts` catches the result at verify, but only after the work is done.
3. **The word budget is defined twice.** `WORD_BUDGET = 1150` appears in both structure tests. Separately, README.md's intro copies `package.json`'s `description`, and nothing checks the copy.
4. **Tests lean on published prose.** No snapshot tests remain. A few behavior tests still depend on a phrase or link inside a published page, so a content rewrite breaks them (#71 hit this). One comment, in `MarkdownRenderer.test.tsx`, still uses the retired "At a glance" section as its example.
5. **Work falls between roles.** Four runs had a spec item that no role owned. Most recently, an eval re-run the spec asked for went unassigned.

## Design

**1. A shared word budget.**

- `src/lib/reading-time.ts` exports `WORDS_PER_MINUTE` (230) and `WORD_BUDGET`, defined as five minutes' worth: `5 * WORDS_PER_MINUTE`, which is 1,150.
- Both structure tests import `WORD_BUDGET` instead of defining their own.
- The catalog work later adds its own budget beside it.

**2. `check:pipeline-log` gains two rules.** Both apply only to rows dated after `2026-10-06`, the same cut-off pattern as `PENDING_ALLOWED_UNTIL`, since rows are never rewritten.

- **Content rows record their kinds.**
  - Scope: an `add-topic`, `add-case-study` or `add-dsa-entry` row whose findings (before `, pre`) are not `0/0/0`.
  - Its Retro cell must contain `kinds: a, b`, and every name must come from a fixed list.
  - The fixed list: `jargon`, `tone`, `figurative`, `wrong-claim`, `estimate`, `no-alternative`, `compression`, `code-bug`, `test-gap`, `narration`, `duplication`, `inconsistency`, `structure`.
  - The list lives in the script and in the pipeline-log header's Retro definition. The header names the script as the source.
  - An unknown name fails the check, naming the row and the name.
  - `/feature` rows are exempt, because their Retro is the retro.
- **No fix round without a cause.**
  - A row fails if its Fix rounds is above 0 while its Gate failures is 0, its findings are `0/0/0` and it has no `pre:N`.
  - The message names the row.

**3. A hook that blocks PowerShell writes to repo files.** `.claude/hooks/block-powershell-writes.js` is registered in `.claude/settings.json` on PreToolUse, matcher `PowerShell`.

- **When it denies:** the command writes a file through one of these, and the target path resolves inside the project directory:
  - the cmdlets `Set-Content`, `Add-Content` and `Out-File`;
  - the redirection operators `>`, `>>`, `2>` and `*>` to a path;
  - `[IO.File]::WriteAllText` and the other `[System.IO.File]::Write*`/`Append*` methods.

  The deny reason says to use the Edit or Write tool, or a Node script, and why: PowerShell 5.1's encodings, and the BOM that `-Encoding utf8` adds.

- **What it allows:**
  - writes to paths outside the project, including the scratchpad and `$env:TEMP`;
  - `$null` and `Out-Null`;
  - commands with no write.
- **How it fails:** malformed input or a parse failure allows the command (fails open). `text-encoding.test.ts` stays the real gate. The hook only prevents the wasted redo.
- **Matching is on the command text.** That isn't a full PowerShell parse, so the spec lists the vectors it must deny and allow (below) instead of claiming completeness. Running PowerShell's own parser inside a 10-second hook on every PowerShell call costs more than the redo it saves.

**4. README's intro is checked.** `scripts/site-description.test.mjs` also asserts that README.md's intro paragraph (the first paragraph after the title) equals `package.json`'s `description`. Its comment then stops saying `package.json` is "the one copy" and names README as a checked copy.

**5. Behavior tests don't depend on published prose.**

- **The rule:** a test of loader, search or link behavior may name a real slug that must exist. It must not depend on a phrase, link or heading inside a published page's prose, unless it reads the expectation from that file at test time.
- **Known cases:**
  - `src/lib/search-dsa.test.ts`, "finds binary-search by a body-only phrase…";
  - `src/lib/system-design.test.ts`, the caching-topic and URL-shortener pair (lines ~242 and ~291, whose comment still says "read-path deep dive").
- **Survey:** the test-writer also surveys `src/**/*.test.*`, excluding `src/dsa/code/**` and the two structure tests, and converts any other case it finds.
- **Comment fix:** the stale "At a glance" example in `MarkdownRenderer.test.tsx` becomes a current in-page link example: a case study's prose pointing to one of its own `Decision:` headings.

**6. `/feature` process edits** (`.claude/skills/feature/SKILL.md`, plus docs/SDLC.md if it restates them):

- **Stage 1:** the spec's Scope says which stage or role proves each acceptance criterion. If the change edits a file that `evals/README.md`'s table names, the spec lists those evals.
- **Stage 5:** the orchestrator runs the evals the spec listed, logs them, and includes the result in the handoff, before asking to commit.
- **Wording:** each edit replaces wording, rather than adding a sentence beside it.

## Acceptance criteria

1. **Shared budget.** `WORD_BUDGET` is exported from `src/lib/reading-time.ts` and equals 1,150. Neither structure test defines its own; both import it. A `reading-time` test pins that `WORD_BUDGET === 5 * WORDS_PER_MINUTE`.
2. **Kinds rule.** These fixture logs, run through `check-pipeline-log.mjs`, behave as follows:
   - A content row dated `2026-10-07` with findings `0/2/0` and Retro `n/a` fails, naming the row.
   - The same row with Retro `kinds: test-gap, wrong-claim` passes.
   - The same row with `kinds: vibes` fails, naming `vibes`.
   - The same row dated `2026-10-06` passes with Retro `n/a`.
   - A `/feature` row dated `2026-10-07` with findings `0/1/0` and no `kinds:` passes.
   - A content row with findings `0/0/0` and Retro `n/a` passes.
3. **Fix-round rule.**
   - A row dated after `2026-10-06` with Gate failures `0`, findings `0/0/0` and Fix rounds `1` fails, naming the row.
   - With Gate failures `1` it passes.
   - With `0/0/0, pre:1` it passes.
   - Dated `2026-10-05` it passes.
4. **The real log passes.** `docs/pipeline-log.md` as it stands passes the new rules.
5. **Hook denies.** The hook, given PowerShell PreToolUse JSON with `cwd` set to a project directory, outputs a `permissionDecision: "deny"` with a reason naming Edit/Write. These commands must be denied:
   - `Set-Content docs\x.md "a"`
   - `"a" | Out-File -Encoding utf8 src\y.ts`
   - `Add-Content -Path .\README.md -Value b`
   - `echo a > docs\z.md`
   - `"a" >> notes.txt`
   - `[IO.File]::WriteAllText("C:\<project>\a.md", "x")`
   - `Set-Content -LiteralPath "<project absolute>\docs\a.md" a`
6. **Hook allows.** It outputs nothing and exits 0 for:
   - `Set-Content $env:TEMP\a.txt x`
   - `"x" | Out-File C:\Users\u\AppData\Local\Temp\claude\…\scratchpad\a.txt`
   - `git status > $null`
   - `npm run verify *> $null`
   - `Get-Content README.md`
   - `"x" | Out-Null`
   - malformed JSON
   - a Bash tool call
7. **Hook speed.** It runs under 1 s and never throws past its own handler.
8. **README check.**
   - The site-description test passes on the real README.
   - It fails, naming README, when the intro paragraph differs from `package.json`'s description. Tested with a changed copy, without editing the real files.
9. **Prose-independent tests.**
   - The two known tests no longer depend on prose in a published page: each either reads its expectation from the file, or asserts behavior on a fixture.
   - A survey note in the test-writer's report lists every test it checked.
   - The `MarkdownRenderer.test.tsx` comment no longer mentions "At a glance".
10. **Process edits.** `/feature` Stage 1 and Stage 5 carry the two edits, each replacing wording rather than adding beside it. docs/SDLC.md doesn't contradict them.
11. **Docs.**
    - docs/writing-standard.md names `src/lib/reading-time.ts` as the code owner of both numbers. The dedupe PR names the two structure tests, so update it.
    - docs/verification.md describes the new pipeline-log rules and the hook.
    - docs/DEFERRED_PRACTICES.md's hooks entries stay accurate: this hook blocks a write, not a commit.
    - The pipeline-log header's Retro definition carries the kinds list and names the script.

## Scope

**In:**

- `src/lib/reading-time.ts` and its test;
- the two structure tests (import only);
- `scripts/check-pipeline-log.mjs` and its test;
- the new hook, its test (`scripts/block-powershell-writes.test.mjs`, or beside the other guard tests) and `.claude/settings.json`;
- `scripts/site-description.test.mjs`;
- the prose-dependent tests;
- the `MarkdownRenderer.test.tsx` comment;
- `.claude/skills/feature/SKILL.md` (Stages 1 and 5);
- docs/verification.md, docs/pipeline-log.md's header, docs/DEFERRED_PRACTICES.md and docs/SDLC.md if needed.

**Out:**

- any content change;
- catalog work;
- the prose dedupe (its own PR).

**UI surface:** none.

**Roles (who proves what):**

- **Stage 2 test-writer:** writes criteria 1, 2, 3, 5, 6, 7, 8 and 9 as tests. `check-pipeline-log.mjs` is a locked guard, so the spec assigns that script's change to the test-writer, planted cases first.
- **Stage 3 implementer:** writes the hook, the `reading-time.ts` export, the process edits and the docs (criteria 10 and 11), and runs criterion 4 through `verify`.
- **Orchestrator at Stage 5:** runs the evals that `evals/README.md`'s table names for these edits (skill-routing for SKILL.md and the hook; feature-review for the Stage 5 edit, if the table names it) and logs them.

## Non-negotiables check

- **#9:** the locked script changes only through the test-writer.
- **#12:** no loop changes.
- **#6:** not touched.
- **Stage 1 guard rules:**
  - The pipeline-log kinds list is an allowlist.
  - The hook can't list its inputs in full (arbitrary PowerShell), so the spec lists its vectors and documents it as fail-open, with `text-encoding.test.ts` as the real gate.
  - Matching on command text isn't the source-code AST rule's case. That rule covers source files, and no parser runs cheaply inside the hook's timeout.

## Verification

- **Stage 2:** the new tests are red for missing implementation, except the locked script's own planted cases, which the test-writer turns green with the script change.
- **Stage 3:** `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:** review, plus regressing the hook in a copy: a write cmdlet the vectors don't list, and a quoted path.
- **Stage 5:**
  - the evals;
  - a manual run of the hook on one real PowerShell write in this session, which should be denied;
  - `npm run check:pipeline-log` on the real log.

## As built

- The hook also denies `Tee-Object` to a project path, which has the same encoding problem as `Out-File`.
- docs/content-review.md's pipeline-log instruction told content runs to write Retro `n/a` always, which the new kinds rule rejects when a run has findings, so it now says to record the kinds. The edit is to the log-row instruction, not the Stage 3 reviewer instruction, so by content-review-eval's own scoping (Stage 0) it needs no run.

## Review decisions

- **Fix with a test (4a round 1):**
  - a named path parameter must bind the target;
  - the kinds clause is checked token by token, up to the clause end;
  - the hook covers the aliases `sc`, `ac` and `tee`, the braced `${env:X}` form, and a path held in a variable assigned to a quoted literal earlier in the same command (`$f='...'; ... | Set-Content $f`), which is the pattern behind the 2026-10-03 ride-sharing encoding defect.
- **Known limitation:**
  - `cd` within a command, which changes what a relative path means;
  - a target that is only known at run time (`$_.FullName`, a computed variable);
  - `New-Item -Value`, `Export-Csv` and `Start-Transcript`, which nothing in this repo uses to write files.

  The hook fails open on these, and `text-encoding.test.ts` stays the gate.

- **No eval run needed for the docs/writing-standard.md edit.** It only repoints the code owner of the word budget and changes no rule a reviewer applies, so content-review-eval's Stage 0 scoping selects no scenario.
- **No feature-review rotation needed for widening check:pipeline-log.** Re-reading evals/feature-review/scenarios.md finds no planted defect that the check now catches.
- **Round 2: fix with a test.** A reassigned variable resolves to the assignment in force where each write runs, as the docs already say (`$f` reassigned to a temp path after a project write).
- **Round 2: known limitation.** The hook reads an assignment-looking string inside quotes (`Write-Host "x; $f=..."`) as real. That only causes a false block, so a retry costs little, and agents rarely echo assignment text.
- **Round 2: documented, no new test.** Typed (`[string]$f=`) and scoped (`$script:f`) assignments, a parenthesised `($f)` and `$(...)` subexpressions are listed as unrecognized forms that fail open.
- **Round 2: known limitation, theoretical.** Dot-sourcing a write cmdlet (`. Set-Content ...`). No agent writes it.
- **Round 3 (user-authorized past the two-round cap): fix with tests.**
  - Any `$name =` at a statement start whose right-hand side isn't a quoted literal sets the variable to unknown, so a later write through it fails open. Before this, the earlier literal stayed in force.
  - Assignment-looking text inside a quoted string is ignored. This replaces round 2's "known limitation" for quoted assignments, which stopped being true once the latest assignment won.
- **Round 3: documented, no new test.**
  - Variable chains (`$f="$root\docs\a.md"`) fail open.
  - Text order isn't run order (a script block or function defined before the assignment it reads).
  - `Set-Variable` isn't recognized.
- **After round 3, known limitations.** These are all Low and are left for the user to fix or drop:
  - An assignment inside a `#` comment counts as real, so it can let a write through. It is undocumented.
  - The hook header says typed assignments fail open; after an earlier literal they fail closed, which only causes a false block.
  - `[IO.File]::Write*` text inside a quoted string still denies, which only causes a false block.
  - No test pins here-strings, escaped quotes or doubled quotes, though all three work today.
