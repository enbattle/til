# Spec: five-minute templates behind a per-page switch, plus a read-time label

Status: approved 2026-10-05.

## Context

PR #69 set a five-minute standard for case studies and DSA entries
(docs/writing-standard.md, docs/case-studies.md, docs/dsa.md). The structure
tests still enforce the old templates, so no rewritten page can land. The user
chose a temporary per-page switch: each page opts into the new template with a
frontmatter line, so rewrites land in batches of about five with CI green. The
last migration batch removes the old templates and the switch. The user also
asked for a computed "N min read" label on both kinds of page.

## Design

**The switch.** The frontmatter line is `template: 2`. A case study or DSA entry
with it is checked against the new template; one without it keeps today's
checks. Any other value fails the structure test, naming the file and value.
Only the two structure tests read the field; the loaders ignore it.

**One word counter.** `proseWordCount(markdown)` is added to
`src/lib/markdown.mjs`. It parses with the shared `markdownParser()` and counts
the words a reader reads:

- It counts heading, paragraph, list, table, blockquote and link text, and
  inline code.
- It skips fenced and indented code blocks, image alt text, raw HTML nodes and
  reference definitions.
- A word is a whitespace-separated token that contains a letter or digit.
- Inline formatting doesn't split a word (`foo**bar**` is one word); separate
  blocks don't join (two paragraphs never merge into one token).

The structure tests' budget and the label both use this counter.

**Read time.** `readingMinutes(words)` is `max(1, ceil(words / 230))`. The 230
words a minute matches the Writing Standard's "1,150 words, about five minutes".

**Eager count.** A new build-time view, `?words`, is added to `MARKDOWN_VIEWS`
in `vite.config.ts` and backed by `proseWordCount`. The case-study and DSA
loaders read it eagerly beside `?meta`. `CaseStudy` and `DsaEntry` gain
`words: number`, so the label shows before the lazy body loads.

**The label.** It goes in the existing meta line under the title:

- Case study: `2026-10-05 · 5 min read`
- DSA entry: `Pattern · 2026-10-05 · 5 min read`

It is plain text in the existing `<p>`, with no new component and no new
colors. Every case study and DSA entry shows it, old template or new; an old
6,000-word page truthfully says about 27 minutes.

## Acceptance criteria

1. **Counter.** `proseWordCount` handles:
   - a paragraph of 5 words: 5;
   - the same with a fenced code block added: still 5;
   - an image whose alt text has 4 words: adds 0;
   - `[two words](/x)`: 2;
   - `**Reads:** 116 a second`: 4;
   - `foo**bar**`: 1;
   - two one-word paragraphs: 2;
   - a table with cells `a b` and `c`: 3 plus the header words;
   - inline code `` `x7Kp2Qa` ``: 1;
   - punctuation-only tokens (`—`, `=`): 0.
2. **Read time.** `readingMinutes` gives:
   - 0 → 1 minute;
   - 230 → 1;
   - 231 → 2;
   - 1,150 → 5;
   - 1,151 → 6.
3. **The `?words` view.** It returns the same number as `proseWordCount` on the
   file's body without frontmatter, for a real case study and a real DSA entry.
   Every `CaseStudy` and `DsaEntry` has a positive integer `words`.
4. **Case-study page.** It shows `<date> · <N> min read` under the title, with
   N = `readingMinutes(words)`, both before and after the body loads.
5. **DSA entry page.** It shows `<kind label> · <date> · <N> min read`.
6. **Old-template pages.** A case study or entry without `template` passes or
   fails exactly as today; every published page still passes.
7. **Unknown template value.** `template: 3` or `template: two` fails the
   structure test, naming the file and the value.
8. **Case-study template 2.** For a page with `template: 2`, the structure test
   (rendered DOM, as today) requires:
   - at least one paragraph before the first `h2`;
   - the `h2`s exactly, in order: `Requirements`, `Key numbers`,
     `High-level architecture`, `API and data model`, three `Decision: <topic>`,
     `Likely follow-ups`;
   - `Requirements`: one list of 4–6 top-level items;
   - `Key numbers`: a paragraph first, then one list of 4–5 top-level items,
     each opening with bold text that begins with a label and a colon
     (`**Reads:**` or `**Reads: about 116 a second.**`);
   - each `Decision:` section's last block is a paragraph opening with bold
     `Rule of thumb.`;
   - `Likely follow-ups`: one list of 4–6 top-level items, each opening with
     bold text;
   - `High-level architecture` holds a `/diagrams/` image with alt text (the
     existing rule);
   - every in-page link resolves (the existing rule);
   - `proseWordCount(body)` ≤ 1,150.

   Each rule has a planted failing case built from one passing template-2
   fixture body inside the test, as the existing "structure check itself"
   block does.

9. **DSA template 2.** For an entry with `template: 2`:
   - Data structure `h2`s: `Prerequisites`, `What it is`, `When to use it`,
     `Operations and costs`, `Implementation`, `Pitfalls`. `Operations and
costs` holds a table; `Implementation` holds at least one code pair.
   - Pattern and algorithm: today's headings, with `Walkthrough` needing at
     least 2 pairs (not 3), each followed by a paragraph.
   - Every code block in those sections is part of a pair (the existing rule).
   - `proseWordCount(body)` ≤ 1,150.

   Each rule has a planted failing case, as in criterion 8.

10. **Budget boundary.** A template-2 body at exactly 1,150 words passes, and
    one at 1,151 fails, naming the count. This holds for both kinds.
11. **Bundle.** `check:bundle` stays within budget without a raise.

## Scope

In:

- `src/lib/markdown.mjs`: `proseWordCount`;
- a small `readingMinutes` helper;
- `vite.config.ts`: the `?words` view;
- `src/lib/system-design.ts`, `src/lib/dsa.ts`, `src/types.ts`: the `words`
  field;
- `CaseStudyPage.tsx`, `DsaEntryPage.tsx`: the label;
- the two structure tests, plus tests for the counter, the view, the loaders
  and the pages;
- docs:
  - case-studies.md and dsa.md: describe `template: 2`, replacing the
    migration notes' "until the rewrite lands" wording;
  - add-case-study and add-dsa-entry Stage 1: add `template: 2` to
    frontmatter;
  - DESIGN.md: if it describes the meta line;
  - verification.md: if needed.

Out:

- rewriting any content: the two approved pilots land as migration batch 1;
- removing the switch or the old templates: the last batch does that;
- the `backtracking -> depth-first-search` prerequisite link: the DSA merge
  batch adds it, since `depth-first-search` doesn't exist yet;
- any catalog change.

User-facing UI: yes, but small: one text change in the meta line on two page
kinds. Stage 4 checks both themes, 375px, and the longest title.

## Non-negotiables check

- **#1:** the label is plain text in an existing element, which keeps the
  existing contrast and needs no new interaction.
- **#2:** no new colors.
- **#3:** the eager `words` numbers are tiny, and the bundle check has to stay
  green without a raise.
- **#4:** no prose changes.
- **#6:** no raw HTML.
- Nothing conflicts.

## Verification

- **Stage 2:** the new tests are red. The existing structure tests stay green
  on the real content.
- **Stage 3:** `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:** a browser check of the label on the longest case-study title
  and on a DSA entry, at 375px and in both themes. Try regressing each template
  rule in a scratch copy.
- **Preview:** after merge, the pilots, dropped into a page with
  `template: 2`, must pass the new checks or show exactly which rule they miss.

## As built

- `parseCaseStudy` and `parseDsaEntry` still return the frontmatter record without `words`; the loaders merge `words` in from the `?words` view. The spec didn't say where the field is added, and keeping the parsers to frontmatter keeps their contract unchanged.
- `readingMinutes` lives in `src/lib/reading-time.ts`, where the Stage 2 tests import it.

## Review decisions

- Known limitation: two `## Decision:` headings with the same topic pass. `createHeadingIds` numbers repeats (`x`, `x-1`), so ids don't collide and links don't break; theoretical.
- Known limitation: a trivial bold label (`**-:**` in Key numbers, `**?**` in follow-ups) passes. Very unlikely while drafting, and the content review reads every item.
- Known limitation: an intro that is a single bold sentence passes. Counting sentences reliably is fragile; the content review checks the intro.
- Reject: prose inside a fenced code block isn't counted toward the budget. The Writing Standard and this spec exclude code blocks by design.
- Reject: a paragraph after the Key-numbers list passes. docs/case-studies.md doesn't forbid one.
- Known limitation: a `Decision:` section whose only block is the `**Rule of thumb.**` paragraph passes, as does punctuation alone after the label. The content review checks each decision names its choice and alternative.
- Known limitation: Key numbers can hold nested sub-bullets beyond its 4–5 top-level items; the spec counts top-level items.
- No change: `proseWordCount` joins words across inline HTML or an inline image (`alpha<br>beta` counts as 1), matching the rendered page, which drops raw HTML.
