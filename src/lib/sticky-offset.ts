/**
 * The height, in px, of the strip the sticky header (and, below `xl`, the
 * "On this page" bar) covers at the top of the viewport: the root's computed
 * `scroll-padding-top` (src/index.css). The browser leaves that much room above
 * anything it scrolls into view (a focus move, a `#heading` jump,
 * `scrollIntoView`), so it is also where an in-page jump leaves a heading.
 * 0 if it can't be read.
 */
export function stickyOffset(): number {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}
