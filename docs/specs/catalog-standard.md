# Spec: catalog standard, a "Working with Coding Agents" section, and redirects

Approved 2026-10-07.

## Context

The 2026-10-06 catalog investigation found four things:

- two pairs of topics that overlap;
- four ai-and-ml topics that are really about working with coding agents;
- older topics written in a voice that predates the Writing Standard's newer rules;
- titles that follow five different patterns.

The user approved the recommendations:

- a lighter catalog standard: at most about 1,000 words (aim for 600–900), the lecturer voice with one running example, a closing rule of thumb, and one title pattern;
- move the four agent topics into a new section;
- keep Focus & Attention;
- merge `session-vs-token-auth` into `jwt`, and `dead-letter-queue` into `message-queues`;
- do this after the case studies and DSA entries, which is now.

Rule: catalog URLs keep working. Moving or merging a topic must not break a bookmark, which is the best practice for a reference site.

This spec covers the infrastructure and the moves: the standard, the checks, the new section, the redirects and the docs. The prose rewrites (merges, trims, expansions, voice and titles across about 55 topics) follow as reviewed content batches, using the conventions this spec sets up.

## Design

**1. The catalog standard.**

- docs/writing-standard.md gains a "Catalog topics" section next to "Case studies and DSA entries". It covers:
  - the budget;
  - the lecturer voice;
  - one running example;
  - a closing `**Rule of thumb.**` paragraph;
  - the title pattern: a plain noun phrase or "X vs. Y", "and" never "&", no "What is…", no colon subtitle.
- `src/lib/reading-time.ts` exports `CATALOG_WORD_BUDGET = 1000` beside `WORD_BUDGET`.

**2. A topic-structure test.** New file: `src/content/topic-structure.test.ts`, which parses each topic with the shared `markdownParser()` / `proseWordCount`. It checks:

- prose word count is at most `CATALOG_WORD_BUDGET`;
- the title matches the pattern;
- exactly one paragraph opens with bold `Rule of thumb.`, and it is the body's last block, or the last block before `## Where you'll meet this` in systems-and-infrastructure.

**Rollout without a frontmatter switch.**

- The test holds a pinned `PENDING` list of `section/slug` paths that are not yet on the catalog standard, and skips the checks for those.
- It fails when a listed path no longer exists (a stale entry).
- It fails when a listed topic already passes every check, so the entry has to be removed. This keeps the list honest.
- The list starts as every current topic. Each content batch removes the entries it rewrites, and the last batch deletes the list and its handling.
- This is an allowlist of exceptions that can only shrink, per /feature Stage 1's guard rule.

**3. A "Working with Coding Agents" section.**

- `registry.ts` gains `{ slug: 'coding-agents', label: 'Working with Coding Agents', description: … }`, placed after `ai-and-ml`.
- These four files move unchanged with `git mv`: `context-is-a-budget`, `documentation-vs-skill-vs-hook`, `keeping-ai-native-docs-from-going-stale`, `triaging-ai-code-review`.
- Links to them, including the six links among themselves, are repointed.
- The section labels drop "&" for "and" to match the title rule. Slugs don't change.

**4. Redirects.**

- `src/content/redirects.ts` exports a map from old `section/slug` to new `section/slug`.
- `TopicPage` checks it before falling back to `/not-found` and does `<Navigate replace>` to the new path. On a hard load this works through the existing `public/404.html` bounce.
- A test checks that every source is not a live topic, every target is a live topic, and no chain or cycle exists.
- The map's entries:
  - this spec: the four moves;
  - the merge batch: `security/session-vs-token-auth → security/jwt` and `systems-and-infrastructure/dead-letter-queue → systems-and-infrastructure/message-queues`.
- docs/content.md gains "Moving, merging or renaming a topic". It says to `git mv` the file, repoint links (the dead-link test, `catalog-gaps.test.ts`, catches misses), and add a redirect entry. Redirects are never removed.
- The stale `?p=` comment in `index.html` is fixed to say sessionStorage.

**5. Process.**

- `add-topic` gains a rewrite mode (rewriting an existing topic to the catalog standard, removing its `PENDING` entry) and a batch mode, mirroring add-case-study's.
- The checklist and the review hold the catalog standard.
- `content-audit`'s description excludes "a rewrite of a topic to the catalog standard", as it did for case studies.

## Acceptance criteria

1. **Constant.** `CATALOG_WORD_BUDGET` is exported and equals 1,000.
2. **Topic-structure checks.** For a topic not on `PENDING`, each rule has a planted failing case built from one passing fixture body:
   - over budget (1,001 words fails, 1,000 passes);
   - a title starting "What is";
   - a title with a colon subtitle;
   - a title with "&";
   - no `Rule of thumb.` paragraph;
   - two of them;
   - a rule paragraph that isn't last;
   - in systems-and-infrastructure, a rule paragraph after `Where you'll meet this`.
3. **`PENDING` rules.**
   - A listed path that doesn't exist fails, naming it.
   - A listed topic that passes every check fails, naming it.
   - Every real topic passes today, because the list is complete.
4. **New section.** The section exists in the registry and on disk, holds the four topics, sits third in the home page and sidebar, right after `ai-and-ml`, and keeps its own prev/next order.
5. **Labels.** No section label contains "&", and the slugs are unchanged.
6. **Redirects.**
   - Each old URL `/ai-and-ml/<moved-slug>` renders the topic at `/coding-agents/<slug>`, and the browser URL is the new one (`replace`).
   - An unknown slug still goes to `/not-found`.
   - The redirect-map test passes and fails as described in design §4, with planted cases.
7. **No dead links.** `catalog-gaps.test.ts` passes with the four topics moved.
8. **Docs.** docs/writing-standard.md, docs/content.md, the add-topic SKILL.md and checklist, and content-audit's description describe the new conventions. docs/DESIGN.md is updated if it names sections. `check:claude-md`, `check:npm-refs` and `format:check` pass.

## Scope

**In:**

- `reading-time.ts`;
- the new test, with its `PENDING` list;
- `registry.ts` and its test;
- the four `git mv`s and their link repoints;
- `redirects.ts` and its test;
- `TopicPage.tsx`;
- `index.html`'s comment;
- the docs and skills named above.

**Out:**

- any prose rewrite, including the two merges, which belong to the content batches;
- topic prev/next ordering;
- case-study and DSA content;
- `prompt-engineering`, which stays in ai-and-ml (tests pin it).

**UI surface:** small. The new section appears on the home page and in the sidebar, the labels change, and redirects happen. Stage 4 checks both themes and 375px on the home page, the sidebar and one redirected URL.

**Roles (who proves what):**

- **Stage 2 test-writer:** writes criteria 1, 2, 3, 4, 5, 6 and 7 as tests.
- **Stage 3 implementer:** does the code, the moves, the docs (criterion 8) and the redirects.
- **Orchestrator at Stage 5:** runs `skill-routing-eval` for add-topic's and content-audit's edits, and `content-review-eval` for the Writing Standard and checklist edits, as listed under Verification.

## Non-negotiables check

- **#1:** the redirect is a client navigation with no focus trap, and the new section reuses existing components.
- **#2:** no new colors.
- **#3:** the redirect map is a few strings, so the bundle stays within budget.
- **#4:** no prose changes beyond links and labels.
- Nothing conflicts.

## Verification

- **Stage 2:**
  - The new topic-structure test passes on real content, because everything is on `PENDING`.
  - The planted cases are red until the implementation exists.
  - The section and redirect tests are red.
- **Stage 3:** `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:**
  - a browser check of the home page, the sidebar and `/til/ai-and-ml/context-is-a-budget` redirecting, in both themes and at 375px;
  - try a stale `PENDING` entry, a redirect cycle, and a redirect to a missing topic in a copy.
- **Stage 5:**
  - `skill-routing-eval`: SR-02, SR-04, SR-06, SR-11 and SR-16;
  - `content-review-eval`: the CR-* scenarios, because the Writing Standard and add-topic's checklist change.

## Review decisions

- **Fix with a test (4a round 1):**
  - A redirect keeps the URL's `?query` and `#hash`.
  - `catalog-gaps.test.ts` also checks catalog links in DSA entry bodies, as docs/content.md says.
  - The redirect-map test requires each source to have the shape `section/slug` (no leading slash, no `.md`) with a registered section.
  - The title check also rejects "What's …", a dash subtitle ("X — Y") and a parenthetical subtitle ("X (Y)"). The Writing Standard says "no subtitle of any kind". The one current title with a parenthetical stays on `PENDING` until its rewrite.
- **Fix, no new test:**
  - The content-review fixtures CR-01..05 each gain a closing `**Rule of thumb.**` paragraph, so the control stays clean and each planted violation stays the only one.
  - The Writing Standard's "about four minutes" becomes accurate for 1,000 words (the label shows 5).
  - docs/content.md:
    - says adding a section also updates `registry.test.ts`'s pinned order and labels, and that a label uses "and";
    - lists `redirects.test.ts` in the file tree;
    - says moving a topic back to an old path means deleting that redirect entry.
  - add-topic's "Batch mode" becomes its own block.
- **Round 2, fix with a test.** The title check:
  - allows a trailing all-caps acronym gloss in parentheses ("Cross-Site Scripting (XSS)", "JSON Web Tokens (JWT)"), which is standard naming and not a subtitle;
  - rejects a `--` subtitle dash.
- **Round 2, fix with no new test:**
  - CR-02's rule of thumb narrows to release flags, so it doesn't contradict its own kill-switch bullet (the reviewer rated this Medium; the triager called it a mild tension);
  - `reading-time.ts`'s `CATALOG_WORD_BUDGET` comment matches the Writing Standard;
  - the Writing Standard's title rule names the acronym exception.
- **After round 2, known limitations.** All four are Low and left for the user:
  - An all-caps word in parentheses ("(WIP)", "(BETA)") passes as an acronym gloss; Stage 3's review is the backstop.
  - The gloss regex accepts letters only (2–6 plus an optional "s"), so "(S3)" and "(P2P)" fail. This fails safe, with a visible test failure, and the Writing Standard says "all-caps acronym".
  - Rarer dash characters (Unicode minus, figure dash, "-X" without a space) and an unbalanced or bracketed subtitle aren't caught (theoretical).
  - CR-02's rule of thumb uses "release flag" without defining it. Watch for it in the Stage 5 content-review run.
- **Correction:** two current titles have a parenthetical subtitle, not one: `coding-agents/keeping-ai-native-docs-from-going-stale` and `focus-and-attention/why-you-cant-focus-anymore`. Both stay on `PENDING` until their rewrite.
