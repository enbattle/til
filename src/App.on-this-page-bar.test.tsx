import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTopic } from '@/lib/content';
import { getDsaEntry } from '@/lib/dsa';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import { getCaseStudy } from '@/lib/system-design';
import { caseStudyBody, dsaEntryBody, rawTopic } from '@/test/content';
import { escapeRegExp, renderAt } from '@/test/render';

// docs/specs/on-this-page-bar.md: below `xl`, a sticky "On this page" bar at
// the top of the body replaces the <details> disclosure. Its button names the
// section being read and opens a panel of the same links. Rendered through the
// real App on a case study, a DSA entry and a catalog topic. jsdom applies no
// Tailwind CSS, so the bar and the right nav are both in the tree; the bar is
// the "On this page" navigation inside <main>. Layout is stubbed as in
// App.on-this-page-scroll-spy.test.tsx (each heading's viewport top by id, its
// computed scroll-margin-top, scrollY, innerHeight and the scroll height).

const NAME = 'On this page';
const MARGIN = 80;
const INNER_HEIGHT = 800;
const SCROLL_HEIGHT = 10000;
/** The existing heading scroll margin, kept from `xl` up (criterion 9). */
const XL_MARGIN = 'scroll-mt-[calc(var(--header-height,8rem)_+_0.75rem)]';

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

// ---- Layout stubs (from App.on-this-page-scroll-spy.test.tsx) -------------

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

function withMargin(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, prop) {
      if (prop === 'scrollMarginTop') return `${MARGIN}px`;
      if (prop === 'getPropertyValue')
        return (name: string) =>
          name === 'scroll-margin-top' ? `${MARGIN}px` : target.getPropertyValue(name);
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
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
    return tops.has(el.id) ? withMargin(style) : style;
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

function setLayout(headingTops: number[], y: number) {
  scrollY = y;
  let last = headingTops[headingTops.length - 1] ?? 1000;
  headingIds.forEach((id, i) => {
    if (i < headingTops.length) tops.set(id, headingTops[i]);
    else tops.set(id, (last += 400));
  });
}

/** Every heading below its reading line: nothing current. */
const INTRO = [1000];
/** The second heading past its reading line, the third not. */
const SECOND = [-400, 40, 400];

function scrollTo(headingTops: number[], y = 1000) {
  setLayout(headingTops, y);
  act(() => {
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
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
  await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
  return { main, prose: main.querySelector('.prose') as HTMLElement };
}

/** The "On this page" navigations outside <main>: the right nav. */
function rightNavs(main: HTMLElement) {
  return screen
    .queryAllByRole('navigation', { name: NAME })
    .filter((nav) => !main.contains(nav));
}

/** The bar: the one "On this page" navigation inside <main>. */
function bar(main: HTMLElement) {
  const found = within(main).getAllByRole('navigation', { name: NAME });
  expect(found).toHaveLength(1);
  return found[0];
}

/** The bar's disclosure button. */
function barButton(main: HTMLElement) {
  return within(bar(main)).getByRole('button', {
    name: new RegExp(`^${escapeRegExp(NAME)}`),
  });
}

/** The element the button's aria-controls names, or null when not rendered. */
function panelOf(button: HTMLElement) {
  const id = button.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  return document.getElementById(id!);
}

/** Links in the panel that are in the accessibility tree. */
function panelLinks(button: HTMLElement) {
  const panel = panelOf(button);
  return panel ? within(panel).queryAllByRole('link') : [];
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, main: HTMLElement) {
  const button = barButton(main);
  await user.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
  const panel = panelOf(button);
  expect(panel).not.toBeNull();
  return { button, panel: panel! };
}

function hrefs(links: HTMLElement[]) {
  return links.map((a) => a.getAttribute('href'));
}

// ---- Criteria -------------------------------------------------------------

describe.each(PAGES)('On this page bar on a $kind', ({ path, title, body }) => {
  it('is a navigation in <main> before the body’s first heading, with a closed button starting "On this page", and no <details> (criterion 1)', async () => {
    const { main, prose } = await openPage(path, title, body);
    const nav = bar(main);
    expect(nav.tagName).toBe('NAV');
    expect(prose.contains(nav)).toBe(false);

    const button = barButton(main);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button.textContent?.trim().startsWith(NAME)).toBe(true);

    const firstHeading = prose.querySelector('h2, h3, h4, h5, h6') as HTMLElement;
    expect(firstHeading).not.toBeNull();
    expect(
      nav.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(main.querySelector('details')).toBeNull();

    // The chevron is decorative.
    const icons = button.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('is sticky under the header’s published height, hidden from xl, layered at z-20 (criterion 2)', async () => {
    const { main } = await openPage(path, title, body);
    const nav = bar(main);
    expect(nav).toHaveClass('sticky', 'xl:hidden', 'z-20');
    const tokens = [...nav.classList];
    expect(
      tokens.some((t) => /^top-\[.*--header-height/.test(t)),
      `a top-[…--header-height…] token in "${nav.className}"`,
    ).toBe(true);
  });

  it('names just "On this page" with no section current, and adds the current section’s heading (criterion 3)', async () => {
    const { main } = await openPage(path, title, body);
    const button = barButton(main);
    expect(button.textContent?.trim()).toBe(NAME);

    const second = h2Headings(body())[1].text;
    scrollTo(SECOND);
    await waitFor(() => expect(button).toHaveTextContent(second));
    expect(button.textContent?.trim().startsWith(NAME)).toBe(true);
    expect(button).toHaveAccessibleName(new RegExp(escapeRegExp(second)));

    scrollTo(INTRO, 0);
    await waitFor(() => expect(button.textContent?.trim()).toBe(NAME));
  });

  it('toggles a panel, named by aria-controls, holding every ## heading’s link in body order, as the right nav (criterion 4)', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const expected = h2Headings(body()).map((h) => `#${h.id}`);
    const button = barButton(main);
    expect(button).toHaveAttribute('aria-controls');
    // Closed, its links aren't reachable.
    expect(panelLinks(button)).toHaveLength(0);

    const { panel } = await openPanel(user, main);
    expect(panel.id).toBe(button.getAttribute('aria-controls'));
    const links = within(panel).getAllByRole('link');
    expect(hrefs(links)).toEqual(expected);
    expect(hrefs(links)).toEqual(hrefs(within(rightNavs(main)[0]).getAllByRole('link')));

    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(panelLinks(button)).toHaveLength(0);
  });

  it('marks exactly the current section’s link in the open panel (criterion 5)', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button } = await openPanel(user, main);
    scrollTo(SECOND);
    await waitFor(() => {
      const links = panelLinks(button);
      expect(links).toHaveLength(headingIds.length);
      links.forEach((link, i) => {
        if (i === 1) expect(link).toHaveAttribute('aria-current', 'location');
        else expect(link, `#${headingIds[i]}`).not.toHaveAttribute('aria-current');
      });
    });
  });

  it('closes when a panel link is clicked, the link pointing at #<id> (criterion 6)', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button, panel } = await openPanel(user, main);
    const link = within(panel).getAllByRole('link')[1];
    expect(link).toHaveAttribute('href', `#${headingIds[1]}`);
    await user.click(link);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(panelLinks(button)).toHaveLength(0);
  });

  it('closes on Escape from inside the panel and returns focus to the button (criterion 7)', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button, panel } = await openPanel(user, main);
    expect(button).toHaveFocus();

    // Tab moves from the button into the panel's links (no focus trap).
    await user.tab();
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.tagName).toBe('A');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(button).toHaveFocus();
    expect(panelLinks(button)).toHaveLength(0);
  });

  it('closes on a pointerdown outside the bar and panel, but not on one on a panel link (criterion 8)', async () => {
    const user = userEvent.setup();
    const { main, prose } = await openPage(path, title, body);
    const { button } = await openPanel(user, main);

    const firstHeading = prose.querySelector('h2') as HTMLElement;
    fireEvent.pointerDown(firstHeading);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(panelLinks(button)).toHaveLength(0);

    const { panel } = await openPanel(user, main);
    const link = within(panel).getAllByRole('link')[0];
    fireEvent.pointerDown(link);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(link).toBeInTheDocument();
    expect(panelLinks(button)).toHaveLength(headingIds.length);
  });

  it('gives a rendered h2 the xl: scroll margin unchanged and a different narrow-screen margin on the header height (criterion 9)', async () => {
    const { prose } = await openPage(path, title, body);
    const h2 = prose.querySelector('h2') as HTMLElement;
    expect(h2).not.toBeNull();
    const tokens = [...h2.classList];
    expect(tokens).toContain(`xl:${XL_MARGIN}`);
    const narrow = tokens.filter((t) => t.startsWith('scroll-mt-'));
    expect(narrow, h2.className).toHaveLength(1);
    expect(narrow[0]).toContain('--header-height');
    expect(narrow[0]).not.toBe(XL_MARGIN);
  });
});

// Review finding: the panel is absolutely positioned over the body, so if it
// stayed open after keyboard focus left the bar, the focused body link under
// it would have its focus ring hidden (and Escape would no longer close it).
describe.each(PAGES)('On this page bar focus on a $kind', ({ path, title, body }) => {
  it('closes when Tab moves focus past the last panel link to outside the bar', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button, panel } = await openPanel(user, main);
    const nav = bar(main);
    const links = within(panel).getAllByRole('link');

    for (const link of links) {
      await user.tab();
      expect(link).toHaveFocus();
    }
    await user.tab();

    expect(document.activeElement).not.toBe(document.body);
    expect(nav.contains(document.activeElement)).toBe(false);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(panelLinks(button)).toHaveLength(0);
  });

  it('stays open while Tab moves focus from the button into and between panel links', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button, panel } = await openPanel(user, main);
    const links = within(panel).getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);

    await user.tab();
    expect(links[0]).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await user.tab();
    expect(links[1]).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panelLinks(button)).toHaveLength(headingIds.length);
  });

  it('stays open when Shift+Tab moves focus from the first panel link back to the button', async () => {
    const user = userEvent.setup();
    const { main } = await openPage(path, title, body);
    const { button, panel } = await openPanel(user, main);
    const links = within(panel).getAllByRole('link');

    await user.tab();
    expect(links[0]).toHaveFocus();

    await user.tab({ shift: true });
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panelLinks(button)).toHaveLength(headingIds.length);
  });
});

describe('pages without sections render no bar (criterion 10)', () => {
  it.each([
    ['/', 'til'],
    ['/ai-and-ml', 'AI & Machine Learning'],
    ['/system-design', 'System Design'],
    ['/dsa', 'Data Structures & Algorithms'],
  ] as const)('%s has no "On this page" button', async (path, heading) => {
    renderAt(path);
    await screen.findByRole('heading', { name: heading });
    expect(
      screen.queryByRole('button', { name: new RegExp(`^${escapeRegExp(NAME)}`) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument();
  });
});
