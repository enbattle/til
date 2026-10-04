# Spec: keep keyboard focus clear of the sticky header and bar

Status: approved 2026-10-04.

## Context

WCAG 2.2 SC 2.4.11 (Focus Not Obscured, Minimum, Level AA) requires that a
focused element is never entirely hidden by author content such as a sticky
header. DESIGN.md's accessibility checklist, and through it NON_NEGOTIABLES #1,
requires visible focus. A Stage 0 reproduction in headless Chrome on
`/system-design/payment-system` broke this. Shift+Tab backwards through the
body left focused links fully hidden:

| Width  | Covered strip                             | Links focused | Fully hidden |
| ------ | ----------------------------------------- | ------------- | ------------ |
| 1440px | 67px (header)                             | 58            | 5            |
| 375px  | 149px (header and the "On this page" bar) | 50            | 8            |

**Cause.** When focus moves to an element outside the viewport, the browser
scrolls it to the top edge, under the sticky elements. Nothing reserves that
space. The page has no `scroll-padding-top`. Only the `##` headings carry a
`scroll-margin-top` (`HEADING_SCROLL_MARGIN` in
`src/components/MarkdownRenderer.tsx`), and that covers in-page jumps to
headings, not focus on anything else.

The 1440px case predates the "On this page" work: the header has been sticky
since early on. `docs/specs/on-this-page-bar.md` (#56) widened the covered
strip below `xl`.

## Design

**One source for the sticky offset: the root's `scroll-padding-top`.**

`src/index.css` sets it on `html`:

- below `xl`: header height + `--on-this-page-height` + 0.75rem;
- from `xl`: header height + 0.75rem.

It uses the same variables as today (`--header-height`, published by `Header`;
`--on-this-page-height`). Browsers apply the scroller's scroll padding to
every scroll-into-view operation: focus moves, fragment navigation and
`scrollIntoView`. So focus, in-page links and `#heading` URLs all land below
the sticky elements.

**The headings' `scroll-margin-top` is removed** (`HEADING_SCROLL_MARGIN`
goes). Scroll margin on the target and scroll padding on the scroller add up,
so keeping both would push every jump too low by the full offset.

**The two readers of the old margin read the root padding instead**, through
one shared helper (e.g. `stickyOffset()` in `src/lib/`, returning
`parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0`):

- `LazyBody`'s `keepInView` alignment check, in `src/components/LazyBody.tsx`;
- `useCurrentHeading`'s reading line, in `src/hooks/useCurrentHeading.ts`.

The pure `currentHeadingId` keeps its signature. Each heading gets the same
margin.

**Pages without the bar.** Below `xl`, the reserved strip includes the bar's
height on every page, so landing pages leave about 44px of extra room when
focus scrolls. That's harmless (more room, never less), and simpler than
toggling the padding per page.

## Acceptance criteria

1. `src/index.css` declares `scroll-padding-top` on `html`:
   - one value for below `xl` that uses `--header-height` and
     `--on-this-page-height`;
   - one for `xl` and up (a min-width 80rem query) that uses `--header-height`
     but not `--on-this-page-height`.

   Tests read the real file. jsdom doesn't apply it.

2. A rendered `##` heading on a case study, a DSA entry and a catalog topic
   carries no `scroll-mt-*` class.
3. The scroll-spy takes its reading line from the root's computed
   `scroll-padding-top`.
   - With the root's padding stubbed to 80px and every heading's
     `scroll-margin-top` at 0, the existing scroll-spy criteria still hold.
   - The second heading is current once its top is ≤ 82.
   - Nothing is current above the first heading.
   - The last heading is current at the bottom of a page that can scroll.
4. `LazyBody`'s hold on a `#heading` URL treats the heading as aligned when its
   top equals the root's `scroll-padding-top`, and re-scrolls when it has
   drifted (stubbed root padding, no heading margin).
5. The existing jump, hash-URL, scroll-spy and bar tests otherwise still pass.
   Test-writers update only the tests that stub the old per-heading margin.

Browser-only, checked in Stage 4:

- Shift+Tab and Tab sweeps on `/system-design/payment-system`, a DSA entry and
  a catalog topic at 375, 1024, 1279 and 1440px: **0** focused elements fully
  hidden, each time.
- An "On this page" link (the right nav and the bar's panel) lands its heading
  just below the header (and the bar, below `xl`), 0.75rem clear, as today.
- An opened `#heading` URL does the same, and the scroll-spy marks the clicked
  or opened section.
- Both themes, and no console errors.

## Scope

In:

- `src/index.css`, `src/components/MarkdownRenderer.tsx`,
  `src/components/LazyBody.tsx`, `src/hooks/useCurrentHeading.ts`, and the new
  helper.
- Tests:
  - `src/App.on-this-page.test.tsx` (its scroll-margin criterion becomes
    criteria 1 and 2);
  - `src/App.on-this-page-scroll-spy.test.tsx`;
  - `src/hooks/useCurrentHeading.test.ts` (only if needed);
  - `src/components/LazyBody.test.tsx`;
  - a test for criterion 1.
- Docs:
  - `docs/DESIGN.md`, where it describes the heading scroll margin (now the
    root's scroll padding);
  - DESIGN.md's accessibility checklist: add focus not hidden by sticky
    elements (WCAG 2.2 SC 2.4.11), checked by tabbing both directions;
  - any other doc that names the heading scroll margin (grep; not exhaustive).

Out:

- Pipeline/process changes. Those are the next step, in their own PR.
- Anything else under focus: the right nav's own scroll box, the mobile
  overlay and search dialog (modal, focus-trapped).

User-facing UI: yes, so Stage 4 includes the browser check. Keep it light on
this machine: one headless Chrome, at most about 12 page loads.

## Non-negotiables check

- #1: this fixes a violation of it.
- #2: no colors.
- #3: CSS only plus a few lines, no budget raise.
- Nothing conflicts.

## Pipeline log

This bug escaped two approved runs. The 375px part comes from `on-this-page-bar`
(#56); the 1440px part predates the log. This run fills the **Escaped
defect** cell of the `on-this-page-bar` row with this spec. The retro is the
pipeline change the user approved as the next step.

## Verification

- Stage 2: the new and edited tests fail, each for its own reason.
- Stage 3: `check:test-lock -- --verify` and `npm run verify`.
- Stage 4: the browser checks above, using the Stage 0 sweep
  (`obscured.mjs`, which the reviewer may rewrite) at each width.

## As built

- The helper is `stickyOffset()` in `src/lib/sticky-offset.ts`.
- `postcss` (`^8.5.28`, the version Vite already installed) is now a direct
  devDependency, because `src/index-css.test.ts` parses `src/index.css` with
  it.
