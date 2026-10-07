# Spec: eval-premise check, inbound-links tool, PowerShell content-argument block

## Context

The 2026-10-07 docs audit's friction aggregation covered 183 pipeline-log rows. The user approved its proposals 2, 3 and 4, which are three mechanical guards for friction that recurred.

- **Eval fixtures drifted from live content.** The FR-04 control duplicated code that had since landed. FR-06's premise ("three summaries contain `vs. `") disappeared in the catalog rewrite. SR-06, SR-17 and SR-18 prompts were refreshed by hand six times. A Stage 0 sentence asks the orchestrator to check premises, but nothing checks them mechanically.
- **Rewrites cut what other pages link in for.** Rows 150, 152, 158, 163, 174 and 177 each record a rewrite that dropped a definition, heading or term another page links to. Examples: the API-gateway definition a case study links to, the system-prompt definition three pages use, and a `#keeping-it-lean` hash target. Each was caught late, by review or by verify.
- **Text passed through a PowerShell argument corrupts files.** On 2026-10-07 an orchestrator ran `$c=[IO.File]::ReadAllText($f); $n=$c.Replace(...); node -e "…writeFileSync(process.argv[1], process.argv[2])" $f $n`. Native-argument quoting truncated an uncommitted draft to 1.7 KB. `block-powershell-writes.js` (row 120) doesn't see this shape, because the write happens inside node.

## Design

### (a) `scripts/check-eval-premises.mjs`, run as `npm run check:eval-premises` in `verify`

A scenario states each real-content premise it relies on as an HTML comment. The check parses each `evals/*/scenarios.md` with the shared `markdownParser()` and reads its `html` nodes. It accepts exactly these forms, and nothing else (the allowlist):

- `<!-- premise: <path> contains "<text>" -->`: the file exists and contains `<text>`. Whitespace runs in both are collapsed to one space, so a quoted phrase may cross a line break in the file.
- `<!-- premise: <path> lacks "<text>" -->`: the file exists and does not contain `<text>`.
- `<!-- premise: <path> exists -->` and `<!-- premise: <path> missing -->`.

Rules:

- `<path>` is relative to the repo root. An absolute path or a path containing `..` is an error.
- A `premise:` comment that matches no form is an error, never a silent skip.
- Also, every fenced `diff` code block in `evals/feature-review/scenarios.md` must pass `git apply --check`. Each diff is written to a temp file, and the check runs against HEAD's working tree.
- The script prints one line per failure (`file:line: premise …`) and exits 1 on any failure.
- A repo with no scenario files passes.

**Seeding.** Premises are added to the scenarios that depend on live content:

- FR-06: two titles containing `vs.`.
- SR-02: no embeddings topic exists.
- SR-06: caching.md contains the quoted sentence.
- SR-18: `src/dsa/entries/lru-cache.md` is missing.
- SR-20: both the binary-tree and binary-search-tree entries exist.
- Any other scenario whose prompt names existing content (the implementer greps for these).

**Docs.**

- The feature-review-eval Stage 0 prose about checking premises by hand is replaced by a pointer to this check. content-review-eval and skill-routing-eval get the same pointer: declare a premise as a comment when a scenario relies on live content.
- evals/README.md names the convention, and docs/verification.md lists the check.

### (b) `scripts/inbound-links.mjs <section/slug>`, run as `npm run links:inbound -- <section/slug>`

The script lists every link to a topic, so a rewrite drafter and reviewer can see what other pages rely on before cutting. It parses every body under `src/content/**`, `src/system-design/case-studies/*.md` and `src/dsa/entries/*.md` with `markdownParser()`. It walks `link` nodes whose URL path is `/<section>/<slug>` (query ignored, `#anchor` kept), and prints one line per link: `<file>:<line>  <#anchor or —>  "<sentence containing the link>"`. The sentence is taken from the plain text of the link's enclosing paragraph or list item. Old paths that `REDIRECTS` (`src/content/redirects.ts`) maps to this topic are also matched.

- It exits 0 with "no inbound links" when there are none.
- It exits 2 with a usage message when the argument is missing or names no topic.
- It is a tool, not a verify step. Its logic is exported as a pure function so tests drive it on fixtures.

**Wiring.** add-topic's rewrite mode tells the drafter to run it first and keep every anchor and every term the linking sentences rely on. It adds the tool's output to the Stage 3 reviewer's **Files**. The checklist's item (4) gains "nothing an inbound link relies on was cut or renamed".

### (c) Widen `.claude/hooks/block-powershell-writes.js`

A new deny rule: a PowerShell command that runs an inline interpreter script that writes a file, and passes it a variable argument holding text that is not a quoted literal.

**Inline write script.** One of:

- `node -e` / `node --eval` / `node -p`, whose script text contains `writeFileSync`, `writeFile`, `appendFileSync`, `appendFile` or `createWriteStream`;
- `python`, `py` or `python3` with `-c`, whose script contains `open(` with a `'w'`/`'a'` mode argument, or `.write_text(` / `.write_bytes(`.

**Content argument.** A `$var` word (bare or inside a double-quoted word) after the script, where `var`'s assignment in force is not a quoted string literal, using the hook's existing `assignments`/`varsAt`. Also a `$(...)` subexpression argument.

Deny with a reason that names the shape: "passes text through a command-line argument; quoting can truncate or alter it". It points to the Edit tool, or a script that reads its input from a file.

**Still allowed:**

- an inline write script whose only variable arguments were assigned quoted literals, such as a path (`$s='C:\…\scratchpad'; node -e "…" "$s\rows.txt"`);
- `node <script-file> $var`, which isn't inline;
- inline scripts that don't write.

The target path isn't checked: content corruption happens wherever the file is.

This stays a command-text matcher like the rest of the hook. The header's limitation list gains the new rule and its known gaps (a script read from a file, an alias for node). A here-string content variable isn't a gap: a here-string assignment isn't a quoted literal, so it's denied. It fails open as before.

## Acceptance criteria

1. **Premise forms.** For each of the four forms there is a planted passing and a planted failing scenario file. Failures name the file and line.
2. **Malformed and escaping premises.** A `premise:` comment matching no form fails. A path with `..` fails, and an absolute path fails.
3. **Whitespace collapsing.** A `contains` phrase split across a line break in the target file passes.
4. **Diff check.** In a planted feature-review scenarios file, a `diff` block that applies passes, and one with a drifted context line fails.
5. **Real repo.** `npm run check:eval-premises` passes on the real repo with the seeded premises. Planting a premise that names a removed sentence fails it.
6. **Inbound links found.**
   - On fixtures, the inbound-links function finds a plain link, an anchored link (`#x`), a link with a query, and a link from a case study and from a DSA entry.
   - It reports the file, the line, the anchor and the enclosing sentence.
   - It finds a link to an old path that `REDIRECTS` maps to the topic.
   - It ignores links to other topics and to prefixes of the slug (`/s/cache` vs. `/s/caching`).
7. **Inbound links CLI.** It prints "no inbound links" and exits 0 when none. It exits 2 on a missing or unknown argument.
8. **Hook denies the content-argument shape.**
   - It denies the exact 2026-10-07 command.
   - It denies `node --eval` and `python -c` variants with a computed `$var` content argument.
   - It denies a `$(Get-Content -Raw x)` argument.
9. **Hook still allows:**
   - an inline write script whose only `$var` arguments were literal-assigned;
   - `node script.mjs $n`;
   - `node -e "console.log(1)" $n`;
   - the existing allowed vectors (unchanged).
10. **Hook test suite.** All existing hook tests still pass.
11. **Docs.**
    - add-topic's rewrite mode and its checklist item (4) name the tool.
    - The three eval skills and evals/README.md name the premise convention and the check.
    - docs/verification.md lists `check:eval-premises` and the hook's new rule.
    - `check:npm-refs`, `check:claude-md` and `format:check` pass.

## Scope

**In:**

- `scripts/check-eval-premises.mjs` and its test;
- `scripts/inbound-links.mjs` and its test;
- `.claude/hooks/block-powershell-writes.js` and new cases in `scripts/block-powershell-writes.test.mjs`;
- package.json scripts and a `verify` step;
- premise comments in `evals/*/scenarios.md`;
- add-topic SKILL.md, the three eval SKILL.md files, evals/README.md and docs/verification.md.

**Out:**

- checking premises inside content-review drafts, which are fabricated and cite no live content;
- making inbound-links a verify gate;
- a full PowerShell parser.

**UI surface:** none.

**Roles:**

- **Stage 2 test-writer:** criteria 1–10, as `scripts/check-eval-premises.test.mjs`, `scripts/inbound-links.test.mjs`, new cases in `scripts/block-powershell-writes.test.mjs`, and the `verify` step.
- **Stage 3 implementer:** the code, the seeded premises and the docs (criterion 11).
- **Orchestrator at Stage 5:** runs the evals.

**Evals (Stage 5):** `skill-routing-eval`, scoped to SR-02, SR-06, SR-10, SR-12 and SR-14. The edits touch add-topic, the three eval skills and a hook. No Stage 3 or 4 instruction or checklist changes, apart from add-topic item (4), so `content-review-eval` also runs, on CR-01..05.

## Non-negotiables check

No UI, colors or bundle change. #6 (raw HTML) isn't touched. Nothing conflicts.

## Verification

- **Stage 2:** the new tests are red for missing modules or rules, and the existing hook tests are green.
- **Stage 3:**
  - `check:test-lock -- --verify` and `npm run verify`;
  - plant, in a scratch copy, a premise naming a removed sentence and confirm `check:eval-premises` exits 1;
  - run `npm run links:inbound -- systems-and-infrastructure/forward-vs-reverse-proxy` and confirm the ecommerce-checkout API-gateway link is listed.
- **Stage 4:** the reviewer tries every regression path for each guard in a copy.

## As built

- Both scripts take their root from an environment variable (`CHECK_EVAL_PREMISES_ROOT`, `INBOUND_LINKS_ROOT`) so the tests can point them at a temp repo. The premise check lists files through git, so that root must be a git repository.
- Hook: a `$var` that the command never assigns (`$env:X`, a loop variable) fails open, like the hook's other rules. `node --print` is matched along with `-p`. The header's gaps also list a flag with a separate value before `-e`/`-c`, and a full path to node or python.
- inbound-links: it lists a topic's links to itself too. It splits sentences at `.`, `!` or `?` followed by whitespace, so an abbreviation like "vs." can shorten the quoted sentence. This affects only what's displayed, not which links are found. It loads `REDIRECTS` from `redirects.ts` using Node's type stripping, as `check-bundle.mjs` already does for `frontmatter.ts`.
- Hook, round 2 fixes: a literal argument isn't always safe, contrary to Design (c)'s "Still allowed" list. PowerShell 5.1 strips an embedded `"` from a native argument, so rule 2 also denies literal text holding a `"` or a newline: a quoted or here-string argument, or a `$var` whose assignment in force is such a literal. A path-like literal, `--` and an unassigned or loop variable stay allowed. Rule 1 keeps a double-quoted assignment's text as its value even when it expands a computed part, so `$f = "docs\$name.md"` resolves to `docs\`; a separate computed flag feeds rule 2. Rule 1's deny reason no longer suggests `node -e` with `writeFileSync`.
- Premise check, round 2 fixes: a `missing` premise fails when its path's directory doesn't exist, and a comment starting with the word `premise` or `premises` but without the exact `premise:` (`<!-- premise docs/a.md missing -->`) is reported as malformed.
- Premises that a path can't express aren't seeded: CR-05, FR-01, and SR-17's check-diagrams half (that the check has no node-count rule). SR-17's page half is seeded as `src/pages/CaseStudyPage.tsx lacks "clipboard"`.

## Review decisions

Round 1 known limitations. Triage found each theoretical: none of 71 past inline write commands in this project's transcripts uses these shapes.

- **Hook, `+=` compound assignment** (`$n=''; $n += Get-Content …`): only that exact shape gets through.
- **Hook, script text held in a variable** (`node -e $js`): one-liners have no reason to do this.
- **Hook, output captured** (`$out = node -e …`, `$null = node -e …`): a write prints nothing, so nothing needs capturing.
- **Hook, splatting** (`@a`): not an agent idiom.
- **Hook, scoped variable** (`$script:n`): already a known gap of rule 1.
- **Hook, write forms outside the listed ones:**
  - python `'x'` can't do an in-place edit;
  - `'r+'`;
  - `open(...)` nested two levels deep;
  - node `writeSync`/`openSync`.
- **Hook, indirect launch** (`cmd /c node`, `& 'node'`).
- **Premise check:**
  - an empty or whitespace-only `contains` phrase;
  - a diff fenced as anything other than `diff`, when every FR diff and the docs use `diff`;
  - a premise indented as code.

Round 2 known limitations, all theoretical: none of about 2,950 past PowerShell commands uses these shapes.

- **Premise check, two premises in one comment:** the greedy phrase match swallows the second premise.
- **Premise check, backslash or wrong-case paths on Linux CI:** all real premises use forward slashes, and Windows catches a wrong `missing`.
- **Hook, typed assignment, `Start-Process node`, `iex`, and a CRLF backtick continuation:** named in the header's gaps.
- **inbound-links, trailing-slash links:** no content uses them, and `extractTopicRefs` ignores them too.
- **SR-02's premises rule out slug variants, not the fact:** `vector-search.md` already teaches embeddings. The expected answer (`add-topic`) holds either way.
- **docs/content.md's move steps still say `git grep`:** that's accurate, and `catalog-gaps.test.ts` catches a missed link.

After round 2 (the fix-round cap), the remaining items default to known limitations:

- **Hook, text piped on stdin to an inline write script:** PowerShell adds a BOM and a trailing CRLF. The spec scopes rule 2 to arguments.
- **Hook, other unmatched shapes:**
  - a version-suffixed interpreter (`python3.12`);
  - a literal followed by a pipe on the right-hand side;
  - `Set-Variable`.
- **Hook, header wording:** it lists a CRLF backtick continuation as fail-open, but it is denied. A backtick continuation before a literal argument is also over-denied.
- **Premise check:**
  - a comment whose `premise:` keyword isn't first is skipped;
  - a `lacks` phrase is trimmed.
