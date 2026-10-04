# Spec: a sticky "On this page" bar on narrow screens

Status: approved 2026-10-03.

## Context

Below `xl` (1280px), the "On this page" list is a closed `<details>` at the
top of the body (`src/components/OnThisPage.tsx`). It scrolls away with the
intro. The scroll-spy from `docs/specs/on-this-page-scroll-spy.md` marks the
current section in it, but that spec's first known limitation is that the mark
is rarely seen: by the time a reader scrolls back up to open the list, nothing
is current. The user asked for the fix that limitation named: a compact bar
that stays pinned under the sticky header, shows the section being read, and
opens the full list on demand. From `xl` up, the right-hand nav is unchanged.

## Design

**The bar.** Below `xl`, on a topic, case study or DSA entry page with at least
one `##` heading, `OnThisPage` renders a `<nav aria-label="On this page">` in
place of the `<details>`, at the same spot at the top of the body:

- **Position.** `sticky`, with `top` set to `var(--header-height)` (the
  height `Header` already publishes, which changes as the header wraps to two
  or three rows on phones).
- **Layering.** `z-20`, below the header's `z-30`.
- **Look.** The header's surface (`bg-bg-primary/95` with backdrop blur) and a
  bottom border, so content scrolls under it cleanly.
- **Height.** One fixed height, defined in one place and reused by the heading
  scroll margin below.
- **Breakpoint.** `xl:hidden`, so exactly one of the bar and the right nav is
  displayed at any width, as now.

The bar holds one `<button>` that follows the disclosure-button pattern:

- `aria-expanded`, and `aria-controls` pointing at the panel's id.
- Its text is "On this page", followed by the current section's heading text
  when one is current, from the same `useCurrentHeading` state the right nav
  uses.
- A long section title is truncated with an ellipsis on one line. The full
  title stays in the accessible name.
- A chevron icon is `aria-hidden`.

**The panel.** Clicking the button toggles a panel directly under the bar:

- It's positioned absolutely, at full bar width, overlaying the content.
- It has a capped height (about 60vh) and scrolls inside itself when the list
  is longer.
- It uses the `bg-secondary` surface with a border.
- It holds the same `HeadingLinks` list, with the same `aria-current="location"`
  mark.

The panel closes when:

- the button is pressed again;
- a link in it is clicked (the browser then does the in-page jump as today);
- Escape is pressed while focus is in the bar or panel, which also returns
  focus to the button;
- a pointer press lands outside the bar and panel.

It isn't a modal: no focus trap and no scroll lock. Closed, the panel is not
rendered, or is `hidden`, so its links aren't tab stops.

**Landing below the bar.** Below `xl`, the headings' `scroll-margin-top`
(`HEADING_SCROLL_MARGIN` in `src/components/MarkdownRenderer.tsx`, today the
header height plus 0.75rem) also adds the bar's height. From `xl` up it's
unchanged. Because the scroll-spy's reading line, `LazyBody`'s hash scroll and
link jumps all read the computed scroll margin, they all follow this with no
other change.

**Removed.** The `<details>` disclosure.

## Acceptance criteria

Rendered through the real App on a case study, a DSA entry and a catalog
topic, unless noted. Scroll stubs follow `src/App.on-this-page-scroll-spy.test.tsx`.

1. Inside `<main>`, before the body's first heading, there's a `navigation`
   named "On this page" containing a button with `aria-expanded="false"` whose
   text starts with "On this page". `<main>` contains no `<details>` element.
2. The bar's element carries `sticky`, a `top` that uses `--header-height`,
   `xl:hidden`, and `z-20` (class tokens; Stage 4 checks the real layout).
3. With no section current (scrolled above the first heading), the button's
   text is just "On this page". With the second heading current, it also
   contains that heading's text, and the accessible name includes it.
4. Clicking the button:
   - sets `aria-expanded="true"`;
   - shows a panel whose id equals the button's `aria-controls`;
   - the panel holds links to every `##` heading in body order, identical to
     the right nav's hrefs.

   Clicking again sets `aria-expanded="false"`, and the panel's links are no
   longer in the accessibility tree.

5. With a heading current, the panel's link for it has
   `aria-current="location"`, and no other link in the panel does.
6. Clicking a link in the open panel closes it (`aria-expanded="false"`). The
   link's href is `#<id>`.
7. Escape with focus inside the open panel closes it and moves focus to the
   button.
8. A `pointerdown` outside the bar and panel closes it. A `pointerdown` on a
   link inside the panel doesn't close it before the click lands.
9. A rendered `h2`'s class includes the existing `xl:` scroll margin (header
   height plus 0.75rem, unchanged from `xl` up) and a narrower-screen margin
   that adds the bar's height (class tokens).
10. Pages with no `##` headings, and the home, section and landing pages,
    render no bar.
11. The right nav (`xl` and up) behaves as before: the existing
    `App.on-this-page*` right-nav assertions still pass. Tests that asserted
    the `<details>` are updated to the bar.

Browser-only, checked in Stage 4, at 375px (header on two rows), 1024px and
1279px, in both themes:

- While scrolling a long case study, the bar stays pinned directly under the
  header with no gap or overlap, and its text follows the current section.
- A panel link jump lands its heading just below the bar, not hidden under
  it. So does opening a `#heading` URL.
- The panel scrolls inside itself on a long list.
- There's no horizontal scroll (`scrollWidth` equals the viewport).
- Keyboard: Tab to the button, Enter or Space opens the panel, Tab moves into
  the links, Escape closes it and focus returns to the button.
- No console errors.

## Scope

In:

- `src/components/OnThisPage.tsx`: the bar, button and panel; remove the
  `<details>`.
- `src/components/MarkdownRenderer.tsx`: the below-`xl` heading scroll margin.
- Docs: `docs/DESIGN.md`'s "On this page" description and accessibility
  notes, and any doc naming the disclosure (grep; the list isn't exhaustive).
  The scroll-spy spec stays as history. This spec supersedes its first known
  limitation.

Tests the Stage 2 test-writer updates:

- `src/App.on-this-page.test.tsx`.
- `src/App.on-this-page-scroll-spy.test.tsx` (its `<details>` copy becomes the
  bar's panel).
- `src/pages/CaseStudyPage.headings.test.tsx`, plus new tests.

Out:

- Animation.
- A focus trap.
- Showing the bar on landing pages.
- Changing the right nav, the scroll-spy rules or the header.

User-facing UI: yes, so Stage 4 includes the browser check.

## Non-negotiables check

- #1: the button has a visible text name and states `aria-expanded`/`aria-controls`.
  The chevron is `aria-hidden`, focus rings come from the global style, and
  Escape is handled. The current mark isn't color-only. Checked in both themes
  and at 375px with no horizontal scroll.
- #2: existing tokens only.
- #3: the code stays in the lazy page chunk.
- Nothing conflicts.

## Verification

- Stage 2: new and edited tests fail, each for its own reason.
- Stage 3: `check:test-lock -- --verify` and `npm run verify`.
- Stage 4: the browser list above. Keep it light on this machine: one headless
  Chrome and a handful of page loads.

## As built

- The bar's single height is the CSS custom property `--on-this-page-height`
  (2.75rem) in `src/index.css`'s existing `:root` block (`check:tokens` allows
  only one). The narrow-screen heading scroll margin adds
  `var(--on-this-page-height)`.
- The closed panel stays mounted with `hidden`, rather than unmounting, so a
  clicked link is still in the document when the browser follows it. The
  panel's id comes from `useId`.
- The panel also closes when keyboard focus moves outside the bar's nav (a
  blur whose `relatedTarget` is outside it). Without that, tabbing past the
  last panel link left focus on a body link hidden under the open panel, and
  Escape no longer reached the nav (the round 1 review finding). There's no
  gap between the bar and the panel.

## Review decisions

- Known limitation: after a panel link is used, focus drops to `<body>`,
  because the focused link becomes `hidden` as the panel closes. Browsers
  move the sequential-focus starting point to the fragment target, so the
  next Tab continues from the heading the reader jumped to. Moving focus
  explicitly would fight the browser's own in-page jump.
