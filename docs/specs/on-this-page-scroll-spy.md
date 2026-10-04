# Spec: mark the current section in the "On this page" nav

Status: approved 2026-10-03.

## Context

The "On this page" nav (`src/components/OnThisPage.tsx`, from
`docs/specs/on-this-page-nav.md`) lists a page's `##` sections, but nothing
in it shows where the reader is. That spec deferred scroll-spy on purpose.
The user asked for it now: as a topic, case study or DSA entry page scrolls,
the nav marks the section being read, with the same current signal the left
nav uses (bold, accent left border, and an ARIA state), never color alone.

## Design

**Which section is current.** The current section is the last `##` heading
(of the ones `OnThisPage` lists) whose top has reached the reading line.
The reading line is where an "On this page" link puts a heading: its own
computed `scroll-margin-top` (the header's height plus 0.75rem, from
`MarkdownRenderer`), plus 2px of slack. So clicking a link always marks that
link's section, and no new offset constant is added. Two cases differ:

- Above the first heading (the intro), no section is current.
- Scrolled to the bottom of the page (`scrollY + innerHeight` within 2px of
  the document's scroll height), the last heading is current. Otherwise a
  short final section that can never reach the reading line would never be
  marked.

**When it updates.**

- Once on mount, which covers a page opened at a `#heading` URL after
  `LazyBody` scrolls to it.
- On every window `scroll` (a passive listener) and `resize`, batched to at
  most one recomputation per animation frame (`requestAnimationFrame`).
- On unmount, listeners are removed and a pending frame is cancelled.

The spy only reads layout (`getBoundingClientRect`, `getComputedStyle`). It
never scrolls the window, so it can't interfere with `LazyBody`'s
`keepInView`, which treats a scroll it didn't cause as the reader taking over.

**How it shows.** One piece of state in `OnThisPage` drives both copies (the
`xl:hidden` disclosure and the portalled right nav):

- The current link gets `aria-current="location"`, the ARIA value for "the
  current location within a page". The left nav's `"page"` means "this page".
- It also gets the left nav's current classes from `OrderedNav`
  (`font-bold border-accent text-text-primary`) instead of the non-current
  ones.
- Every other link has no `aria-current` attribute.

The logic lives in a small hook beside the component (e.g.
`src/hooks/useCurrentHeading.ts`, taking the heading ids and returning the
current id or `null`). The pure "which id is current" decision is an exported
function, so it can be unit-tested on plain numbers:
`currentHeadingId(headings: { id, top, margin }[], atBottom: boolean)`.

## Acceptance criteria

jsdom does no layout, so tests stub each heading's `getBoundingClientRect`
and computed `scroll-margin-top`, set `scrollY`, `innerHeight` and the scroll
height, dispatch `scroll` or `resize`, and wait for the frame.

1. `currentHeadingId` (pure):
   - It returns `null` when every heading's top is below its reading line.
   - It returns the last heading whose top ≤ margin + 2.
   - A heading exactly at its reading line counts as current, where a link jump
     leaves it.
   - With `atBottom`, it returns the last heading whatever the tops.
   - An empty list returns `null`.
2. Rendered through the real App on a case study, a DSA entry and a catalog
   topic, after scrolling so the second heading is past its reading line and
   the third isn't:
   - In both copies of the nav (the one in `<main>`'s `<details>` and the one
     outside `<main>`), exactly the second heading's link has
     `aria-current="location"` and the current classes.
   - No other link has `aria-current`.
3. Before the first heading, no link in either copy has `aria-current`.
4. Scrolled to the bottom, the last heading's link is current in both copies.
5. Scrolling back up moves the mark back: from the third section to the first,
   only the first is marked.
6. A `resize` that moves the headings updates the mark without a scroll event.
7. On unmount (navigating to another page), the spy's `scroll` and `resize`
   listeners are removed. Spy on `window.removeEventListener`, or check that a
   later scroll triggers no state update or warning.
8. The spy never calls `window.scrollTo`, `window.scrollBy` or
   `Element.scrollIntoView` (spied during a scroll sequence).
9. The existing `OnThisPage`, `App.on-this-page`, `TopicPage.hash` and
   `LazyBody` tests stay green unchanged. The one exception is a test asserting
   that every link has the non-current style while a heading is current; a
   test-writer may update that one, scoped to the current link.

Browser-only, checked in Stage 4:

- On a long case study at 1440px, scrolling marks each section in turn, and
  a nav click marks the clicked section.
- Opening a `#heading` URL marks that heading once the page settles.
- At the bottom of a page with a short last section, the last one is marked.
- At 375px, the disclosure's list shows the mark when opened.
- No console errors in either theme. The mark is visible in both themes and
  isn't color-only (bold plus border).
- Scrolling stays smooth on the longest case study (payment-system), with no
  dropped-frame jank visible.

## Scope

In:

- `src/components/OnThisPage.tsx`.
- The new hook (`src/hooks/useCurrentHeading.ts`) and its pure helper.
- `docs/DESIGN.md`: the "On this page" description, which currently says
  there's no current-section highlighting.
- `docs/specs/on-this-page-nav.md` stays as the historical record. This spec
  supersedes its "no scroll-spy" line.

Out:

- Keeping the current link visible in a right nav taller than the viewport.
  Real pages have at most about 12 links, which fit at normal heights, and
  scrolling the nav's own box would need care around `LazyBody`.
- `###` headings.
- Smooth scrolling.
- "Last clicked wins" when a clicked short section can't reach the reading
  line and isn't at the bottom of the page.
- Any change to heading ids, `LazyBody` or the left nav.

User-facing UI: yes, so Stage 4 includes the browser check.

## Non-negotiables check

- #1: the current signal is bold plus border plus `aria-current`, never color
  alone. Focus rings are unchanged. Checked in both themes and at 375px.
- #2: existing tokens only (`border-accent`, `text-text-primary`).
- #3: the hook ships in the lazy page chunk, not the main chunk. No budget
  raise.
- #7: no third-party script. Nothing else is touched.

## Verification

- Stage 2: the new tests fail, each for its own reason.
- Stage 3: `check:test-lock -- --verify` and `npm run verify` pass.
- Stage 4: the browser checks above at 1440, 1280 and 375px, in both themes.

## As built

- The bottom rule ("scrolled to the bottom, the last heading is current") also
  requires that the page can scroll: its scroll height must exceed
  `innerHeight` by more than 2px. The Review decisions below explain why.
  Otherwise as designed.

## Review decisions

- Fix (round 1): "scrolled to the bottom" counts only when the page can
  scroll (its scroll height exceeds the viewport by more than 2px). Without
  that, a page that fits the viewport marked its last heading on load.
  Reproduced on `/engineering-practices/git-rebase-vs-merge` at 1440×1400 and
  2560×1440.
- Known limitation: below `xl` the disclosure's mark is rarely seen. The
  disclosure sits above the first heading, so when the reader scrolls back to
  open it, nothing is current. That's what this spec's rules produce, and the
  browser check claiming the mark shows "when opened" was wrong. A sticky
  narrow-screen bar would be its own feature.
- Known limitation: a layout change with no scroll or resize event (toggling
  the disclosure, late reflow without scroll anchoring) can leave the mark
  stale until the next scroll. It didn't reproduce: diagrams reserve their
  size, and Chromium's scroll anchoring fires `scroll`.
- Known limitation: at the bottom, the last heading is marked even when an
  earlier one is at the top. That's the trade-off this spec accepted, and
  "last clicked wins" is out of scope.
