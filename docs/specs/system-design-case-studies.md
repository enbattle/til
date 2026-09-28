# Spec: System Design case studies (replaces the question pages)

Status: approved 2026-09-28. Feature 1 of 2; the DSA tab is a separate `/feature` run afterwards.

## Context

The System Design tab currently holds 9 symptom-first "question" pages (`src/system-design/questions/*.md`) that route readers into `systems-and-infrastructure` topics. The user wants the tab rebuilt as **design case studies** (URL shortener, social feed, messaging, … 16 in total, agreed in conversation) that teach the standard approach: requirements → estimates → data model → API → architecture diagram → deep dives → failure modes → trade-offs. None of the question content carries over. The 34 catalog topics must not be touched or lost. Case studies link to catalog topics **where the explanation uses them**; covering every catalog topic is explicitly _not_ a goal. Diagrams must be high quality: D2, rendered at build time to static, theme-aware SVGs (the user approved this after a comparison).

This run ships the **infrastructure plus one complete reference case study (URL shortener)** and an `add-case-study` skill. The remaining 15 case studies are added afterwards, one skill run each, so every one gets its own independent content review.

## Scope

**In**

- Delete all 9 question pages, the question loader, `QuestionPage`, `QuestionNav` and their tests.
- Add a case-study content type, loader, landing page, case-study page, sidebar and search entries.
- Add build-time D2 diagrams: a render script, a theme generated from the site's tokens, a staleness/safety check, and themed `<img>` rendering.
- Replace "This comes up in:" on topic pages with a case-study back-link list.
- Write the URL shortener case study with at least 2 diagrams.
- Add an `add-case-study` skill; extend the `content-review` eval with case-study scenarios; retire the `system-design-navigation` eval and its skill.
- Update docs: CLAUDE.md, README, DESIGN.md, evals/README, the add-topic/content-audit/docs-audit skills, and skill-routing scenarios that mention questions. Mark `docs/specs/system-design.md` as superseded at the top rather than deleting it.

**Out**

- The other 15 case studies (follow-up skill runs).
- The DSA tab (Feature 2).
- Edits to any file under `src/content/`.
- Interactive diagrams (pan/zoom).
- D2 in CI (CI only checks the committed SVGs).

## Design

### Content and loading

- Files: `src/system-design/case-studies/<slug>.md`. Frontmatter is flat, as today: `title` (e.g. `Design a URL Shortener (like TinyURL)`), `summary`, `date`, `order` (a unique positive integer, validated like today's `parseQuestion`).
- **Bodies are lazy** (unlike questions). Frontmatter is eager via the existing `?meta` plugin (`vite.config.ts` `markdownMeta`), reused as-is. The body is its own chunk, loaded with the same `createBodyStore` from `src/lib/content.ts` (export or generalize it; don't copy it).
- **Topic links are extracted at build time**, so the sidebar, "Go deeper" and topic back-links work without loading bodies. Add a Vite query (e.g. `?links`) served by a plugin that runs the existing `extractTopicRefs` logic (moved from `src/lib/system-design.ts` into a pure module importable from `vite.config.ts`, as `frontmatter.ts` already is).
- `src/lib/system-design.ts` is rewritten around `CASE_STUDIES`, `getCaseStudy`, `loadCaseStudyBody`, `topicsForCaseStudy` and `caseStudiesForTopic`. The `Question` type is replaced by `CaseStudy` (metadata only, no body). `isSystemDesignPath` is kept.

### Routes and UI (same URLs as today)

- `/system-design` is the landing page: title "System Design" and an intro sentence, then the case studies in `order`, each a card showing its number, title and summary.
- `/system-design/:slug` is `CaseStudyPage` (lazy, like `QuestionPage`). It shows:
  - a back link and an `h1` with the date;
  - a **Contents** list of the body's `##` headings as in-page anchor links (h2s get stable slug ids through the `MarkdownRenderer` heading override);
  - the body (loaded like `TopicBody` in `TopicPage.tsx`);
  - **Go deeper**, generated from the links, as today;
  - prev/next navigation by `order`.
- An unknown slug goes to not-found.
- The sidebar becomes `CaseStudyNav`, a flat ordered list of case-study links with the same current-page signal as today (`aria-current`, bold, accent border). There's no disclosure/expansion, since each page has its own Contents list. `SideNav` in `App.tsx` and `MobileNav` swap `QuestionNav` for it.
- `TopicPage`: "This comes up in:" becomes **"Used in these case studies:"**, listing the case studies that link to the topic, in `order`. It's hidden when there are none (most topics, for now).
- The header tabs are unchanged.

### Search

- `SearchResult` gains `{ kind: 'caseStudy' }` in place of `question`.
- Case-study title and summary are searchable immediately. Their bodies join the full-text load (the same `ensureFullTextSearch` path as topic bodies).
- A result navigates to `/system-design/<slug>` and is labelled "System Design", as questions are today.

### Diagrams (D2)

- **Source:** `src/system-design/diagrams/<case-slug>/<name>.d2`, one diagram per file.
- **Render:** `npm run diagrams` (`scripts/render-diagrams.mjs`) requires `d2` v0.9.x on PATH and fails with install instructions otherwise. It renders every source to `public/diagrams/<case-slug>/<name>.light.svg` and `.dark.svg`.
- **Theme:** colors come from the `--color-*` tokens in `src/index.css`, read at render time and injected as D2 theme overrides. `.d2` files contain no hex colors, and diagrams match the site palette in both themes.
- **Lock file:** the render script also writes `public/diagrams/manifest.json`, which records each source's content hash.
- **Guard:** `npm run check:diagrams` runs in `verify` and doesn't need d2. It fails when:
  - a `.d2` has no manifest entry, or its hash differs (edited without re-rendering);
  - a rendered SVG is missing, or orphaned without a source;
  - an SVG contains `<script`, an `on*=` attribute, or an external `http(s)` `href` / `xlink:href`;
  - a case study references `/diagrams/...` that doesn't exist.
- **In markdown:** `![Alt text describing the diagram](/diagrams/url-shortener/architecture.svg)`. `MarkdownRenderer` gets an `img` override for `/diagrams/` paths only: it renders `<img>` pointing to the `.light` or `.dark` file based on `useTheme().resolved`, prefixed with `import.meta.env.BASE_URL`, with `alt`, `loading="lazy"` and width/height to avoid layout shift. It's wrapped in a link that opens the full-size SVG in a new tab (`rel="noreferrer"`), with an accessible name like "Open diagram full size". No raw HTML, no `innerHTML`.

### Case study page structure (enforced by test)

Each case study's `##` headings, in this order:

1. `Requirements`
2. `Back-of-the-envelope estimates`
3. `Data model`
4. `API design`
5. `High-level architecture`
6. at least two `Deep dive: <topic>`
7. `Failure modes and bottlenecks`
8. `Trade-offs`

`High-level architecture` contains at least one `/diagrams/` image. Catalog links go in wherever the prose uses a topic; there's no coverage requirement. Titles and prose describe a plausible design ("a URL shortener like TinyURL"), never claims about how a specific company builds its system (Writing Standard).

### URL shortener content

Written to the Writing Standard. It covers:

- **Requirements:** shorten, redirect, optional custom alias and expiry; analytics as a stretch goal; explicit out-of-scope list; non-functional targets with numbers.
- **Estimates:** worked arithmetic for write/read QPS, peak, 5-year storage, cache memory. Links `numbers-every-engineer-should-know` and `latency-vs-throughput`.
- **Data model:** justified with `sql-vs-nosql`.
- **API:** `POST /urls`, `GET /{code}`, 301 vs 302.
- **Architecture:** a diagram and a follow-one-request walkthrough.
- **Deep dives:**
  - short code generation (hashing + collisions vs counter + base62 vs pre-generated key ranges);
  - read path (`caching`, `cache-invalidation`, `thundering-herd-problem`, `read-replicas`);
  - analytics off the hot path (`message-queues`, `batching-and-asynchronous-writes`).
- **Failure modes:** `rate-limiting` for abuse, `observability`.
- **Trade-offs.**
- **Diagrams:** architecture, plus a redirect sequence diagram.
- Every technical claim verified.

### Process artifacts (AI developer experience)

- **`add-case-study` skill** (`.claude/skills/add-case-study/SKILL.md`), modeled on `add-topic`:
  - Stage 1: draft to the template, author the diagrams, `npm run diagrams`.
  - Stage 2: `npm run verify`.
  - Stage 3: an independent fresh-agent review against the Writing Standard plus a case-study checklist. Estimates must be arithmetically consistent and follow from the stated requirements. Each deep dive compares at least two options with what each costs. Diagrams must match the prose. Every catalog link must be used where the concept appears.
  - Re-review capped at 2 rounds.
- **`evals/content-review`:** add case-study scenarios: a draft with an arithmetic error in the estimates, a deep dive that picks an option without comparing alternatives, and a clean control.
- **Retire** `evals/system-design-navigation/` and `.claude/skills/system-design-navigation-eval/`, removing them from `evals/README.md`'s table. They test question routing, which no longer exists.
- **CLAUDE.md:** replace the "System Design questions" section with "System Design case studies" (layout, frontmatter, template, diagrams workflow, linking rule). Remove the question-coverage rule from "Adding a topic". Update "What's deliberately not built" (D2 diagrams are now built; Mermaid is still out). Update "Verifying a change" (`check:diagrams`, `npm run diagrams` and the d2 install).

## Acceptance criteria (become Stage 2 tests)

1. `src/system-design/questions/` no longer exists. Nothing under `src/` imports a question module, and `/system-design/database-cant-keep-up-with-reads` shows not-found.
2. Every file under `src/content/**/*.md` is byte-identical to `main`. This is a gate, checked by `git diff --stat main -- src/content` being empty.
3. `parseCaseStudy` (or equivalent) returns slug/title/summary/date/order. It throws naming the file and field when any of the four is missing, when `order` isn't a positive integer, or when the path isn't `/src/system-design/case-studies/<slug>.md`. `order` values are unique across real case studies.
4. `CASE_STUDIES` is sorted by `order`. `getCaseStudy('url-shortener')` returns it, and an unknown slug returns undefined.
5. A case study's body is not in the main chunk (`check:bundle` is extended to cover `src/system-design/case-studies/`). `loadCaseStudyBody` returns the body without frontmatter and rejects for an unknown slug.
6. `topicsForCaseStudy` and `caseStudiesForTopic` work from build-time link data, without loading any body. A test fails on a case-study link to a nonexistent topic or case study. There is **no** test requiring every systems topic to be linked.
7. `/system-design` lists every case study in `order`, each linking to `/system-design/<slug>` with its title and summary visible.
8. `/system-design/url-shortener`:
   - has exactly one `h1` (the title);
   - a Contents nav whose links point to `#<id>` of each body `##` heading, in order, and those ids exist in the rendered body;
   - a Go deeper list matching `topicsForCaseStudy`;
   - prev/next links only when neighbors exist.
9. On System Design routes the sidebar and MobileNav show `CaseStudyNav`: one link per case study in order, with `aria-current="page"` on the current one. Other routes show `SectionNav`.
10. A topic linked from a case study (e.g. `/systems-and-infrastructure/caching`) shows "Used in these case studies:" with a link to `/system-design/url-shortener`. A topic no case study links shows no such list.
11. Search finds the URL shortener by title immediately, and by a body-only phrase after full-text loading. Selecting it navigates to `/system-design/url-shortener`.
12. Structure test: every case study has the `##` headings in the order above (at least two `Deep dive:` headings), and at least one `/diagrams/` image inside High-level architecture.
13. A markdown `/diagrams/x/y.svg` image renders an `<img>` with `src` ending `x/y.light.svg` in light theme and `x/y.dark.svg` in dark theme, prefixed with the base path, keeping its `alt`, wrapped in a new-tab `rel="noreferrer"` link. Other images render unchanged.
14. `check:diagrams` passes on the repo. Planted-regression tests in `scripts/checks.test.mjs` show it exits non-zero for each of:
    - an edited `.d2` without re-render;
    - a missing `.dark.svg`;
    - an orphan SVG;
    - an SVG containing `<script>`;
    - an SVG with an `onload=` attribute;
    - an SVG with an external `href`;
    - a case study referencing a nonexistent diagram.
15. `check:colors`, `check:raw-html`, `check:contrast` and `check:tokens` stay green. `npm run verify` passes, and no size budget is raised. The main chunk should shrink, since question bodies were eager.

## UI surface

Yes: landing page, case study page, sidebar/mobile nav, topic back-link, search, diagrams. Stage 4 does a browser check in both themes at 375px, including a wide diagram and the Contents list.

## Non-negotiables check (docs/NON_NEGOTIABLES.md)

No conflicts.

- #1: Accessibility is covered by UI criteria and the browser review; diagrams have alt text plus a prose walkthrough.
- #2: Diagram colors are generated from tokens, and `.d2` files have no hex.
- #3: No budget raise is expected.
- #4: Writing Standard.
- #6: Diagrams use `<img>` only, no raw HTML or `innerHTML`, and `check:diagrams` rejects script/handlers in SVGs.
- #7: The diagram link is `rel="noreferrer"`; no runtime third-party scripts.
- #11: Nothing is committed without the user's go-ahead.

## Critical files

- **Delete:**
  - `src/system-design/questions/*`
  - `src/pages/QuestionPage.tsx`
  - `src/components/QuestionNav.tsx` (+ test)
  - `src/App.system-design.test.tsx`, `MobileNav.system-design.test.tsx`, `SearchDialog.questions.test.tsx`, `src/lib/system-design.test.ts` (Stage 2 rewrites or replaces these)
  - the question parts of `src/lib/catalog-gaps.test.ts`
- **Rewrite:** `src/lib/system-design.ts`, `src/pages/SystemDesignPage.tsx`, `src/types.ts`
- **Edit:** `src/lib/search.ts`, `src/components/SearchDialog.tsx`, `src/pages/TopicPage.tsx`, `src/components/MarkdownRenderer.tsx`, `src/App.tsx`, `src/components/MobileNav.tsx`, `vite.config.ts`, `scripts/check-bundle.mjs`, `package.json`
- **New:**
  - `src/pages/CaseStudyPage.tsx`, `src/components/CaseStudyNav.tsx`, `src/components/Diagram.tsx`
  - `src/lib/markdown-links.ts`
  - `scripts/render-diagrams.mjs`, `scripts/check-diagrams.mjs`
  - `src/system-design/case-studies/url-shortener.md`, `src/system-design/diagrams/url-shortener/*.d2`, `public/diagrams/**`
  - `.claude/skills/add-case-study/SKILL.md`
- **Reuse:**
  - `createBodyStore` and the `?meta` plugin (`src/lib/content.ts`, `vite.config.ts`)
  - `extractTopicRefs` / `stripFencedCode` (moved, not rewritten)
  - `useTheme`, `useExpandedGroups` (no longer needed by the new nav; keep it for `SectionNav`)
  - the `TopicBody` loading pattern

## Pipeline and verification

- **Stage 2:** a fresh test-writer writes and rewrites the tests above, deletes the obsolete question tests, and writes the planted-regression cases for `check:diagrams`. Gate: only test files and fixtures changed; the new tests are red. Then lock the tests.
- **Stage 3:** a fresh implementer does the code, diagrams (it has d2 v0.9.0 installed locally via scoop), the URL shortener content, skills/evals and docs. Gate: `check:test-lock --verify`, `npm run verify`, `git diff --stat main -- src/content` empty. Plant a regression in a scratch copy to see `check:diagrams` fail.
- **Stage 4:** a fresh reviewer gets the diff, spec and NON_NEGOTIABLES, and drives the dev server in the browser (both themes, 375px, the diagram full-size link, Contents anchors, search, the topic back-link). The case-study prose is held to the Writing Standard.
- **Stage 5/6:** final `verify`, handoff, retro, pipeline-log row. No commit without the user's go-ahead. Work happens on a branch `feature/system-design-case-studies`.

## As built

Deviations and choices the spec left open, recorded by Stage 3:

- **Diagram sizes.** The manifest records each diagram's `width`/`height`
  next to its `sha256`. A small Vite plugin in `vite.config.ts`
  (`virtual:diagram-sizes`) exposes just the sizes to the app, so `Diagram`
  can set `width`/`height` without bundling the hashes or importing from
  `public/`. A `/diagrams/` image with no manifest entry renders unsized.
- **One loading component.** `TopicBody`'s load-then-render logic moved into
  `src/components/LazyBody.tsx`, used by both `TopicPage` and `CaseStudyPage`,
  instead of a second copy. Heading ids and the Contents list share
  `src/lib/headings.ts` (`headingId`, `h2Headings`).
- **`?links` lives in the existing `markdownMeta` plugin** (same load hook,
  second query) rather than a separate plugin.
- **Render script extras.** `render-diagrams.mjs` checks WCAG AA (4.5:1) for
  D2's text slots on every fill slot in both themes before rendering, refuses
  `.d2` files that set `fill`/`stroke`/`font-color`, and strips D2's
  `mix-blend-mode: multiply` from group frames (it turned sequence-diagram
  groups near-black on the dark canvas). `check:colors` now also scans `.d2`
  files for hex.
- **Link label.** The full-size diagram link's accessible name is
  "Open diagram full size: <alt text>". (Round 2: the scroll region's name no
  longer repeats the alt text.)
- **Catalog link path.** "Numbers every engineer should know" lives in
  `engineering-practices`, so the URL shortener links
  `/engineering-practices/numbers-every-engineer-should-know`.
- **Retired eval.** Deleting `evals/system-design-navigation/` removed its
  three dated result logs with it. `skill-routing` scenario SR-13 (which
  routed to that eval) is marked retired rather than renumbered, and SR-15
  routes a new case study to `add-case-study`.
- **Main chunk:** 101.54 KB → 90.58 KB brotlied (limit unchanged at 104 KB).
  MarkdownRenderer chunk: 81.35 KB → 81.84 KB (limit 95 KB).

Review fixes (Stage 4a, same run):

- **Manifest locks tokens and SVG bytes.** The manifest gained a reserved
  `$tokens` key (the `--color-*` values, per theme, that render-diagrams maps
  into the D2 theme) and a per-entry `svgs` map of each themed SVG's hash.
  `check:diagrams` fails when either drifts, and also re-checks the WCAG 4.5:1
  text-on-fill pairs from the tokens in CI. The token reading, slot mapping,
  contrast check, `.d2` color guard and SVG allowlist live in
  `scripts/diagram-manifest.mjs`, shared by both scripts. The `diagram-sizes`
  Vite plugin reads only the `.d2` entries.
- **SVG safety is an allowlist,** not pattern-matching: a strict tokenizer
  accepts only the elements and attributes d2 v0.9 emits (plus a few inert
  shape elements), no animation elements, no character references in
  attribute values, `href`/`url()` only to `#fragment`s, and inside `<style>`
  only an `@font-face` whose `url()` is an embedded `data:` font. (Round 2
  tightened this further; see below.)
- **`.d2` color guard** moved into `check:diagrams` (CI), catching any color or
  theme key by any D2 syntax; `render-diagrams.mjs` calls the same function.
- **Heading ids** are set by a small rehype pass in `MarkdownRenderer`,
  numbered with `createHeadingIds` (duplicates become `notes`, `notes-1`);
  `h2Headings` returns `{ text, id }` through the same numbering, and the
  Contents list is keyed by id.
- **Scroll margin** follows the header: `Header` publishes its measured height
  as `--header-height` (a `ResizeObserver`), and headings use it plus 0.75rem
  (8rem before it's set), since the header is ~68px from `sm` up, ~105px at
  375px and taller still at 320px.
- **Phone diagrams** keep at least 75% of their rendered width inside their
  own horizontally scrolling box, which is a focusable labelled region only
  while it overflows.
- **Sizes after the fixes:** main chunk 90.64 KB brotlied (limit 104 KB),
  MarkdownRenderer chunk 82.24 KB (limit 95 KB); no limit raised.

Review fixes, round 2 (Stage 4a):

- **SVG values and CSS are allowlisted too (M1).** Policing only `url(` let
  `image-set()`, `-webkit-image-set()`, an escaped `u\72l(` and a root
  `background-image` load external images from an SVG opened as a document.
  Now any backslash, quote or character reference in an attribute value
  fails; the only function allowed in one is `url(#fragment)` (and numeric
  transform functions in `transform`); a `style` attribute may set only a
  short list of numeric or keyword properties, taken from what d2 v0.9 emits
  (`stroke-width`, `stroke-dasharray`, `text-anchor`, `font-size`) plus a few
  of the same kind, with plain-token values. In `<style>`, once d2's
  `@font-face` blocks (one embedded base64 `data:` font each) and its
  `font-family: "<name>"` declarations are set aside, any at-rule, quoted
  string, function or escape fails.
- **Diagram HTML nesting (M2).** A diagram on its own line renders without its
  `<p>` (a `p` override checks the paragraph's hast node), and the diagram's
  box is a block `span`, so no block sits inside a `<p>`.
- **`#section` URLs (L1).** `LazyBody` scrolls the element named by the
  decoded hash into view once, after the body renders; an unknown or malformed
  hash is ignored.
- **D2 imports (L3)** (`...@x`, `x: @y`) are rejected by `d2SourceProblem`,
  shared by `check:diagrams` and `npm run diagrams`.
- **`#` in `.d2` labels (L7).** Only a hex color used as a value (a whole
  quoted value, or `key:#hex`) counts, in `check:diagrams` and in
  `check:colors` (`d2HexColors`); `.ts`/`.tsx`/`.css` scanning is unchanged.
- **Accessible names (L4).** The img stays inside the link (one tab stop, one
  target; the locked criterion-13 tests require the img inside the link); the
  link is "Open diagram full size: <alt>" and the region is "Diagram, scrolls
  sideways", so the alt text is in exactly one accessible name.
- **One heading source (L5).** `h2Headings` now runs the renderer's own
  pipeline (remark-parse, remark-gfm, remark-rehype, then the shared
  `rehypeHeadingIds` pass, moved to `src/lib/headings.ts`) instead of parsing
  ATX lines, so setext headings, entity references and headings inside other
  blocks can't drift from the rendered ids. `unified`, `remark-parse` and
  `remark-rehype` were already installed through react-markdown and are now
  declared; that code already sat in the MarkdownRenderer chunk, so sizes are
  unchanged: main chunk 90.69 KB brotlied (limit 104 KB), MarkdownRenderer
  chunk 82.22 KB (limit 95 KB).

Review fixes, round 3 (Stage 4a):

- **`#section` scroll holds while the page settles (M1).** The late shift was
  a web-font swap, not the code blocks or diagrams: the faces only the body
  uses (IBM Plex Mono 400/600, IBM Plex Sans 500, Lora 700) started loading
  when the body first rendered and swapped in just after `LazyBody`'s scroll,
  re-wrapping text above the target (at 375px, a list in "API design" with
  inline code grew about 50px). Measured in headless Chrome, CodeBlock's plain
  fallback and Shiki's output are the same height and the diagrams keep their
  reserved size, so neither moves. Two changes: `main.tsx` starts loading
  those four faces at startup, in parallel with the body chunk; and
  `LazyBody`, after its one scroll, keeps the heading aligned (a
  `ResizeObserver` on the body element and every block beside the heading,
  re-scrolling only when the heading has drifted from its scroll margin) for
  at least 1.5s and until `document.fonts.ready`, capped at 5s, stopping at
  the first wheel, touch, key or pointer press. It uses the hash the page was
  opened with; a later Contents jump is the browser's own.
- **Diagram references are parsed, not matched (M2).** `src/lib/diagram-refs.mjs`
  (plain JavaScript with a `.d.mts`, so the Node check script and the site
  both import it) holds `markdownParser` (remark-parse + remark-gfm, which
  `h2Headings` now extends), `isDiagramSrc` (moved out of `MarkdownRenderer`),
  `diagramName` (used by `Diagram`) and `diagramReferences`, which collects
  `image` nodes and `imageReference` nodes resolved through `definition` nodes.
  `check:diagrams` uses it, so wrapped alt text, reference-style images, angle
  brackets and titles all count, and code never does.
- **Only expected files under `public/diagrams/` (L1).** Anything but the root
  `manifest.json` and `<case>/<name>.light.svg`/`.dark.svg` named like a valid
  source fails, named relative to `public/diagrams/`.
- **One `.d2` naming rule (L3).** `SOURCE_PATH`/`sourcePathProblem` in
  `scripts/diagram-manifest.mjs`, used by both `check:diagrams` and
  `npm run diagrams`; the error names the source path.
- **No empty heading ids (L4).** `headingId` returns `section` for text with
  no ASCII letters or digits; repeats number as usual (`section-1`).
- **Prose (L5).** The estimates now cite only the two rules of thumb the
  linked "numbers every engineer should know" topic has (one million a day is
  about 12 a second; plan for ten times average peak) and check the redirect
  average against the first. "Keyed block cipher" became a plain description.
  The analytics requirement is narrowed to per-link counts minute by minute
  (what the design aggregates); country and referrer breakdowns moved to out of
  scope, with the raw events kept 30 days as the way to add them later.
- **Sizes:** main chunk 90.73 KB brotlied (limit 104 KB), MarkdownRenderer
  chunk 82.6 KB (limit 95 KB); no limit raised.

Retro and cleanup pass (after round 3):

- **Checks.** `svgProblems` accepts an XML declaration only with a UTF-8 (or
  no) encoding; `readTokens`/`diagramTokens` and `check:contrast` read every
  `:root`/`.dark` block, the later declaration winning; `check:pipeline-log`
  accepts `N (user-authorized)` fix rounds (N of 3 or more).
- **UI.** Markdown tables sit in their own sideways-scrolling box, a region
  named "Table, scrolls sideways" only while overflowing; the overflow logic
  moved out of `Diagram` into `src/hooks/useSideScroll.ts`, shared by both.
  `Enter` in search opens the first result. The theme toggle is icon-only
  (same-size sun, moon and monitor icons; state and next action in its
  `aria-label` and `title`), so the header's row count no longer depends on
  the stored theme. `LazyBody`'s scroll-hold also stops on any scroll it
  didn't cause.
- **Dead code.** Internal-only exports of `scripts/diagram-manifest.mjs` and
  `FrontmatterData` are no longer exported; a `knip.json` records knip's
  verified false positives (hooks run from `.claude/settings.json`, the
  `.d.mts` tsc picks up, the external `d2` binary).

Final fix pass:

- **One token reader.** `scripts/css-tokens.mjs` (`readThemeTokens`) replaces
  `readTokens` and the per-script parsers in `check:contrast` and
  `check:tokens`; `diagramTokens` sits on it too. It reads every top-level
  `:root`/`.dark` block, ignores comments, skips `@theme` blocks, and throws,
  naming the token, on a `--color-*` value that isn't 3- or 6-digit hex or a
  token declared anywhere else (under `@media`, a compound selector, a nested
  rule); each script reports that as a failure.
- **XML declaration** accepted only as `<?xml version="1.0"`, then optionally
  `encoding="utf-8"` (any case), then optionally `standalone="yes|no"`,
  single-spaced, in that order.
- **Search Enter** does nothing during an IME composition (`isComposing` or
  keyCode 229).
- **`check:pipeline-log`** accepts `add-case-study <path>` rows (with `n/a`
  Retro) and reports an empty Retro cell once.
