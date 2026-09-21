# Load topic bodies on demand

## Context

Every topic and question body is inlined into the main JS chunk by two eager
`import.meta.glob(..., { eager: true })` calls (`src/lib/content.ts`,
`src/lib/system-design.ts`), so the client-side search index can be built at
load. The main chunk has grown with every topic and had to have its size limit
raised three times for content alone (155 -> 164 -> 168 -> 183 kB; 179.04 kB
today). `CLAUDE.md` records that the revisit condition for fixing this has been
met and that a fourth raise is "not the answer".

Only three things actually need a topic body: rendering a topic page, full-text
search, and a handful of tests. Everything else (the sidebar, section and home
pages, cards, prev/next, sort order, the question layer's topic lists) needs
only frontmatter. So: ship frontmatter eagerly, and load bodies when something
asks for one. Topics are ~57 files and ~90% of the text; the 8 question pages
are small and stay eager.

## Decisions (recommended defaults, all reversible)

- **Frontmatter-only eager data via a small Vite plugin** (a `?meta` query that
  returns a file's frontmatter as JSON). Alternatives rejected: one big lazy
  "all bodies" chunk (a topic view would download every body), and a generated
  manifest file (a second artifact that can go stale).
- **One lazy chunk per topic body** (a non-eager `?raw` glob). Opening a topic
  fetches only that topic's ~1-2 kB; the first search fetches them all in
  parallel (~57 small requests, cached afterward).
- **Search stays synchronous and becomes progressive:** title/summary matches
  work immediately; opening the dialog starts loading bodies, and body matches
  appear when they arrive. No blocking spinner, no empty search box.
- **Questions stay eager.** Their bodies feed the sidebar's topic lists and the
  topic pages' "This comes up in" links at first render, and they're small and
  grow slowly. Noted as the next lever if they ever multiply.
- **Remove `searchTopics`.** The app doesn't use it (only its own tests), and
  keeping a second body-search API alive means keeping a second index.
- **A build guard so this can't silently regress:** a `check:bundle` script
  fails if any topic's body text is found in the main chunk, and wires into
  `npm run verify` and CI.

## Approach

### Types and content API (`src/types.ts`, `src/lib/content.ts`)

`Topic` loses `body` (it becomes metadata: `section, slug, title, summary,
date`). `Question` keeps `body`.

```ts
export const TOPICS: Topic[]; // meta only, sorted by title
export function parseTopicMeta(filePath: string, data: Record<string, string>): Topic;
// exported for fixture tests; throws on a bad path or a missing
// title/summary/date, naming the file and field (same messages as today)
export function getTopic(section: string, slug: string): Topic | undefined; // unchanged
export function loadTopicBody(section: string, slug: string): Promise<string>;
// frontmatter stripped; rejects for an unknown topic; the promise is memoized
// per topic; a REJECTED load is evicted so a retry re-attempts
export function loadAllTopicBodies(): Promise<Map<string, string>>;
// key `section/slug`, one entry per topic; memoized after success
```

`topicsBySection`, `sectionNeighbors`, `recentTopics` are unchanged.

### Build plugin (`vite.config.ts`)

A ~25-line plugin: for an id ending `.md?meta`, `load` reads the file, runs the
existing `parseFrontmatter` (`src/lib/frontmatter.ts`) and returns
`export default <JSON of the frontmatter>`; `addWatchFile` so dev/HMR see
edits. `content.ts` then uses
`import.meta.glob('/src/content/**/*.md', { query: '?meta', import: 'default', eager: true })`
for metadata and `import.meta.glob('/src/content/**/*.md', { query: '?raw', import: 'default' })`
(lazy loaders) for bodies. It must work under `vite dev`, `vite build` and
Vitest (which reuses the config's plugins). Add the `?meta` module declaration
next to `vite-env.d.ts`.

### Search (`src/lib/search.ts`)

- The index is built from topic meta + questions (as today, minus topic bodies).
- `ensureFullTextSearch(): Promise<void>` loads all topic bodies once
  (idempotent), rebuilds the index with bodies, and flips a flag;
  `isFullTextSearchReady(): boolean`. A rejected load leaves the flag false and
  a later call retries.
- `searchContent(query, limit)` stays synchronous with the same keys, weights
  and threshold; before the flag flips it simply has no topic body text.

### UI

- **`SearchDialog`:** on mount, call `ensureFullTextSearch()`; re-run the
  current query when it resolves. While pending show a `role="status"` line
  "Loading full-text search…"; on rejection "Full-text search couldn't load;
  showing title and summary matches." Nothing else about the dialog changes.
- **`TopicPage`:** header (back link, `h1`, date) renders immediately from
  metadata; the body comes from `loadTopicBody` (React 19 `use` inside the
  existing `<Suspense fallback={null}>` pattern, keyed by the memoized promise)
  and renders through `MarkdownRenderer`. A failed load hits the existing
  `ErrorBoundary` ("Something went wrong" + Reload), which is already the right
  fix for a stale-chunk error after a deploy.
- **`QuestionPage`, `QuestionNav`, `system-design.ts`:** unchanged.

### Guard (`scripts/check-bundle.mjs`, `npm run check:bundle`)

After a build: for every `src/content/**/*.md`, take the first non-empty body
line (>= 40 chars), and fail if it appears in `dist/assets/index-*.js`, or if it
appears in no other file under `dist/assets/` (a body that went missing). Wired
into `npm run verify` after `size` and into `ci.yml`. Verified to fail on a
deliberately eager build before the fix is applied.

### Size budget

Re-measure and lower the main-chunk limit to measured + ~4 kB (expected to drop
well below today's 183 kB, into the ~100-120 kB range); record before/after in
`CLAUDE.md`. Growth after this comes only from question pages and code.

## Acceptance criteria (each becomes a test unless marked)

**Content loader**

1. `TOPICS` entries have `section, slug, title, summary, date` and no `body`
   property; sorted by title; `topicsBySection`, `getTopic`, `sectionNeighbors`,
   `recentTopics` behave as before (existing tests pass).
2. `parseTopicMeta` throws, naming the file and field, on a missing `title`,
   `summary` or `date`, and on a path that isn't `/src/content/<section>/<slug>.md`.
3. `loadTopicBody` resolves a real topic's body equal to
   `parseFrontmatter(raw).content` (non-empty, no frontmatter); rejects for an
   unknown topic with an error naming it; two calls for the same topic return
   the same promise; after a rejected load, a second call attempts again
   (loader stubbed to fail once).
4. `loadAllTopicBodies` resolves a map with exactly one non-empty entry per
   `TOPICS` element.

**Search** 5. `searchContent('')` and whitespace return `[]`; before `ensureFullTextSearch`
a topic-title query finds that topic, a query matching only a question's body
finds the question, and a phrase that appears only in a topic body
(`thin vertical slice`) does NOT find `plan-before-you-build`. 6. After `await ensureFullTextSearch()` that same phrase finds
`plan-before-you-build`; `isFullTextSearchReady()` is false before and true
after; a second call reuses the work; a rejected load leaves it false and a
later call retries. 7. `searchTopics` is no longer exported.

**UI** 8. `SearchDialog`: title/summary results appear immediately with the status
line present; when full text loads the status disappears and a body-only
phrase now returns its topic; on load failure the failure status is shown and
title/summary results still work. Existing dialog behavior (label,
placeholder, Escape, focus trap, activating a result) unchanged. 9. `TopicPage`: the `h1` and back link are present without waiting for the body;
the body's content appears once loaded; an unknown topic still redirects to
not-found; a rejected body load shows the ErrorBoundary fallback with a
Reload button. 10. Everything else (topic page's "This comes up in" list, prev/next, question
pages, catalog and System Design navigation) passes its existing tests.

**Build (not unit-testable; checked by the scripts and the browser review)** 11. `.md?meta` works in dev, build and Vitest. 12. `npm run check:bundle` passes on the new build and fails when topic bodies
are inlined into the main chunk. 13. `npm run verify` passes with the lowered main-chunk limit; the number and
the before/after are recorded in `CLAUDE.md`.

## Tests that must change (deliberately, for the new API)

The tests that read a **topic** body synchronously change to read it through
`await loadAllTopicBodies()` in a `beforeAll`: `where-youll-meet-this.test.ts`,
`catalog-gaps.test.ts` and `content.test.ts`. (Reads of a **question** body in
`system-design.test.ts` and `App.system-design.test.tsx` are unaffected:
questions stay eager. An earlier draft of this spec miscounted those as topic
reads.) `search.test.ts` and `search-content.test.ts` migrate their
`searchTopics` cases to `searchContent` plus `ensureFullTextSearch` and drop the
`searchTopics` assertions. Any test that renders `TopicPage` uses `findBy*` for
content that comes from the body. The test-writer stage makes these edits; the
implementer edits none of them.

## Testing seams (so the tests don't depend on the real glob loaders)

The behavior in criteria 3 and 6 (memoize, evict on failure, retry, flag state)
must be testable with fake loaders, so the logic lives in two small factories
that take their dependencies as arguments, and the module-level functions are
thin wiring around one default instance built from the real content.

```ts
// src/lib/content.ts
export function createBodyStore(loaders: Record<string, () => Promise<string>>): {
  load(key: string): Promise<string>; // key `section/slug`
  loadAll(): Promise<Map<string, string>>; // every key in `loaders`
};
// `load`: an unknown key rejects with an Error naming it; the promise for a key
// is memoized; a rejected load is evicted so the next call re-invokes the
// loader. `loadAll`: resolves once every loader has; memoized after success;
// after a failure a later call retries. Loader results are the FRONTMATTER-
// STRIPPED body (the real wiring applies `parseFrontmatter(raw).content`).
// `loadTopicBody(section, slug)` rejects for a section/slug not in `TOPICS`, and
// otherwise delegates to the default store; `loadAllTopicBodies()` is the
// default store's `loadAll`.

// src/lib/search.ts
export function createSearchIndex(deps: {
  topics: Topic[];
  questions: Question[];
  loadTopicBodies: () => Promise<Map<string, string>>;
}): {
  searchContent(query: string, limit?: number): SearchResult[];
  ensureFullTextSearch(): Promise<void>;
  isFullTextSearchReady(): boolean;
};
// The module's exported `searchContent`, `ensureFullTextSearch` and
// `isFullTextSearchReady` are the default instance built from `TOPICS`,
// `QUESTIONS` and `loadAllTopicBodies`.
```

UI tests control failures with `vi.mock('@/lib/search', ...)` (for the dialog)
and `vi.mock('@/lib/content', ...)` (a rejecting `loadTopicBody` for
`TopicPage`), keeping the real modules for everything else via
`vi.importActual`.

## Files

**New:** `scripts/check-bundle.mjs`; the `?meta` declaration.
**Edited:** `vite.config.ts`, `src/types.ts`, `src/lib/content.ts`,
`src/lib/search.ts`, `src/components/SearchDialog.tsx`,
`src/pages/TopicPage.tsx`, `package.json` (`check:bundle`, `verify`,
`size-limit`), `.github/workflows/ci.yml`, `CLAUDE.md` (content architecture:
`content.ts` no longer loads bodies eagerly; size note rewritten: the
lazy-loading item is done, what still grows the main chunk, the new limits),
`README.md` if it lists commands, and any skill/doc that lists the verification
chain or says bodies are eager.
**Spec saved to:** `docs/specs/lazy-content-loading.md` once approved.

## Risks and how they're handled

- **Many small chunks (~57).** Fine on HTTP/2 static hosting; the first search
  fetches them in parallel and they're cached. Guard script covers "went missing".
- **Stale chunk after a deploy** (a tab holding an old index): the existing
  `ErrorBoundary` reload fallback covers it; tested via a rejected load.
- **`?meta` in three environments** (dev, build, Vitest): acceptance criterion
  11, verified in the browser review and by the test suite itself.
- **Frontmatter parsed at build time** with the same `parseFrontmatter`, so the
  contract (flat `key: value`) is unchanged and validated the same way.
- **Test churn is real but bounded** (about 17 body reads in 5 files, plus the
  search tests), and is the point of the test-first stage.

## Out of scope

Lazy question bodies; prefetching the next topic; server-side or build-time
search index; changing how markdown renders; any visual redesign.

## Verification

`npm run verify` (including `check:bundle` and the lowered `size` limit); also
under Node 22 (CI's version). Then a real-browser review: production build via
`npm run preview` under `/til/`, network tab shows a topic view fetching only
its own small chunk, the first search fetching the rest and showing the status
line then the body matches, offline/failed-chunk behavior via the reload
fallback, keyboard-only search, both themes, a 375 px viewport, console clean.
