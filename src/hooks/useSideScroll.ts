import { useEffect, useRef, useState } from 'react';

/**
 * Props for a box that scrolls its content sideways instead of letting it
 * widen the page (a diagram or a table on a phone). Only while the content
 * actually overflows is the box a focusable, labelled region, so a keyboard
 * user can scroll it with the arrow keys; content that fits adds no tab stop.
 *
 * Spread the result onto the box: `<div {...useSideScroll('Table, scrolls
 * sideways')}>`. Overflow is re-measured on a window resize, when the box or
 * its content changes size (where `ResizeObserver` exists), and when `key`
 * changes (e.g. the diagram file swapping with the theme).
 */
export function useSideScroll<T extends HTMLElement>(label: string, key?: unknown) {
  const ref = useRef<T>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScrolls(element.scrollWidth > element.clientWidth + 1);
    update();
    window.addEventListener('resize', update);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(element);
      if (element.firstElementChild) observer.observe(element.firstElementChild);
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [key]);

  return {
    ref,
    className: 'scrollbar-thin block overflow-x-auto',
    ...(scrolls && { role: 'region', tabIndex: 0, 'aria-label': label }),
  };
}
