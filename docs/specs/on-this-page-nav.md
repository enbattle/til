# Spec: wider shell and an "On this page" nav

Status: approved 2026-10-03.

## Context

The app shell is capped at 1024px (`max-w-5xl` in `src/App.tsx` and
`src/components/Header.tsx`), which leaves wide blank margins on desktop
screens (208px a side at 1440px, 448px at 1920px). The user wants that space
used for a right-hand list of the page's sections that stays in place while
the page scrolls, like the left nav. Case studies and DSA entries already list
their `##` sections in a `Contents` box at the top of the body
(`src/components/Contents.tsx`). That box moves into the new nav instead of
being duplicated. Catalog topic pages have no section list today and gain the
same one. DSA grouping is a separate, later run.

## Design

**Shell width.** The header's inner row and the page shell share a 1440px cap
(`max-w-[90rem]`, keeping `px-4`). The reading column (`main`) is at most 800px
wide at every width (today 768px), so prose stays at a readable line length.
At 1440px the side margins go from 208px to 0 (only the 16px padding), and at
1920px from 448px to 240px.

**Columns.**

- Below `lg` (1024px): reading column only, as today.
- `lg` to `xl` (1024–1279px): left nav (224px) + reading column, as today.
- `xl` and up (1280px+): left nav (224px) + reading column + right column
  (224px). The right column exists on every route, empty on pages without
  sections (home, section, System Design and DSA landing pages, not-found), so
  the reading column never moves sideways between pages. Space beyond 800px +
  the two navs + the gaps goes into the gaps, not into the reading column.

**The right nav.** On a topic, case study or DSA entry page with at least one
`##` heading, the right column holds `<nav aria-label="On this page">`: a small
uppercase "On this page" heading (styled like `OrderedNav`'s) and an ordered
list of the body's `##` headings as plain `<a href="#id">` links, in body
order, with no visible numbers. It's sticky like the left nav (same top offset,
own vertical scroll when longer than the viewport). Links use the left nav's
non-current style (`border-l-2 border-transparent hover:border-accent`). There's
no current-section highlighting (no scroll-spy) in this run.

**The narrow view.** Below `xl`, the same links sit at the top of the body (where the
Contents box is today) as a native `<details>`, closed by default, whose
`<summary>` reads "On this page" and which holds the same
`<nav aria-label="On this page">` list. It's hidden at `xl` and up (`xl:hidden`)
and the right nav is hidden below `xl`, so exactly one of the two is displayed
at any width (the same pattern as the left nav and the Menu button). A
body with no `##` headings renders neither.

**Mechanism.** The shell renders the right column as a plain `<div>` slot (not
an `<aside>`, so an empty slot adds no landmark) and provides it through a React
context. The page renders the right nav into it with `createPortal`, from
inside its `LazyBody` children. It appears only once the body has loaded,
and it unmounts with the page on navigation, so a previous page's sections never
linger. One new component (`OnThisPage`, replacing `Contents`) takes
`h2Headings(body)` and renders both the disclosure and the portal. Headings
and ids still come only from `h2Headings` (`src/lib/headings.ts`), so the links
can't disagree with the rendered ids. No new heading logic is added.

## Acceptance criteria

Width and breakpoint behavior is CSS that jsdom can't lay out. Tests may pin
the class tokens that implement it, and Stage 4's browser check verifies the
real layout.

1. On a case study, a DSA entry and a catalog topic page, once the body has
   loaded, there's a `navigation` named "On this page" outside `<main>` whose
   links are, in order, `#<id>` for every `##` heading in the body, and each
   id exists on a rendered heading (duplicates included: `notes`, `notes-1`).
2. On the same pages, inside `<main>` and before the body's first heading,
   there's a `<details>` element without the `open` attribute, whose
   `<summary>` text is "On this page" and which contains a `navigation` named
   "On this page" with the same links as criterion 1.
3. No `navigation` named "Contents" exists on any page, and
   `src/components/Contents.tsx` is gone.
4. The home, a section, the System Design landing, the DSA landing and the
   not-found page render no "On this page" navigation and no `<details>`
   disclosure.
5. Moving from one case study to another (and from a case study to a landing
   page) leaves only the new page's links in the right column (none on the
   landing page).
6. A body with no `##` headings renders neither the disclosure nor the right
   nav (unit-level, against `OnThisPage` with an empty list).
7. The right column container is hidden below `xl` and shown from `xl`
   (`hidden xl:block` or equivalent), and the disclosure carries `xl:hidden`.
8. The header's inner row and the shell use the same 1440px cap, and `main`
   is capped at 800px.
9. Opening a page at `#<heading-id>` still scrolls that heading into view
   (existing `TopicPage.hash.test.tsx` behavior unchanged).

Browser-only, checked in Stage 4: at 1440px the shell spans the viewport minus
16px a side, and the reading column is 800px. At 1280px the right nav is
visible and the reading column is at least 700px. At 1279px and at 375px the
right nav is gone and the disclosure works with the keyboard (Tab to the
summary, Enter or Space toggles it). There's no horizontal scroll at 375px, a
long case study's right nav scrolls on its own, a link click lands its heading
below the sticky header, and all of this holds in both themes.

## Scope

In: `src/App.tsx` (slot + widths), `src/components/Header.tsx` (width),
new `src/components/OnThisPage.tsx` + a small slot context (e.g.
`src/contexts/PageAsideContext.tsx`), `src/pages/TopicPage.tsx`,
`CaseStudyPage.tsx`, `DsaEntryPage.tsx`, delete `src/components/Contents.tsx`.
Tests that assert the old Contents nav are updated by the Stage 2 test-writer:
`src/App.system-design.test.tsx`, `src/App.dsa.test.tsx`,
`src/App.dsa-prereqs.test.tsx`, `src/pages/CaseStudyPage.headings.test.tsx`.
Docs: `docs/DESIGN.md` (Layout, case-study and DSA navigation bullets),
`docs/dsa.md`, and any other doc that names the Contents box (e.g.
`evals/skill-routing/scenarios.md` if it describes it as current behavior).

Out: scroll-spy/current-section highlighting, `###` headings in the nav, DSA
grouping (next run), any change to heading ids, `LazyBody`'s hash scrolling,
or content files.

User-facing UI: yes, so Stage 4 includes the browser check.

## Non-negotiables check

- #1: the disclosure and the nav meet the accessibility checklist (native
  `<details>`/`<summary>` is keyboard-operable, links are underlined text, there's
  one `h1`, and "On this page" is a `<p>`/`<summary>` label, not a heading, so no
  levels are skipped), in both themes and at 375px.
- #2: colors only from existing tokens.
- #3: no budget raise expected. `OnThisPage` loads only with the lazy pages,
  and the context is a few lines in the main chunk. If `size` fails, stop and
  report instead of raising the budget.
- #6: `createPortal` renders React elements, with no HTML sinks.
- Nothing here conflicts with any line.

## Verification

Stage 2: the new and edited tests fail. Stage 3: `npm run check:test-lock -- --verify`
and `npm run verify` pass. Stage 4: the reviewer drives the dev server at 1920,
1440, 1280, 1279 and 375px in both themes, on the widest-content case study,
DSA entry and topic.

## As built

- The shell adds `xl:justify-between`, so width beyond the columns at `xl` goes
  into the gaps (as the spec says). Below `xl` it's left off, so the
  reading column stays beside the left nav at `lg` as before.
- The slot context and its hook live in `src/contexts/usePageAside.ts`, split
  out like `useTheme.ts` so fast refresh keeps working.
- Criterion 3's file check was corrected by a Stage 2 re-run: it built its path
  with `new URL('./Contents.tsx', import.meta.url)`, which Vite rewrites as an
  asset URL, so it threw instead of testing the behavior.

## Review decisions

- Known limitation: the comments at `src/lib/headings.test.ts:6,35` still name
  the deleted `Contents` component. It's a locked test file and the
  text is comment-only, so a test-writer run isn't worth it; fix it the next time
  that file is edited.
- Known limitation: the side columns' `px-1` (the focus-ring fix) moves the
  left nav's labels 4px right of the header logo. It's cosmetic, and a second fix
  round costs more than it's worth; `-mx-1 px-1` on the column would realign it.
