import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSection } from '@/content/registry';
import { TOPICS } from '@/lib/content';
import { CASE_STUDIES } from '@/lib/system-design';
import { renderAt } from '@/test/render';

// docs/specs/ui-dedupe.md, design item 6: Previous/Next and "unknown slug →
// not found" over the two kinds of page, through the whole app. Each
// replaces a per-kind copy: App.system-design.test.tsx's adjacency cases and
// unknown-slug test, and TopicPage.test.tsx's first/last-topic and
// unknown-slug tests. The expected links are each neighbour's `path`
// (criterion 2).

interface Item {
  slug: string;
  title: string;
  path: string;
}

const SECTION = 'ai-and-ml';

/** A section's topics in title order: the list a topic's Previous/Next walks. */
const SECTION_TOPICS = TOPICS.filter((t) => t.section === SECTION).sort((a, b) =>
  a.title.localeCompare(b.title),
);

const KINDS: {
  kind: string;
  /** The ordered list Previous/Next walks. */
  list: readonly Item[];
  /** The route of an item, built by hand so the page opens even before
   * `path` exists. */
  route: (item: Item) => string;
  /** The Previous/Next navigation's accessible name. */
  pager: string;
  unknown: string;
}[] = [
  {
    kind: 'catalog topic',
    list: SECTION_TOPICS,
    route: (item) => `/${SECTION}/${item.slug}`,
    pager: `More in ${getSection(SECTION)?.label}`,
    unknown: `/${SECTION}/no-such-topic`,
  },
  {
    kind: 'case study',
    list: CASE_STUDIES,
    route: (item) => `/system-design/${item.slug}`,
    pager: 'More case studies',
    unknown: '/system-design/no-such-case-study',
  },
];

describe.each(KINDS)('Previous/Next on a $kind', ({ list, route, pager }) => {
  it('has at least three items to walk', () => {
    expect(list.length).toBeGreaterThanOrEqual(3);
  });

  // First, middle and last cover no-previous, both, and no-next.
  const cases = [...new Set([0, Math.floor(list.length / 2), list.length - 1])].map(
    (i) => [list[i].slug, i] as const,
  );

  it.each(cases)(
    '%s links to its neighbours’ paths, each only when it exists',
    async (_slug, index) => {
      renderAt(route(list[index]));
      // The navigation is added once the body has loaded.
      const nav = await screen.findByRole('navigation', { name: pager });
      const prev = list[index - 1];
      const next = list[index + 1];
      const expected = [
        ...(prev ? [[`← ${prev.title}`, prev.path]] : []),
        ...(next ? [[`${next.title} →`, next.path]] : []),
      ];
      expect(
        within(nav)
          .getAllByRole('link')
          .map((a) => [a.textContent, a.getAttribute('href')]),
      ).toEqual(expected);
    },
  );
});

describe.each(KINDS)('An unknown $kind slug', ({ unknown }) => {
  it(`shows the not-found page at ${unknown}`, async () => {
    renderAt(unknown);
    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

// docs/specs/remove-dsa-tab.md, criterion 2: the retired tab's routes are
// unknown routes like any other, with no redirect and no special case: each
// lands on the same not-found page, by the same route, as an unknown non-DSA
// section or topic (the first two paths are those controls).
describe('The retired DSA routes', () => {
  it.each([
    '/no-such-section',
    `/${SECTION}/no-such-topic`,
    '/dsa',
    '/dsa/binary-search',
    '/dsa/no-such-entry',
  ])('%s lands on /not-found like any unknown section or topic', async (path) => {
    renderAt(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/not-found$/);
  });
});
