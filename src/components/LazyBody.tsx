import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { stickyOffset } from '@/lib/sticky-offset';

type BodyState =
  | { status: 'loading' }
  | { status: 'loaded'; body: string }
  | { status: 'failed'; error: unknown };

/**
 * Loads a markdown body chunk after the page header has already rendered, then
 * hands it to `children`, which renders the body and the navigation below it.
 * Holding the navigation back until the body is in keeps it from sitting
 * directly under an empty body and jumping down when the body arrives. A failed
 * load is rethrown during render so it reaches the `ErrorBoundary` (the right
 * fix for a stale chunk after a deploy is a reload); it is tracked with an
 * explicit status because a load can reject with a falsy value. This is state
 * plus an effect rather than React's `use`, because `use` on a still-pending
 * promise inside a synchronous test `render` never gets retried.
 *
 * `load` is called once, on mount: key this component on the page's identity
 * (topic or case study) so moving to another page starts a fresh load instead
 * of showing the previous body until the new one arrives. Used by `TopicPage`
 * and `CaseStudyPage`.
 *
 * Opening a page at `#<heading-id>` (a shared link to a section) can't rely on
 * the browser's own jump: the body isn't there yet when it tries. So once the
 * body has rendered, the element named by the hash the page was opened with
 * (if any) is scrolled into view, once per load; the root's
 * `scroll-padding-top` keeps it below the sticky header. Content above it can
 * still change height for a moment after that (a web font swapping in reflows
 * text, the header re-wraps), and the browser's scroll anchoring doesn't always
 * make up the difference, so `keepInView` holds the heading in place while
 * the page settles. An unknown or malformed hash is ignored.
 */
export function LazyBody({
  load,
  children,
}: {
  load: () => Promise<string>;
  children: (body: string) => ReactNode;
}) {
  const [promise] = useState(load);
  const [state, setState] = useState<BodyState>({ status: 'loading' });
  // The hash the page was opened with: a later in-page jump (an "On this
  // page" link) is the browser's own and needs no help.
  const { hash: openedWith } = useLocation();
  const [hash] = useState(openedWith);

  useEffect(() => {
    let active = true;
    promise.then(
      (body) => active && setState({ status: 'loaded', body }),
      (error: unknown) => active && setState({ status: 'failed', error }),
    );
    return () => {
      active = false;
    };
  }, [promise]);

  const loaded = state.status === 'loaded';
  useEffect(() => {
    if (!loaded) return;
    const id = decodeHash(hash);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    target.scrollIntoView();
    return keepInView(target);
  }, [loaded, hash]);

  if (state.status === 'failed') throw state.error;
  if (state.status === 'loading') return null;
  return children(state.body);
}

/** How long `keepInView` holds a heading at least, and at most (it waits for
 * the web fonts in between). */
const SETTLE_MS = 1500;
const MAX_SETTLE_MS = 5000;
/** Input that means the reader is scrolling or navigating themselves. */
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * Re-scrolls `target` into view whenever the page's layout changes, until
 * the page settles: at least `SETTLE_MS`, then until the web fonts have
 * loaded, never past `MAX_SETTLE_MS`. It watches the document body (the
 * header re-wrapping, the page growing) and every block beside the target (one
 * block growing while another shrinks), and only scrolls when the heading has
 * drifted from where the root's scroll padding (`stickyOffset`) puts it. The
 * first wheel, touch, key or pointer press stops it at once, so it never
 * fights the reader, and so
 * does any scroll it didn't cause (a scrollbar drag, find-in-page, assistive
 * technology): a `scroll` event that finds the page somewhere other than its
 * own last scroll left it, with the heading no longer aligned. (A scroll that
 * leaves the heading aligned is the browser's scroll anchoring making up for a
 * layout shift, and is kept.) Call it right after the first scrollIntoView.
 * Returns the cleanup.
 */
function keepInView(target: HTMLElement): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  // Where the page was left by the last scroll this hold made or accepted.
  let expectedY = window.scrollY;
  const aligned = () =>
    Math.abs(target.getBoundingClientRect().top - stickyOffset()) <= 1;
  const realign = () => {
    if (aligned()) return;
    target.scrollIntoView();
    expectedY = window.scrollY;
  };
  const onScroll = () => {
    if (Math.abs(window.scrollY - expectedY) <= 1) return;
    if (aligned()) expectedY = window.scrollY;
    else stop();
  };
  const observer = new ResizeObserver(realign);
  observer.observe(document.body);
  for (const block of target.parentElement?.children ?? []) observer.observe(block);

  let stopped = false;
  const timers: number[] = [];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    timers.forEach((timer) => window.clearTimeout(timer));
    USER_INPUT.forEach((type) => window.removeEventListener(type, stop, true));
    window.removeEventListener('scroll', onScroll);
  };
  USER_INPUT.forEach((type) =>
    window.addEventListener(type, stop, { capture: true, passive: true }),
  );
  window.addEventListener('scroll', onScroll, { passive: true });
  timers.push(window.setTimeout(stop, MAX_SETTLE_MS));
  const minimum = new Promise((resolve) =>
    timers.push(window.setTimeout(resolve, SETTLE_MS)),
  );
  const fonts = document.fonts?.ready ?? Promise.resolve();
  Promise.all([minimum, fonts]).then(() => {
    if (stopped) return;
    realign();
    stop();
  });
  return stop;
}

/** The element id a URL hash names (`#trade-offs` -> `trade-offs`), decoded,
 * or '' for no hash or one that isn't valid percent-encoding. */
function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}
