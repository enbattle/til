import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTopic } from '@/lib/content';
import { getDsaEntry } from '@/lib/dsa';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import { getCaseStudy } from '@/lib/system-design';
import { caseStudyBody, dsaEntryBody, rawTopic } from '@/test/content';
import { renderAt } from '@/test/render';

// docs/specs/on-this-page-scroll-spy.md, criteria 2-8: the "On this page" nav
// marks the section being read, through the real App on a case study, a DSA
// entry and a catalog topic. jsdom does no layout, so each heading's
// getBoundingClientRect top is stubbed (by id), as are the root's computed
// scroll-padding-top (80px; docs/specs/focus-not-obscured.md, criterion 3),
// each heading's computed scroll-margin-top (0), window.scrollY, innerHeight
// and the document's scroll height. A test sets a layout, dispatches `scroll` or `resize`, and waits for
// the animation frame with waitFor. The hook itself is tested only through the
// rendered page, so this file doesn't import it. The narrow-view copy is the
// "On this page" bar's panel (docs/specs/on-this-page-bar.md), opened on load.

const NAME = 'On this page';
/** The root's stubbed scroll-padding-top: the reading line. */
const PADDING = 80;
const INNER_HEIGHT = 800;
const SCROLL_HEIGHT = 10000;
const CURRENT = ['font-bold', 'border-accent', 'text-text-primary'];

const TOPIC = getTopic('systems-and-infrastructure', 'caching')!;
const CASE_STUDY = getCaseStudy('url-shortener')!;
const DSA_ENTRY = getDsaEntry('binary-search')!;

const PAGES = [
  {
    kind: 'case study',
    path: `/system-design/${CASE_STUDY.slug}`,
    title: CASE_STUDY.title,
    body: () => caseStudyBody(CASE_STUDY.slug),
  },
  {
    kind: 'DSA entry',
    path: `/dsa/${DSA_ENTRY.slug}`,
    title: DSA_ENTRY.title,
    body: () => dsaEntryBody(DSA_ENTRY.slug),
  },
  {
    kind: 'catalog topic',
    path: `/${TOPIC.section}/${TOPIC.slug}`,
    title: TOPIC.title,
    body: () => parseFrontmatter(rawTopic(TOPIC.section, TOPIC.slug)).content,
  },
];

// ---- Layout stubs ---------------------------------------------------------

/** Each heading's viewport top, by id. Elements not in it report top 0. */
let tops = new Map<string, number>();
let scrollY = 0;
let headingIds: string[] = [];

const saved = {
  scrollY: Object.getOwnPropertyDescriptor(window, 'scrollY'),
  pageYOffset: Object.getOwnPropertyDescriptor(window, 'pageYOffset'),
  innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
};
const hadScrollIntoView = 'scrollIntoView' in Element.prototype;
const hadScrollBy = 'scrollBy' in window;

function rect(top: number): DOMRect {
  return {
    top,
    bottom: top + 30,
    left: 0,
    right: 0,
    width: 0,
    height: 30,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A computed style reporting `property` (a CSS name, e.g. `scroll-padding-top`)
 * as `value`, by that name and its camelCase form. */
function withStyle(
  style: CSSStyleDeclaration,
  property: string,
  value: string,
): CSSStyleDeclaration {
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return new Proxy(style, {
    get(target, prop) {
      if (prop === camel) return value;
      if (prop === 'getPropertyValue')
        return (name: string) =>
          name === property ? value : target.getPropertyValue(name);
      const real = Reflect.get(target, prop, target) as unknown;
      return typeof real === 'function'
        ? (real as (...args: unknown[]) => unknown).bind(target)
        : real;
    },
  });
}

beforeEach(() => {
  tops = new Map();
  scrollY = 0;
  headingIds = [];
  for (const name of ['scrollY', 'pageYOffset']) {
    Object.defineProperty(window, name, { configurable: true, get: () => scrollY });
  }
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => INNER_HEIGHT,
  });
  for (const el of [document.documentElement, document.body]) {
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      get: () => SCROLL_HEIGHT,
    });
  }
  if (!hadScrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: function scrollIntoView() {},
      configurable: true,
      writable: true,
    });
  }
  if (!hadScrollBy) {
    Object.defineProperty(window, 'scrollBy', {
      value: function scrollBy() {},
      configurable: true,
      writable: true,
    });
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return rect(tops.get(this.id) ?? 0);
  });
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
    const style = realGetComputedStyle(el, pseudo);
    // focus-not-obscured: the reading line is the root's scroll padding, and
    // the headings carry no scroll margin of their own.
    if (el === document.documentElement)
      return withStyle(style, 'scroll-padding-top', `${PADDING}px`);
    return tops.has(el.id) ? withStyle(style, 'scroll-margin-top', '0px') : style;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [name, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(window, name, descriptor);
    else delete (window as unknown as Record<string, unknown>)[name];
  }
  for (const el of [document.documentElement, document.body]) {
    delete (el as unknown as { scrollHeight?: unknown }).scrollHeight;
  }
  if (!hadScrollIntoView) {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
  if (!hadScrollBy) {
    delete (window as unknown as { scrollBy?: unknown }).scrollBy;
  }
});

/** Places heading i at `headingTops[i]` (headings past the list keep going
 * down by 400px each) with the page scrolled to `y`. */
function setLayout(headingTops: number[], y: number) {
  scrollY = y;
  let last = headingTops[headingTops.length - 1] ?? 1000;
  headingIds.forEach((id, i) => {
    if (i < headingTops.length) tops.set(id, headingTops[i]);
    else tops.set(id, (last += 400));
  });
}

/** The intro: every heading below its reading line, not at the bottom. */
const INTRO = [1000];
/** The second heading past its reading line, the third not. */
const SECOND = [-400, 40, 400];
/** The third heading past its reading line, the fourth not. */
const THIRD = [-800, -400, 20, 500];
/** Scrolled near the top: only the first heading past its reading line. */
const FIRST = [PADDING, 400];
const MID_PAGE = 1000;
const BOTTOM = SCROLL_HEIGHT - INNER_HEIGHT;

function scrollTo(headingTops: number[], y = MID_PAGE) {
  setLayout(headingTops, y);
  act(() => {
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

function resizeTo(headingTops: number[], y = MID_PAGE) {
  setLayout(headingTops, y);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

// ---- Page helpers ---------------------------------------------------------

async function openPage(path: string, title: string, body: () => string) {
  headingIds = h2Headings(body()).map((h) => h.id);
  expect(headingIds.length).toBeGreaterThanOrEqual(3);
  setLayout(INTRO, 0);
  renderAt(path);
  await screen.findByRole('heading', { level: 1, name: title });
  const main = screen.getByRole('main');
  await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
  await waitFor(() => expect(navs(main)).toHaveLength(2));
  // The in-<main> copy is the bar's panel (docs/specs/on-this-page-bar.md):
  // open it so its links are rendered.
  const button = within(navs(main)[0]).getByRole('button', {
    name: new RegExp(`^${NAME}`),
  });
  await userEvent.setup().click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
  return main;
}

/** Both "On this page" navigations: the bar (in <main>), then the right nav. */
function navs(main: HTMLElement) {
  const all = screen.queryAllByRole('navigation', { name: NAME });
  return [
    ...all.filter((n) => main.contains(n)),
    ...all.filter((n) => !main.contains(n)),
  ];
}

/** Both copies of the links: the open bar panel's, then the right nav's. */
function copiesOf(main: HTMLElement) {
  const found = navs(main);
  expect(found).toHaveLength(2);
  expect(found.filter((n) => main.contains(n))).toHaveLength(1);
  const button = within(found[0]).getByRole('button', { name: new RegExp(`^${NAME}`) });
  const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
  expect(panel).not.toBeNull();
  return [panel!, found[1]];
}

/** Asserts that in both copies exactly heading `index` is current (or none). */
function expectCurrent(main: HTMLElement, index: number | null) {
  for (const nav of copiesOf(main)) {
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      headingIds.map((id) => `#${id}`),
    );
    links.forEach((link, i) => {
      if (i === index) {
        expect(link, `#${headingIds[i]}`).toHaveAttribute('aria-current', 'location');
        expect(link).toHaveClass(...CURRENT);
        expect(link).not.toHaveClass('border-transparent');
      } else {
        expect(link, `#${headingIds[i]}`).not.toHaveAttribute('aria-current');
        expect(link).not.toHaveClass('font-bold');
        expect(link).toHaveClass('border-transparent');
      }
    });
  }
}

// ---- Criteria -------------------------------------------------------------

describe.each(PAGES)('scroll-spy on a $kind', ({ path, title, body }) => {
  it('marks exactly the second heading’s link in both copies once it is past its reading line and the third isn’t (criterion 2)', async () => {
    const main = await openPage(path, title, body);
    scrollTo(SECOND);
    await waitFor(() => expectCurrent(main, 1));
  });

  it('takes the reading line from the root’s scroll-padding-top: the second heading is current at top 82, not at 83 (focus-not-obscured criterion 3)', async () => {
    const main = await openPage(path, title, body);
    scrollTo([-400, PADDING + 3, 400]);
    await waitFor(() => expectCurrent(main, 0));
    scrollTo([-400, PADDING + 2, 400]);
    await waitFor(() => expectCurrent(main, 1));
  });

  it('marks no link above the first heading (criterion 3)', async () => {
    const main = await openPage(path, title, body);
    scrollTo(SECOND);
    await waitFor(() => expectCurrent(main, 1));
    scrollTo(INTRO, 0);
    await waitFor(() => expectCurrent(main, null));
  });

  it('marks the last heading’s link in both copies at the bottom of the page (criterion 4)', async () => {
    const main = await openPage(path, title, body);
    // Only the first two headings have reached the reading line: the last is
    // marked because the page can scroll no further.
    scrollTo([-2000, -1000, 300], BOTTOM);
    await waitFor(() => expectCurrent(main, headingIds.length - 1));
  });
});

describe('scroll-spy on a case study', () => {
  const [{ path, title, body }] = PAGES;

  it('moves the mark back when scrolling up, from the third section to the first (criterion 5)', async () => {
    const main = await openPage(path, title, body);
    scrollTo(THIRD);
    await waitFor(() => expectCurrent(main, 2));
    scrollTo(FIRST, 100);
    await waitFor(() => expectCurrent(main, 0));
  });

  it('updates the mark on a resize that moves the headings, with no scroll event (criterion 6)', async () => {
    const main = await openPage(path, title, body);
    resizeTo(SECOND);
    await waitFor(() => expectCurrent(main, 1));
    resizeTo(THIRD);
    await waitFor(() => expectCurrent(main, 2));
  });

  it('removes its scroll and resize listeners when the page unmounts (criterion 7)', async () => {
    const user = userEvent.setup();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const errors = vi.spyOn(console, 'error');
    const main = await openPage(path, title, body);
    scrollTo(SECOND);
    await waitFor(() => expectCurrent(main, 1));

    const listeners = added.mock.calls.filter(
      ([type]) => type === 'scroll' || type === 'resize',
    );
    expect(listeners.some(([type]) => type === 'scroll')).toBe(true);
    expect(listeners.some(([type]) => type === 'resize')).toBe(true);

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(primary).getByRole('link', { name: 'System Design' }));
    await screen.findByRole('heading', { level: 1, name: 'System Design' });
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument(),
    );

    for (const [type, listener] of listeners) {
      expect(
        removed.mock.calls.some(([t, l]) => t === type && l === listener),
        `${type} listener removed`,
      ).toBe(true);
    }

    // A later scroll or resize reaches no unmounted component.
    errors.mockClear();
    scrollTo(THIRD);
    resizeTo(SECOND);
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(errors).not.toHaveBeenCalled();
  });

  it('never scrolls the window itself during a scroll sequence (criterion 8)', async () => {
    const main = await openPage(path, title, body);
    const scrollToSpy = vi.spyOn(window, 'scrollTo');
    const scrollBy = vi.spyOn(window, 'scrollBy');
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');

    scrollTo(SECOND);
    await waitFor(() => expectCurrent(main, 1));
    scrollTo(THIRD);
    await waitFor(() => expectCurrent(main, 2));
    resizeTo(FIRST, 100);
    await waitFor(() => expectCurrent(main, 0));
    scrollTo([-2000, -1000, 300], BOTTOM);
    await waitFor(() => expectCurrent(main, headingIds.length - 1));

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

// Review decisions, round 1: "scrolled to the bottom" counts only when the
// page can scroll (scroll height > innerHeight + 2). A page that fits the
// viewport marked its last heading on load.

/** Overrides the stubbed document scroll height for one test. */
function setScrollHeight(height: number) {
  for (const el of [document.documentElement, document.body]) {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => height });
  }
}

/** Waits for one animation frame, so a scheduled update has run. */
async function nextFrame() {
  await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

describe.each(PAGES)(
  'scroll-spy on a $kind that fits the viewport',
  ({ path, title, body }) => {
    /** Every heading below its reading line, within the viewport. */
    const BELOW_LINE = [200, 400, 600];

    it.each([INNER_HEIGHT, INNER_HEIGHT + 2])(
      'marks no link when the scroll height is %ipx, every heading is below its reading line and nothing can scroll',
      async (height) => {
        setScrollHeight(height);
        const main = await openPage(path, title, body);
        // Recompute once the headings are in the DOM, still unscrolled.
        resizeTo(BELOW_LINE, 0);
        await nextFrame();
        await waitFor(() => expectCurrent(main, null));
        scrollTo(BELOW_LINE, 0);
        await nextFrame();
        expectCurrent(main, null);
      },
    );

    it('still marks the last link on a page that can scroll by 3px and is scrolled to its bottom', async () => {
      setScrollHeight(INNER_HEIGHT + 3);
      const main = await openPage(path, title, body);
      scrollTo(BELOW_LINE, 3);
      await waitFor(() => expectCurrent(main, headingIds.length - 1));
    });
  },
);
