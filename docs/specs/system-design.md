# System Design: a question-first way in alongside the catalog

## Context

The site is a catalog: topics grouped into five sections, listed
alphabetically, found by name or search. That's the right shape for lookup
("I know I want Idempotency") and stays exactly as it is. It's the wrong
shape for the way problems actually arrive in system design — as a symptom
or a question ("what do I do when my database can't keep up with reads?"),
with the relevant topics only discoverable afterward.

`systems-and-infrastructure` alone now has 23 topics in one flat, alphabetical
list, and cross-linking between them is thin (five topics have no internal
links at all). This change adds a second, question-first way to browse that
material, without touching the catalog.

## Decisions already made (with the user)

- Two top-level tabs in the header: **Catalog** (everything that exists
  today, still the default landing at `/`) and **System Design** (new).
- System Design's left navigation lists **questions**; under each question,
  the catalog topics it draws on. Entry points are phrased as real
  questions, not statements.
- Each question page has its own content that **answers the question**,
  including short snippets of the topics it mentions. It routes and compares
  ("what does this buy, what does it cost, when do I pick it here"); it does
  not re-teach a topic's mechanism. Every topic link — in the body, in the
  sidebar, in the "Go deeper" list — goes to the **same single catalog page**.
  A topic is never duplicated.
- **Option A:** clicking a topic from a question lands on the ordinary catalog
  page. The Catalog tab becomes current and the sidebar is the catalog's
  `SectionNav`. The way back is a generated "This comes up in:" list on the
  topic page.
- System-design walkthroughs ("design a news feed") are possible later, not
  now. Nothing in this change should make them harder to add.
- A "Where you'll meet this" section on each systems topic is a **separate
  later change**, not part of this one.

## Approach

### Where question content lives

`src/content/` is globbed as `src/content/<section>/<slug>.md` and
`registry.test.ts` requires one registry entry per folder there, so a
`system-design` folder under it would be treated as a fifth catalog section.
Questions therefore live outside it:

```
src/system-design/questions/<slug>.md
```

with their own loader (`src/lib/system-design.ts`) that reuses
`parseFrontmatter`.

Question file frontmatter (flat `key: value`, as always):

```
---
title: What do I do when my database can't keep up with reads?
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
order: 2
---
```

`order` is a positive integer; questions are listed in ascending `order`.

### Types

`src/types.ts` gains:

```ts
export interface Question {
  slug: string; // filename without .md, kebab-case
  title: string; // the question itself
  summary: string;
  date: string; // YYYY-MM-DD
  order: number; // positive integer, unique across questions
  body: string; // markdown, frontmatter stripped
}
```

### Loader API (`src/lib/system-design.ts`)

Link parsing, ordering and the reverse index are **pure functions of their
inputs**, so they can be unit-tested with fixtures; only the eager
`import.meta.glob` wrapper touches real files.

```ts
/** Throws unless filePath is `/src/system-design/questions/<slug>.md`, and
 *  throws (message names the file and the field) if title, summary, date or
 *  order is missing, or if order is not a positive integer. */
export function parseQuestion(filePath: string, raw: string): Question;

/** Every question, sorted by `order` ascending. */
export const QUESTIONS: Question[];

export function getQuestion(slug: string): Question | undefined;

/** Inline markdown links in `body` whose destination is exactly
 *  `/<section>/<slug>` (two non-empty path segments), in order of first
 *  appearance, de-duplicated by section+slug. A `#fragment` or `?query` on the
 *  destination is ignored. Excludes external links, single-segment links, and
 *  `/system-design/...` links. Links inside fenced code blocks are not
 *  counted. Does not check that the topic exists. */
export function extractTopicRefs(body: string): { section: string; slug: string }[];

/** Slugs of `/system-design/<slug>` inline links in `body`, first-appearance
 *  order, de-duplicated. Same fenced-code exclusion. */
export function extractQuestionRefs(body: string): string[];

/** The catalog topics `question` links to, in order of first appearance,
 *  resolved through `getTopic`. A ref that doesn't resolve is skipped here
 *  (a dead link is caught by a test, not by throwing at render time). */
export function topicsForQuestion(question: Question): Topic[];

/** The questions whose bodies link to the given topic, in `order`. */
export function questionsForTopic(section: string, slug: string): Question[];
```

`src/lib/search.ts` keeps `searchTopics` **unchanged** and adds:

```ts
export type SearchResult =
  { kind: 'topic'; topic: Topic } | { kind: 'question'; question: Question };

/** Fuzzy-searches topics and questions together (same keys, weights and
 *  threshold as `searchTopics`; a question's keys are title, summary, body).
 *  Empty/whitespace query returns []. */
export function searchContent(query: string, limit?: number): SearchResult[];
```

### Routing and shell (`App.tsx`)

```
/                          catalog home            (unchanged)
/not-found                 (unchanged)
/system-design             SystemDesignPage        (new, not lazy — no markdown)
/system-design/:slug       QuestionPage            (new, lazy — renders markdown)
/:section, /:section/:slug (unchanged)
```

`QuestionPage` is lazy-loaded exactly like `TopicPage`, for the reason
documented in `App.tsx` (markdown rendering stays out of the main chunk).
React Router ranks static segments above dynamic ones, so `/system-design` is
never mistaken for a catalog section; `registry.test.ts` additionally asserts
no section slug is `system-design` or `not-found`.

The desktop sidebar and `MobileNav` show **`QuestionNav`** on
`/system-design` and `/system-design/*`, and **`SectionNav`** on every other
route (including topic pages and not-found).

### Components

- **Header** — adds `<nav aria-label="Primary">` with two `Link`s, labelled
  exactly `Catalog` (to `/`) and `System Design` (to `/system-design`). The
  active one carries `aria-current="page"` and a **non-color** signal
  (bold weight plus an accent underline/border, per `docs/DESIGN.md`).
  System Design is active when the pathname is `/system-design` or starts with
  `/system-design/`; Catalog is active on every other route. The logo still
  links to `/`. The tabs are visible at every width; below the `sm`
  breakpoint they may wrap to a second row rather than crowd the logo row —
  no horizontal page scroll at 375 px.
- **`QuestionNav`** — `<nav aria-label="Questions">`. One entry per question
  in `order`: a link to `/system-design/<slug>` (the question title, with
  `aria-current="page"` and the same non-color current treatment as
  `SectionNav` when on that page), a sibling disclosure `<button>`
  (`aria-expanded`, `aria-controls` → the topic list id, `aria-label`
  `Expand <title>` / `Collapse <title>`), and a nested `<ul>` (toggled with the
  `hidden` attribute, not conditional rendering) of links to
  `/<section>/<slug>` for each topic from `topicsForQuestion`, showing the
  topic title. Only the current question starts expanded; navigating to a
  different question expands it without collapsing one the user opened.
  Accepts `onNavigate?` and `className?` like `SectionNav`. The expand/collapse
  state logic should be **shared with `SectionNav`** (extract a small hook or
  helper) rather than copy-pasted; `SectionNav`'s behavior and its existing
  tests must not change.
- **`SystemDesignPage`** (`/system-design`) — exactly one `h1`, "System
  Design"; a short intro sentence; then every question, in order, as a card
  link (question title + summary) to its page.
- **`QuestionPage`** (`/system-design/:slug`) — an unknown slug redirects to
  `/not-found`. Otherwise: a `← System Design` link back to the landing page;
  exactly one `h1` (the question title; a body `# heading` is demoted by the
  existing `MarkdownRenderer` behavior); the date; the rendered body; a
  **"Go deeper"** `h2` list (only when the question links ≥1 topic) of each
  linked topic as a link to its catalog page followed by that topic's own
  `summary` (generated — never re-typed); and prev/next links to the adjacent
  questions by `order`.
- **`TopicPage`** — when `questionsForTopic(section, slug)` is non-empty,
  renders, after the body and before the existing prev/next nav, a
  `<nav aria-label="Questions this topic comes up in">` containing the text
  `This comes up in:` and one link per question (its title) to
  `/system-design/<slug>`. Renders nothing extra when the list is empty.
- **`SearchDialog`** — uses `searchContent`. Topic results behave exactly as
  today. A question result shows its title, the label `System Design` plus its
  summary (in the position a topic shows its section label plus summary), and
  navigates to `/system-design/<slug>`. Its existing `aria-label`, placeholder
  and keyboard behavior are unchanged.

### Seed content (already written before Stage 2 — see Files)

Six question pages, linking all 23 existing `systems-and-infrastructure`
topics. Topic prose is **not** edited by this change.

| order | slug                                     | title                                                                     |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------- |
| 1     | `figuring-out-whats-wrong`               | How do I figure out what's wrong with my system?                          |
| 2     | `database-cant-keep-up-with-reads`       | What do I do when my database can't keep up with reads?                   |
| 3     | `database-cant-keep-up-with-writes`      | What do I do when one database can't keep up with writes?                 |
| 4     | `one-failing-service-taking-down-others` | How do I stop one failing service from taking everything else down?       |
| 5     | `keeping-data-correct-under-concurrency` | How do I keep data correct when many users or services change it at once? |
| 6     | `structuring-services-and-storage`       | How should I structure my services and storage in the first place?        |

Question body convention (documented in `CLAUDE.md`, reviewed by a person or
agent, **not** enforced by a test — it would be brittle across questions of
different shapes): what it looks like → how to confirm it → options, cheapest
first (2–3 sentences each: what it buys, what it costs, when to pick it, then
the link) → how they combine → when it isn't this problem (pointing at a
neighboring question). Zero-background readers must be able to follow it; it
holds to `CLAUDE.md`'s Writing Standard like any topic.

## Explicitly out of scope

- Walkthroughs of whole systems; nothing here should preclude them.
- "Where you'll meet this" sections on topics (a separate content change,
  with its own test once the sections exist).
- New catalog topics (message queues, WebSockets, CQRS, …) and the
  questions that need them (live updates, background work). Those come
  afterward via `add-topic`, each placed under a question.
- Any change to catalog URLs, the home page, `SectionNav`'s behavior, section
  pages, or the existing topics' prose.
- Tags, diagrams/Mermaid, a persistence layer for nav state.
- Restyling the search dialog; changing `searchTopics`.

## Acceptance criteria

Numbered so tests can cite them. "Existing tests" means every test file that
passes on `main` today.

**Loader and content integrity** (`src/lib/system-design.test.ts`,
`src/content/registry.test.ts`)

1. `parseQuestion` returns a `Question` with numeric `order` for valid input,
   and throws — with a message naming the file and the offending field — when
   `title`, `summary`, `date` or `order` is missing; when `order` is `0`,
   negative, non-integer, or non-numeric; and when the path doesn't match
   `/src/system-design/questions/<slug>.md`.
2. `QUESTIONS` is sorted by `order` ascending; `order` values are unique;
   `getQuestion` finds a known slug and returns `undefined` for an unknown one.
3. Every real question has: a title ending in `?`; a one-line non-empty
   `summary`; a `YYYY-MM-DD` `date`; a kebab-case slug
   (`/^[a-z0-9]+(-[a-z0-9]+)*$/`); a non-empty body; and at least one topic
   link.
4. `extractTopicRefs` (fixture strings): returns refs in first-appearance
   order, de-duplicated; ignores an external `https://` link, a single-segment
   link, a `/system-design/x` link, and a link inside a fenced code block;
   strips a `#fragment`; finds a link whose visible text spans two lines.
   `extractQuestionRefs` returns only `/system-design/<slug>` slugs, same
   ordering, de-dup and fenced-code rules.
5. **No dead links:** for every real question, every ref from `extractTopicRefs`
   resolves via `getTopic`, and every ref from `extractQuestionRefs` resolves
   via `getQuestion`.
6. **Coverage, strict, no allowlist:** every topic whose section is
   `systems-and-infrastructure` is returned by `topicsForQuestion` for at least
   one question.
7. `topicsForQuestion` returns resolved `Topic`s in first-appearance order with
   no duplicates and skips an unresolved ref without throwing (fixture-driven
   or via a stub question). `questionsForTopic` returns the linking questions
   in `order`, and `[]` for a topic no question links.
8. `registry.test.ts` additionally asserts no `SECTIONS` slug equals
   `system-design` or `not-found`.

**Search** (`src/lib/search.test.ts`)

9. `searchContent('')` and whitespace return `[]`. A query equal to a real
   question's title returns a `{ kind: 'question' }` result for it; a query
   matching a known topic still returns a `{ kind: 'topic' }` result. `limit`
   is respected. `searchTopics` behaves exactly as before (its existing tests
   still pass).

**Header and tabs** (`Header.test.tsx`, `App.test.tsx`)

10. A `navigation` landmark named `Primary` contains links `Catalog` (`/`) and
    `System Design` (`/system-design`) at every route.
11. At `/`, `/ai-and-ml`, `/ai-and-ml/prompt-engineering`, and `/not-found`,
    `Catalog` has `aria-current="page"` and `System Design` does not. At
    `/system-design` and `/system-design/<a real slug>`, the reverse.
12. The logo link named `til` still goes to `/`, and the home page at `/` is
    unchanged (existing tests pass).

**System Design landing** (`App.test.tsx`)

13. `/system-design` renders exactly one `h1` named `System Design` and one link
    per real question (name contains the question title), in `order`, each with
    its summary text visible and `href` ending `/system-design/<slug>`.

**Question page** (`App.test.tsx`)

14. `/system-design/<a real slug>` renders exactly one `h1` with that question's
    title, a `← System Design` link to `/system-design`, and the body content.
15. Links to topics inside the body navigate to the catalog topic page
    (`/section/slug`), and following one renders the topic's `h1` with
    `Catalog` current.
16. A "Go deeper" `h2` is present with one link per topic in
    `topicsForQuestion`, each followed by that topic's `summary`; the same
    topic is never listed twice.
17. Prev/next links point at the questions adjacent by `order`; the first
    question has no prev, the last has no next.
18. `/system-design/does-not-exist` shows the not-found page.

**Navigation** (`QuestionNav.test.tsx`, `App.test.tsx`, `MobileNav.test.tsx`)

19. On `/system-design` and any `/system-design/<slug>`, the persistent sidebar
    is `navigation` named `Questions` (and there is no `Sections` navigation);
    on `/`, a section page, a topic page and `/not-found` it is `Sections` (and
    no `Questions` navigation). Existing `SectionNav` tests pass unmodified.
20. `QuestionNav` lists every question in `order`; each has an
    expand/collapse button with `aria-expanded` and an `aria-controls` that
    resolves to its topic list, whose items are links to
    `/section/slug` with topic titles. At `/system-design/<slug>` only that
    question starts expanded and its link has `aria-current="page"`; at
    `/system-design` none is expanded. Clicking a button toggles that question
    only. Navigating from one question to another expands the new one and
    leaves the first as the user left it. A collapsed list's links are not in
    the accessibility tree (`hidden`).
21. `MobileNav`, opened on a system-design route, renders the same question
    tree inside `role="dialog"` named `Navigation`, and closes on link click;
    on a catalog route it renders `SectionNav` as today (existing tests pass).

**Topic page back-links** (`App.test.tsx`)

22. A topic linked from ≥1 question shows a `navigation` named
    `Questions this topic comes up in` with the text `This comes up in:` and one
    link per linking question (title, in `order`) to `/system-design/<slug>`,
    placed after the article body. A topic no question links (a fixture-free
    check: pick any non-systems topic, e.g. `ai-and-ml/prompt-engineering`, if
    it is unlinked — otherwise assert the negative via `questionsForTopic`)
    renders no such navigation.

**Search dialog** (`SearchDialog.test.tsx`, `App.test.tsx`)

23. Typing a real question's title shows it as a result labelled
    `System Design`; activating it navigates to `/system-design/<slug>` and
    closes the dialog. Typing a topic query still behaves as before.

**Cross-cutting**

24. `npm run typecheck && npm run lint && npm run format:check`,
    `npm run check:colors && npm run check:tokens && npm run check:npm-refs`,
    `npm run test:run`, `npm run build` and `npm run size` all pass. If the
    new lazy `QuestionPage` shares a chunk with `TopicPage` no budget changes;
    if it produces its own chunk, add a `size-limit` entry for it; if the main
    chunk needs more room, raise its limit deliberately with the reason stated.
    Nothing may reference a raw hex color; new styling uses existing tokens.
25. **Accessibility (`docs/DESIGN.md` checklist), verified in the UI review:**
    every new control is keyboard reachable with a visible focus ring; the
    active tab and current question aren't signalled by color alone; both
    themes; one `h1` per page and no skipped heading levels; no horizontal
    page scroll at 375 px; tabs visible at that width.

## Files

**Seed content, written before Stage 2** (present in the tree when tests are
written; the implementer does not rewrite it):
`src/system-design/questions/*.md` — the six above.

**New:** `src/lib/system-design.ts`, `src/pages/SystemDesignPage.tsx`,
`src/pages/QuestionPage.tsx`, `src/components/QuestionNav.tsx`, a shared
expand/collapse hook (e.g. `src/hooks/useExpandedGroups.ts`), and the test
files under Acceptance criteria.

**Edited:** `src/types.ts`, `src/lib/search.ts`, `src/components/Header.tsx`,
`src/components/MobileNav.tsx`, `src/components/SectionNav.tsx` (use the shared
hook only), `src/components/SearchDialog.tsx`, `src/pages/TopicPage.tsx`,
`src/App.tsx`, and `package.json` only if `size-limit` needs it.

**Docs, skills and evals (owned by the implementer, independently checked in
review):**

- `CLAUDE.md` — Content architecture (the new `src/system-design/questions/`
  folder, its frontmatter contract incl. `order`, and that the loader and
  `registry.test.ts` are separate); "Adding a topic" (a new
  `systems-and-infrastructure` topic must be linked from a question or the
  coverage test fails); Writing standard (question pages route and compare
  rather than re-explain a mechanism; snippets state what an option buys, what
  it costs and when to pick it); "What's deliberately not built here" (the
  domain split and tracks/reading-paths items no longer apply as written —
  update them accurately: the question layer is a bounded exception, tags,
  interactive step-through pages, Mermaid, e2e tests and an in-app editor stay
  out).
- `docs/DESIGN.md` — header tabs, `QuestionNav`, the non-color active signal,
  narrow-width tab behavior.
- `README.md` — Features list.
- `.claude/skills/add-topic/SKILL.md` — a step: a new
  `systems-and-infrastructure` topic gets placed under a question (the
  coverage test enforces it).
- `.claude/skills/content-audit/SKILL.md` — include `src/system-design/`;
  add a check that snippets don't re-teach a mechanism and that no fact is
  stated in two places.
- `.claude/skills/docs-audit/SKILL.md` and `.claude/skills/feature/SKILL.md`
  (Stage 4's topic-content clause) and `.claude/hooks/nudge-sdlc.js` — mention
  `src/system-design/` where they name `src/content/`.
- **New eval** `evals/system-design-navigation/` (`scenarios.md`,
  `HOW_TO_RUN.md`, `results/`) plus a wrapper skill
  `.claude/skills/system-design-navigation-eval/SKILL.md`, following the
  existing `content-review`/`skill-routing` pattern and updating
  `evals/README.md`. About 15 symptom scenarios: a fresh subagent given only a
  symptom must reach the right question and topic(s); include cases that are
  ambiguous by design (grade defensible reasoning), and a control whose right
  answer is "no question covers this" — pick one permanently out of scope
  (e.g. choosing a frontend framework), not one a future question will cover.
  Record how to re-check when the question set changes.
- `evals/skill-routing/scenarios.md` and
  `.claude/skills/skill-routing-eval/SKILL.md` (its Stage 1 skill list) — a
  scenario for the new skill, per `evals/README.md`.

## Has a user-facing UI surface

Yes: the header tabs, the System Design landing and question pages,
`QuestionNav`, the topic-page back-links and the search dialog. Stage 4 must
drive it in a real browser — both themes, a 375 px viewport, keyboard-only
navigation, the console clean, and the deployed base path (`/til/`).

## Later, in order

1. **"Where you'll meet this"** on the 23 systems topics (a content change with
   its own reviewer pass; a "every systems topic has this heading" test lands
   after the sections exist, not before).
2. **Missing catalog topics** — message queues, worker pools, workflow engines,
   WebSockets / server-sent events / long polling, CQRS, caching basics, read
   replicas, async writes, batching, self-healing — each via `add-topic`, each
   placed under a question, plus the questions that need them (live updates,
   background work).
3. **Walkthroughs** — open; only if wanted.
