import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getTopic } from '@/lib/content';
import { getDsaEntry } from '@/lib/dsa';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import { CASE_STUDIES, getCaseStudy } from '@/lib/system-design';
import { caseStudyBody, dsaEntryBody, rawTopic } from '@/test/content';
import { escapeRegExp, renderAt } from '@/test/render';

// The "On this page" navigation, through the real App on a case study, a DSA
// entry and a catalog topic:
// - docs/specs/on-this-page-nav.md: the wider shell and the right-hand nav
//   (outside <main>);
// - docs/specs/on-this-page-bar.md: below `xl`, a sticky bar at the top of the
//   body (inside <main>) whose button names the section being read and opens a
//   panel of the same links, replacing the old <details> disclosure;
// - review finding L3: links and rendered h2 ids agree for headings with inline
//   markdown, and duplicate headings get distinct ids, on a mocked case study.
// jsdom applies no Tailwind CSS, so the bar and the right nav are both in the
// tree; the tests tell them apart by whether they sit inside <main>, and pin
// the class tokens that hide one or the other. Layout is stubbed as in
// App.on-this-page-scroll-spy.test.tsx (each heading's viewport top by id, the
// root's computed scroll-padding-top with each heading's scroll-margin-top at
// 0, scrollY, innerHeight and the scroll height),
// which covers marking the current section. Stage 4's browser check verifies
// the real layout.

const NAME = 'On this page';
/** The root's stubbed scroll-padding-top: the reading line. */
const PADDING = 80;
const INNER_HEIGHT = 800;
const SCROLL_HEIGHT = 10000;

/** The mocked case study's body: inline markdown and a repeated heading. */
const DEMO_BODY = [
  '## Deep dive: the `user_id` index',
  '',
  'Text about the index.',
  '',
  '## Why *this* matters',
  '',
  'Text about why.',
  '',
  '## Notes',
  '',
  'First notes.',
  '',
  '## Notes',
  '',
  'Second notes.',
  '',
].join('\n');

// Adds a "demo" case study with DEMO_BODY; every real case study is unchanged.
vi.mock('@/lib/system-design', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/system-design')>('@/lib/system-design');
  const demo = {
    slug: 'demo',
    title: 'Design a Demo',
    summary: 'A demo.',
    date: '2026-09-28',
    order: 999,
    words: 1,
  };
  return {
    ...actual,
    CASE_STUDIES: [...actual.CASE_STUDIES, demo],
    getCaseStudy: (slug: string) => (slug === 'demo' ? demo : actual.getCaseStudy(slug)),
    loadCaseStudyBody: (slug: string) =>
      slug === 'demo' ? Promise.resolve(DEMO_BODY) : actual.loadCaseStudyBody(slug),
    topicsForCaseStudy: (caseStudy: { slug: string }) =>
      caseStudy.slug === 'demo'
        ? []
        : actual.topicsForCaseStudy(
            caseStudy as Parameters<typeof actual.topicsForCaseStudy>[0],
          ),
  };
});

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

/** Renders a page with every heading below its reading line, once its body
 * (a lazily loaded chunk) and the right nav are in. */
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

/** The right column: the shell's element hidden below `xl` and shown from it,
 * outside <main>. */
function rightColumns(main: HTMLElement) {
  const shell = main.parentElement as HTMLElement;
  return [...shell.querySelectorAll<HTMLElement>('[class~="xl:block"]')].filter(
    (el) => !main.contains(el) && !el.contains(main),
  );
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

// ---- The right nav (docs/specs/on-this-page-nav.md) -----------------------

describe.each(PAGES)('On this page on a $kind', ({ path, title, body }) => {
  it('has a right nav outside <main> linking #<id> of every ## heading, in order, each id on a rendered h2 (criterion 1)', async () => {
    const { main, prose } = await openPage(path, title, body);
    const headings = h2Headings(body());
    expect(headings.length).toBeGreaterThan(0);

    const [nav] = rightNavs(main);
    expect(nav.tagName).toBe('NAV');
    const links = within(nav).getAllByRole('link');
    expect(hrefs(links)).toEqual(headings.map((h) => `#${h.id}`));
    expect(links.map((a) => a.textContent?.trim())).toEqual(headings.map((h) => h.text));
    for (const { id } of headings) {
      const target = document.getElementById(id);
      expect(target, `#${id}`).not.toBeNull();
      expect(target!.tagName).toBe('H2');
      expect(prose.contains(target)).toBe(true);
    }
    // Labelled by a small text label, not a heading (no skipped levels).
    expect(within(nav).queryByRole('heading')).not.toBeInTheDocument();
    expect(nav).toHaveTextContent(NAME);
  });

  it('lists the right nav as an ordered list without visible numbers, in the left nav’s non-current link style', async () => {
    const { main } = await openPage(path, title, body);
    const [nav] = rightNavs(main);
    const list = nav.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list).not.toHaveClass('list-decimal');
    // The scroll-spy may mark a link current; that one is covered by
    // App.on-this-page-scroll-spy.test.tsx, and every other link keeps the
    // non-current style.
    for (const link of within(nav).getAllByRole('link')) {
      expect(list!.contains(link)).toBe(true);
      expect(link).toHaveClass('border-l-2');
      if (link.hasAttribute('aria-current')) continue;
      expect(link).toHaveClass('border-transparent', 'hover:border-accent');
    }
  });

  it('has no navigation named "Contents" (criterion 3)', async () => {
    await openPage(path, title, body);
    expect(
      screen.queryByRole('navigation', { name: 'Contents' }),
    ).not.toBeInTheDocument();
  });

  it('puts the right nav in a column hidden below xl and shown from xl (criterion 7)', async () => {
    const { main } = await openPage(path, title, body);
    const [nav] = rightNavs(main);

    const columns = rightColumns(main);
    expect(columns).toHaveLength(1);
    expect(columns[0]).toHaveClass('hidden', 'xl:block');
    expect(columns[0].contains(nav)).toBe(true);
    expect(columns[0].tagName).not.toBe('ASIDE');
  });
});

// ---- The bar (docs/specs/on-this-page-bar.md) -----------------------------

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

  // docs/specs/focus-not-obscured.md, criterion 2 (replacing bar criterion 9):
  // the root's scroll-padding-top (src/index.css, criterion 1, tested in
  // src/index-css.test.ts) now keeps a jump below the sticky header and bar,
  // and a heading margin on top of it would double the offset.
  it('gives no rendered h2 a scroll-mt-* class at any breakpoint (focus-not-obscured criterion 2)', async () => {
    const { prose } = await openPage(path, title, body);
    const headings = [...prose.querySelectorAll('h2')];
    expect(headings.length).toBeGreaterThan(0);
    for (const h2 of headings) {
      const margins = [...h2.classList].filter((t) => /(^|:)scroll-mt-/.test(t));
      expect(margins, `#${h2.id}: ${h2.className}`).toEqual([]);
    }
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

// ---- Other pages and the shell --------------------------------------------

describe('pages without sections (nav criterion 4, bar criterion 10)', () => {
  it.each([
    ['/', 'til'],
    ['/ai-and-ml', 'AI & Machine Learning'],
    ['/system-design', 'System Design'],
    ['/dsa', 'Data Structures & Algorithms'],
    ['/not-found', /page not found/i],
  ] as const)(
    '%s renders no "On this page" nav, button or disclosure, but keeps an empty right column',
    async (path, heading) => {
      renderAt(path);
      await screen.findByRole('heading', { name: heading });
      expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: new RegExp(`^${escapeRegExp(NAME)}`) }),
      ).not.toBeInTheDocument();
      expect(document.querySelector('details')).toBeNull();
      expect(screen.queryByText(NAME)).not.toBeInTheDocument();

      const main = screen.getByRole('main');
      const columns = rightColumns(main);
      expect(columns).toHaveLength(1);
      expect(columns[0]).toHaveClass('hidden', 'xl:block');
      expect(columns[0]).toBeEmptyDOMElement();
    },
  );
});

describe('moving between pages (criterion 5)', () => {
  it('shows only the new case study’s links after moving to another, and none on the landing page', async () => {
    const user = userEvent.setup();
    const [first, second] = CASE_STUDIES;
    const firstHrefs = h2Headings(caseStudyBody(first.slug)).map((h) => `#${h.id}`);
    const secondHrefs = h2Headings(caseStudyBody(second.slug)).map((h) => `#${h.id}`);
    expect(secondHrefs).not.toEqual(firstHrefs);

    const { main } = await openPage(`/system-design/${first.slug}`, first.title, () =>
      caseStudyBody(first.slug),
    );
    expect(hrefs(within(rightNavs(main)[0]).getAllByRole('link'))).toEqual(firstHrefs);

    const caseStudyNav = screen.getByRole('navigation', { name: 'Case studies' });
    await user.click(
      within(caseStudyNav).getByRole('link', {
        name: new RegExp(escapeRegExp(second.title)),
      }),
    );
    await screen.findByRole('heading', { level: 1, name: second.title });
    await waitFor(() =>
      expect(screen.getByRole('main').querySelector('.prose')).not.toBeNull(),
    );
    await waitFor(() => {
      const navs = rightNavs(screen.getByRole('main'));
      expect(navs).toHaveLength(1);
      expect(hrefs(within(navs[0]).getAllByRole('link'))).toEqual(secondHrefs);
    });

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(primary).getByRole('link', { name: 'System Design' }));
    await screen.findByRole('heading', { level: 1, name: 'System Design' });
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument(),
    );
    expect(rightColumns(screen.getByRole('main'))[0]).toBeEmptyDOMElement();
  });
});

describe('shell widths (criterion 8)', () => {
  it('caps the header row and the shell at 1440px and <main> at 800px', () => {
    renderAt('/');
    const main = screen.getByRole('main');
    const shell = main.parentElement as HTMLElement;
    expect(shell).toHaveClass('max-w-[90rem]', 'px-4');
    expect(shell).not.toHaveClass('max-w-5xl');

    const headerRow = screen.getByRole('banner').firstElementChild as HTMLElement;
    expect(headerRow).toHaveClass('max-w-[90rem]', 'px-4');
    expect(headerRow).not.toHaveClass('max-w-5xl');

    expect(main).toHaveClass('max-w-[50rem]');
    expect(main).not.toHaveClass('max-w-3xl');
  });
});

// ---- Heading ids with inline markdown and duplicates (review finding L3) ---

function duplicateKeyErrors(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    args.some((arg) => typeof arg === 'string' && /same key|unique "key"/i.test(arg)),
  );
}

describe('MarkdownRenderer heading ids', () => {
  it('gives duplicate h2 headings distinct ids', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <MarkdownRenderer content={DEMO_BODY} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const ids = [...container.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toEqual([
      'deep-dive-the-user-id-index',
      'why-this-matters',
      'notes',
      'notes-1',
    ]);
  });
});

describe('CaseStudyPage "On this page" with inline markdown and repeated headings', () => {
  // Both copies are checked: the open panel of the bar inside <main> and the
  // right nav outside it.
  async function renderDemo() {
    const user = userEvent.setup();
    renderAt('/system-design/demo');
    await screen.findByRole('heading', { level: 1, name: 'Design a Demo' });
    const main = screen.getByRole('main');
    await waitFor(() => expect(main.querySelectorAll('.prose h2').length).toBe(4));
    const right = await waitFor(() => {
      const outside = rightNavs(main);
      expect(outside).toHaveLength(1);
      return outside[0];
    });
    const { panel } = await openPanel(user, main);
    return { main, navs: [panel, right] };
  }

  it('links every entry to the id of the h2 it names, in both copies', async () => {
    const { main, navs } = await renderDemo();
    const headings = [...main.querySelectorAll('.prose h2')];
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links).toHaveLength(headings.length);
      links.forEach((link, i) => {
        expect(link).toHaveAttribute('href', `#${headings[i].id}`);
        expect(headings[i].id).not.toBe('');
        expect(document.querySelector(`[id="${headings[i].id}"]`)).toBe(headings[i]);
      });
    }
  });

  it('labels an entry with the heading as it renders', async () => {
    const { navs } = await renderDemo();
    for (const nav of navs) {
      const labels = within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(labels).toEqual([
        'Deep dive: the user_id index',
        'Why this matters',
        'Notes',
        'Notes',
      ]);
    }
  });

  it('gives two identical headings distinct ids and links, with no duplicate-key warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { navs } = await renderDemo();
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link', { name: 'Notes' });
      expect(hrefs(links)).toEqual(['#notes', '#notes-1']);
    }
    expect(duplicateKeyErrors(error)).toEqual([]);
  });
});
