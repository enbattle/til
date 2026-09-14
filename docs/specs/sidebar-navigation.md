# Left-side section/topic navigation

## Context

The site currently has no way to jump directly to a topic other than
going through the home page's section grid. With content just trimmed
to 2 sections / 2 topics, the user wants a persistent left-side
navigation listing every section and its topics, reachable from any
page.

This directly contradicts the "Layout" section of `docs/DESIGN.md`,
which currently states "no persistent sidebar" as a deliberate choice,
with the rationale "revisit this once section/topic counts grow enough
that jumping between sections while reading becomes common." Content
just went the opposite direction (fewer topics, not more). The user
has explicitly asked for this anyway — the plan does not silently
override `DESIGN.md`; updating that document's Layout section to
describe the new nav and _why_ it's being added now (direct jump
access is worth the chrome even at a small scale, and it's cheap to
build the pattern correctly now rather than retrofitting it later) is
part of the implementation, not an afterthought.

## Approach

**Structure**: a single presentational component renders the nav tree
(sections from `SECTIONS`, each with its topics from `topicsBySection()`)
and is reused in two places — a persistent panel on wide viewports, and
inside a dismissible overlay on narrow ones. This mirrors an existing
project convention rather than inventing one: `SearchDialog.tsx` already
implements the overlay/focus-trap/close-on-navigate pattern this needs.

- **`src/components/SectionNav.tsx`** (new) — presentational only.
  Renders `<nav aria-label="Sections">` with one `<ul>` per section:
  a link to `/{section.slug}` as the section heading, and a nested
  `<ul>` of links to `/{section.slug}/{topic.slug}` for every topic in
  that section (via `topicsBySection()` from `src/lib/content.ts` —
  never a hardcoded list, so a new section/topic just appears). Always
  fully expanded, no collapse/expand state (per the user's choice —
  simplest thing that fits today's content size).
  - Marks the current section link and, if applicable, the current
    topic link with `aria-current="page"` plus a visual treatment
    that isn't color-only (bold weight + a left accent-colored border),
    consistent with `docs/DESIGN.md`'s "color isn't the only signal"
    rule. Determined via `useLocation()` from react-router, matching
    how `App.tsx` already reads the current path.
  - Accepts an optional `onNavigate?: () => void` called after a link
    click, so the mobile overlay can close itself on navigation — the
    persistent desktop copy just omits it.

- **`src/components/MobileNav.tsx`** (new) — the narrow-viewport
  overlay wrapper: fixed backdrop + a panel sliding in from the left
  edge (distinct from `SearchDialog`'s centered panel — a nav menu
  conventionally opens from the edge it's toggled from), containing
  `<SectionNav onNavigate={onClose} />`. Reuses `useFocusTrap` exactly
  as `SearchDialog` does, closes on `Escape` and on backdrop click,
  `role="dialog"` + `aria-modal="true"` + `aria-label="Navigation"`.

- **`src/components/Header.tsx`** — add a "Menu" text button (matching
  the existing "Search" button's style — this repo's accessibility
  rule is explicit that controls aren't icon-only), calling a new
  `onOpenNav` prop, placed before the `til` logo. Visible only below
  the `lg` breakpoint (`lg:hidden`) — the counterpart persistent panel
  takes over at `lg:` and above, so exactly one of the two is ever in
  the accessibility tree at a time.

- **`src/App.tsx`** — add `navOpen` state alongside the existing
  `searchOpen` state, with the same close-on-pathname-change effect
  already there for search. Restructure the page shell from a single
  centered `max-w-3xl` column into a two-column shell: an outer
  `mx-auto flex max-w-5xl gap-8 px-4` wrapper containing
  `<SectionNav className="hidden lg:block w-56 shrink-0 py-10" />` and
  `<main className="max-w-3xl flex-1 py-10">` (the existing `<Routes>`,
  unchanged, still wrapped in the `ErrorBoundary` added earlier).
  Render `{navOpen && <MobileNav onClose={...} />}` next to the
  existing `{searchOpen && <SearchDialog ... />}`. `Header`'s own inner
  container widens from `max-w-3xl` to `max-w-5xl` to stay aligned with
  the wider shell beneath it.

- **`docs/DESIGN.md`** — rewrite the "Layout" bullet: remove "no
  persistent sidebar" / "revisit once counts grow," describe the new
  `lg:` breakpoint split (persistent sidebar / `Menu`-triggered overlay
  below it) and the reasoning above. No color-token changes needed —
  the nav reuses existing tokens (`border-accent` for the active
  indicator, etc.).

**Explicitly out of scope**: collapsible/accordion section groups (not
needed at 2 sections), a "recently added" or search shortcut inside the
nav itself (search already has its own entry point), any change to the
home page's existing "Sections" grid or "Recently added" list (the
sidebar is additive on every page, including home, per the user's
choice — the home page's own content is unaffected).

## Acceptance criteria (feed directly into Stage 2's tests)

1. `SectionNav` renders every section from `SECTIONS`, each with links
   to all of its topics from `topicsBySection()` — adding a topic/section
   to the registry requires no nav code change (verified by asserting
   against the real registry/content data, not a mock).
2. Clicking a section link navigates to `/{section-slug}`; clicking a
   topic link navigates to `/{section-slug}/{topic-slug}`.
3. On a page for topic X, X's link (and its parent section's link) carry
   `aria-current="page"`; no other link does. On a section page with no
   topic selected, only that section's link carries it. On the home page,
   no link carries it.
4. `MobileNav` is not in the document until opened; opening it renders a
   `role="dialog"` with focus trapped inside (reuse the same assertions
   `SearchDialog.test.tsx` already uses for this).
5. `Escape`, a backdrop click, or clicking a topic/section link inside
   `MobileNav` all close it (the last one via the `onNavigate` callback).
6. The `Header`'s "Menu" button opens `MobileNav`; it's a real, labeled
   `<button>` (not icon-only), reachable by keyboard.
7. Regression: the home page's existing "Sections" grid and "Recently
   added" list still render unchanged.

Note: whether the persistent panel is actually _visible_ at a given
pixel width vs. the toggle button is a CSS media-query concern that
jsdom can't evaluate meaningfully in Vitest — that part is verified by
Stage 4's browser check (the review prompt already requires checking a
mobile-width viewport), not by an automated test asserting computed
visibility.

## Files touched

- New: `src/components/SectionNav.tsx`, `src/components/SectionNav.test.tsx`,
  `src/components/MobileNav.tsx`, `src/components/MobileNav.test.tsx`
- Edited: `src/components/Header.tsx` (+ `Header.test.tsx`), `src/App.tsx`
  (+ `App.test.tsx` for the new nav-open/close/navigate behaviors),
  `docs/DESIGN.md`
- Has a user-facing UI surface → Stage 4 includes the browser check.

## Verification

Standard suite: `npm run typecheck && npm run lint && npm run format:check`,
`npm run test:run`, `npm run build`, `npm run size` (the two-column shell
shouldn't meaningfully change JS bundle size — CSS/markup only). Manual:
`npm run dev`, confirm the sidebar shows at desktop width on every page,
confirm the `Menu` button + overlay work at a narrow width, confirm
active-link highlighting in both themes, confirm keyboard-only operation
(Tab to Menu button, Enter to open, Tab cycles inside the overlay, Escape
closes and returns focus to the Menu button).
