import { useEffect, useState } from 'react';

/** Slack, in px, for a heading at its reading line and for the page bottom. */
const SLACK = 2;

interface HeadingPosition {
  id: string;
  /** The heading's viewport top (`getBoundingClientRect().top`). */
  top: number;
  /** Its computed `scroll-margin-top`: where an in-page link leaves it. */
  margin: number;
}

/**
 * Which section is being read: the last heading whose top has reached its
 * reading line (its own scroll-margin-top plus 2px), so a link jump always
 * marks that link's section; or, scrolled to the bottom of a page that can
 * scroll, the last heading, since a short final section may never reach the
 * line. `null` above the
 * first heading.
 */
export function currentHeadingId(
  headings: HeadingPosition[],
  atBottom: boolean,
): string | null {
  if (headings.length === 0) return null;
  if (atBottom) return headings[headings.length - 1].id;
  let current: string | null = null;
  for (const { id, top, margin } of headings) {
    if (top <= margin + SLACK) current = id;
  }
  return current;
}

/**
 * The id of the heading (of `ids`) whose section is being read, or `null`.
 * Recomputed on mount and, at most once per animation frame, on a window
 * scroll or resize. It only reads layout and never scrolls the window, so it
 * can't disturb `LazyBody`'s `keepInView`.
 */
export function useCurrentHeading(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  // A string key, so a new array with the same ids doesn't re-subscribe.
  const key = ids.join('\n');
  useEffect(() => {
    const list = key ? key.split('\n') : [];
    const update = () => {
      const headings: HeadingPosition[] = [];
      for (const id of list) {
        const element = document.getElementById(id);
        if (!element) continue;
        const margin = parseFloat(getComputedStyle(element).scrollMarginTop);
        headings.push({
          id,
          top: element.getBoundingClientRect().top,
          margin: Number.isNaN(margin) ? 0 : margin,
        });
      }
      // Only a page that can scroll has a bottom to reach; one that fits
      // the viewport would otherwise mark its last heading on load.
      const { scrollHeight } = document.documentElement;
      const atBottom =
        scrollHeight > window.innerHeight + SLACK &&
        window.scrollY + window.innerHeight >= scrollHeight - SLACK;
      setCurrent(currentHeadingId(headings, atBottom));
    };
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);
  return current;
}
