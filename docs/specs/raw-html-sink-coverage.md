# Spec: plant every sink NON_NEGOTIABLES #6 names, driven by #6's text

Status: approved 2026-10-04.

## Context

NON_NEGOTIABLES #6 says `check:raw-html` rejects `rehype-raw`,
`dangerouslySetInnerHTML` outside Shiki, and `innerHTML`, `outerHTML`,
`insertAdjacentHTML` and `document.write` in app code.

`scripts/check-raw-html.mjs` enforces all of them: its `RAW_HTML_SINKS` regex
and `RAW_HTML_PACKAGES` list. But `scripts/check-raw-html.test.mjs` plants no
`outerHTML` violation. A mutant dropping `outerHTML` from the regex survived
both the old and the split suites; the #61 review found that by chance. The
script's extra variants, `rehype-dom-raw` and `document.writeln`, are untested
too.

Under the new Stage 6 rule this qualifies for a fix on its first occurrence. It
was caught only by chance, and it concerns an XSS sink a non-negotiable names
(OWASP's DOM-based XSS sinks include `innerHTML`, `outerHTML`, `document.write`
and `insertAdjacentHTML`).

The fix makes the test follow #6's own text. A sink #6 names can't go
untested, and a newly named one can't be silently ignored.

This is a **test-only** change: the script already enforces every sink.

## Design

**All in `scripts/check-raw-html.test.mjs`**, the guard's own test file. #6
says code-level lints like this one keep no vector table in
`scripts/checks.test.mjs`.

1. **Read #6's spans.** Parse `docs/NON_NEGOTIABLES.md` with the shared
   `markdownParser()` (`src/lib/markdown.mjs`). Find the ordered-list item
   whose number is 6, as `list.start` + its index, not by position in the file.
   Collect the `inlineCode` values inside it.
2. **Pin them with an allowlist.** An exported table in the test classifies
   every span #6 contains, either as a sink with a planted fixture or as not a
   sink.

   | Span                                                                                           | Classified as                              |
   | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
   | `rehype-raw`                                                                                   | sink (a package violation)                 |
   | `dangerouslySetInnerHTML`                                                                      | sink, in a file other than `CodeBlock.tsx` |
   | `innerHTML`                                                                                    | sink                                       |
   | `outerHTML`                                                                                    | sink                                       |
   | `insertAdjacentHTML`                                                                           | sink                                       |
   | `document.write`                                                                               | sink                                       |
   | `check:raw-html`, `check:diagrams`, `public/`, `.d2`, `scripts/checks.test.mjs`, `svgProblems` | not a sink                                 |
   - The set of spans in #6 must equal the table's keys exactly, in both
     directions.
   - A span added to #6 fails the test until someone classifies it.
   - A table entry #6 no longer mentions fails, so the table can't drift.

3. **Plant every sink.** Each sink's fixture is planted through the existing
   `repo()` helper. It must exit 1 and print a stderr line that names that
   sink, so it's rejected for the right reason, not by some other rule.
4. **Script-only variants.** `rehype-dom-raw` (in `RAW_HTML_PACKAGES`) and
   `document.writeln` (in the regex) get planted cases too. They're not
   driven by #6.
5. **Nothing removed.** The existing tests stay. A planted case may replace a
   duplicate `it.each` row with the same fixture.

## Acceptance criteria

1. The #6 span set is read with `markdownParser()`, and the test asserts it
   equals the classification table's keys.
   - Shown in Stage 2: a copy of `NON_NEGOTIABLES.md` with one extra
     inline-code span in item 6 fails the test (an unclassified span), and one
     with `outerHTML` removed from item 6 fails it (a stale entry).
   - The test may take the document's path as a parameter so a copy can be fed
     in.
2. Every sink in the table, plus `rehype-dom-raw` and `document.writeln`, has
   a planted fixture. Each makes `check-raw-html.mjs` exit 1 with a stderr
   line naming that sink.
3. **Mutation gate (orchestrator):** for each of the 7 regex or list
   alternatives (`innerHTML`, `outerHTML`, `insertAdjacentHTML`,
   `document.write`, `writeln`, `rehype-raw`, `rehype-dom-raw`) and the
   `dangerouslySetInnerHTML` check, deleting it from the script makes at least
   one test fail. This includes the `outerHTML` mutant that survived before.
4. No script, app or doc file changes, unless criterion 3 shows a sink the
   script doesn't enforce. In that case, stop and report, since that would
   break #6.

## Scope

In: `scripts/check-raw-html.test.mjs`. No docs are expected to change. The
`/feature` and #6 wording already say where these cases go.

Out:

- changing `check-raw-html.mjs` or its regex;
- other guards;
- deriving sinks for other non-negotiables.

User-facing UI: none.

## Non-negotiables check

- #6: this strengthens it; no line changes.
- #8–#10: test-writer only, and the mutation gate is the orchestrator's.
- Nothing conflicts.

## Verification

- Stage 2 gate:
  - `git status`;
  - `npx vitest run scripts/check-raw-html.test.mjs` green;
  - the two doc-copy demonstrations from the test-writer's report;
  - the mutation gate;
  - prettier and oxlint.
- Stage 3: no implementation. Run Stage 3's gate (`check:test-lock -- --verify`
  and `npm run verify`) directly, as the re-run path allows when nothing is
  left to implement. Then Stage 4, a review of the test's parsing and
  allowlist logic.

## As built

- `itemSpans(number, source)` takes `{ path }` or `{ text }`, finds the item by
  `list.start` + index, throws unless exactly one item matches, and recurses
  through all children. `SPAN_TABLE` holds the 12 spans; 6 are sinks, each
  with a fixture and the stderr text it must produce.
- Demonstrations, run on scratchpad copies:
  - an extra `srcdoc` span fails as unclassified;
  - removing `outerHTML` fails as stale.
- Orchestrator mutation gate: all 8 single-alternative deletions are caught,
  `outerHTML` included (it survived before). The control with no mutant
  passes.

## Review decisions

- Known limitation, theoretical: the test resolves `docs/NON_NEGOTIABLES.md`
  from the working directory. Vitest runs from the repo root, as the existing
  guard helpers (`resolve('scripts')`) already assume.
- Known limitation, theoretical: some regex weakenings survive, because each
  fixture uses one fixed form:
  - `\s*=` replaced by a single space;
  - no `\s*` before `(`;
  - `('` required after `insertAdjacentHTML`.

  The spec's gate covers removing an alternative; variant forms are part of
  the follow-up below.

Pre-existing, not caused by this change (for the user):

- `check-raw-html.mjs` misses real innerHTML-class writes:
  - `el.innerHTML += s` (`\s*=` can't match across `+`);
  - bracket access `el["innerHTML"] = s`;
  - `setHTMLUnsafe`, `Range.createContextualFragment` and `iframe.srcdoc =`.

  #6 promises `innerHTML` is rejected, so `+=` is a gap in that promise. No
  app code uses any of these today, since the real-repo check passes.
