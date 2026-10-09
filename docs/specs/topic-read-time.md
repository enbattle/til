# Spec: a read-time label on catalog topic pages

Status: approved 2026-10-09.

## Context

Case-study and DSA entry pages show `<date> · <N> min read` under the title
(docs/specs/five-minute-templates.md). Catalog topic pages show only the date.
The user asked for the same label on topics, and to check that every topic is
about a five-minute read. All 76 topics today are 713–998 prose words: 4 or 5
minutes at 230 words a minute. The topic-structure test already caps each topic
at `CATALOG_WORD_BUDGET` (1,000 words), so that stays true as topics are added.

## Design

Reuse what case studies and DSA entries already use. Nothing new is built.

- **Eager count.** `src/lib/content.ts` adds an eager `?words` glob over
  `/src/content/**/*.md`, next to `?meta`. That view already exists in
  `vite.config.ts` (`proseWordCount` from `src/lib/markdown.mjs`). The loader's
  `parse` adds `words: wordFiles[filePath]`, the same way `system-design.ts`
  and `dsa.ts` do.
- **Type.** `Topic` (`src/types.ts`) gets `words: number`, with the same doc
  comment as `CaseStudy.words`. `parseTopicMeta` returns
  `Omit<Topic, 'words'>`, like `parseCaseStudy`.
- **Label.** `TopicPage` passes
  ``meta={`${topic.date} · ${readingMinutes(topic.words)} min read`}`` to
  `PageHeader`, using `readingMinutes` from `src/lib/reading-time.ts`. That's
  plain text in the existing meta `<p>`, with no new component, colour or
  layout.

## Acceptance criteria

1. **Loader.** Every entry in `TOPICS` has exactly the keys `section`, `slug`,
   `title`, `summary`, `date` and `words`, and no `body`.
2. **Count.** Every topic's `words` is a positive integer equal to
   `proseWordCount` of its file's body with the frontmatter removed (the
   tests' own raw view, `src/test/content.ts`).
3. **Five minutes or less.** For every topic, `readingMinutes(words)` is at
   most 5.
4. **Page, before the body.** While a topic's body is still loading, the
   line under the h1 reads `<date> · <N> min read`, with
   N = `readingMinutes(topic.words)`.
5. **Page, after the body.** It reads the same after the body loads, and the
   header still has exactly one h1 and the back link.
6. **`parseTopicMeta` is unchanged.** Given valid fixture frontmatter, it still
   returns exactly `section`, `slug`, `title`, `summary` and `date`
   (the existing test stays green).

## Scope

In scope: `src/types.ts`, `src/lib/content.ts`, `src/pages/TopicPage.tsx`, and
tests in `src/lib/content-loading.test.ts` and `src/pages/TopicPage.test.tsx`.
Existing assertions there that look up the bare date by exact text change to
the new line. Test fixtures typed `Topic` in `src/lib/search-index.test.ts` and
`src/lib/search-dsa.test.ts` gain `words` so they still typecheck.

Out of scope: topic cards (`TopicCard.tsx`), section and home pages, search
results, any change to `readingMinutes`, the word budget or the counter.

**Docs and evals (implementer, Stage 3):**

- `docs/content.md`: "Frontmatter is eager" also names the `?words` count.
- `docs/verification.md`: "one word count per case study and DSA entry" also
  covers topics.
- `src/components/PageHeader.tsx`'s comment says it's for case-study and DSA
  pages; add topic pages.
- `evals/feature-review/scenarios.md` FR-08: update the diff's context line
  `meta={topic.date}` (and the hunk header) to the new code, so its
  `git apply --check` premise holds again.
- `evals/skill-routing/scenarios.md` SR-07 (the user's choice): narrow it to
  the follow-up that isn't built yet, a read-time label on the topic,
  case-study and DSA cards on the home and landing pages. Expected route stays
  `/feature`. The premises drop `TopicPage.tsx` and keep or add only "lacks"
  checks on the card components (`TopicCard.tsx`, `NumberedCardList.tsx`).
  Add a History line saying why it changed.

## Who proves what

- Criteria 1–3 and 6: `src/lib/content-loading.test.ts` (Stage 2).
- Criteria 4–5: `src/pages/TopicPage.test.tsx` (Stage 2).
- The size budget and that no body text is in the main chunk: `npm run size`
  and `check:bundle` in `verify`. Adding 76 numbers is expected to fit the
  main chunk's 104 kB limit (99.8 kB brotlied before this change).

**UI surface:** yes, the topic page's meta line, so Stage 4 runs a browser
check. The line must wrap cleanly at 375px. It uses the existing meta text
token, which already passes the contrast check, in both themes.

**NON_NEGOTIABLES:** no line needs to be broken.

**Evals:** this changes no file in `evals/README.md`'s trigger table. The
SR-07 edit changes a scenario, so Stage 5 re-runs only SR-07 through the
skill-routing eval, to check it still routes to `/feature`.

## Where the work happens

All of it is in the worktree `../til-read-time` on branch
`feat/topic-read-time`, which starts from `origin/main`. The main checkout's
`pilot/cortex-rc1` branch is not touched. Nothing is committed or pushed
without the user's go-ahead.

## Review decisions

- **Reject:** `TopicPage.test.tsx` computes the expected minutes as
  `ceil(words / 230)` instead of calling `readingMinutes`. That's deliberate:
  the test's expected value doesn't share a bug with the code under test, as
  in `CaseStudyPage.test.tsx`. A change to the rate is meant to show up there.
- **Known limitation (theoretical):** `parse` doesn't check that
  `wordFiles[filePath]` exists. The `?words` and `?meta` globs use the same
  pattern, and criterion 2's test fails if they ever diverge. The case-study
  and DSA loaders behave the same way.
