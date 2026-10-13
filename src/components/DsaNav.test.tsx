import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DSA_ENTRIES } from '@/lib/dsa';
import { renderAt } from '@/test/render';
import { DsaNav } from './DsaNav';

// DsaNav's own data and order (docs/specs/dsa-tab.md, criterion 8; dsa-kind-
// groups criterion 4): one labelled list per kind, numbered in one sequence,
// each link the entry's path (ui-dedupe criterion 2) and named by its title. The behaviour it shares
// with CaseStudyNav (landmark, aria-current, onNavigate, className, nothing
// current on the landing page) is tested once in OrderedNav.test.tsx, and the
// mobile nav's choice of nav per route in App.tabs.test.tsx
// (docs/specs/ui-dedupe.md, design item 6). That DsaNav forwards className and
// onNavigate to OrderedNav is checked in CaseStudyNav.test.tsx's last block,
// and that App and MobileNav pass them in, in App.tabs.test.tsx.

const NAV_NAME = 'DSA entries';

function renderNav(initialPath = '/dsa') {
  return renderAt(initialPath, <DsaNav />);
}

function nav() {
  return screen.getByRole('navigation', { name: NAV_NAME });
}

// docs/specs/dsa-kind-groups.md, criterion 4. The groups, computed from the
// entries' kinds: kind order, each group in DSA_ENTRIES order.
const KIND_GROUPS = (
  [
    ['data-structure', 'Data structures'],
    ['pattern', 'Patterns'],
    ['algorithm', 'Algorithms'],
  ] as const
)
  .map(([kind, heading]) => ({
    kind,
    heading,
    entries: DSA_ENTRIES.filter((e) => e.kind === kind),
  }))
  .filter((g) => g.entries.length > 0);

/** Checks `navEl` holds one labelled list per group, as criterion 4 asks. */
function expectGroupedLists(navEl: HTMLElement) {
  expect(KIND_GROUPS.map((g) => g.heading)).toEqual([
    'Data structures',
    'Patterns',
    'Algorithms',
  ]);
  const lists = within(navEl).getAllByRole('list');
  expect(lists.map((l) => l.tagName)).toEqual(KIND_GROUPS.map(() => 'OL'));
  // Each list is named by its group's label, which comes right before it.
  let number = 0;
  KIND_GROUPS.forEach((group, i) => {
    const list = lists[i];
    expect(list).toHaveAccessibleName(group.heading);
    const labelId = list.getAttribute('aria-labelledby');
    expect(labelId, group.heading).toBeTruthy();
    const label = document.getElementById(labelId!);
    expect(label).not.toBeNull();
    expect(navEl.contains(label)).toBe(true);
    expect(label!.textContent?.trim()).toBe(group.heading);
    expect(label!.tagName).toBe('P');
    expect(
      label!.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    if (i > 0) {
      expect(
        lists[i - 1].compareDocumentPosition(label!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      group.entries.map((e) => e.path),
    );
    // Each link's text is its entry's title.
    group.entries.forEach((entry, j) => {
      expect(links[j]).toHaveTextContent(entry.title);
    });
    expect(Number(list.getAttribute('start') ?? '1')).toBe(number + 1);
    for (const link of links) {
      number += 1;
      const visible = link.querySelector('[aria-hidden="true"]');
      expect(visible?.textContent?.trim()).toBe(`${number}.`);
    }
  });
  // Across the lists, the links are exactly DSA_ENTRIES in order.
  expect(
    within(navEl)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href')),
  ).toEqual(DSA_ENTRIES.map((e) => e.path));
  expect(number).toBe(DSA_ENTRIES.length);
}

describe('DsaNav groups (dsa-kind-groups criterion 4)', () => {
  it('shows the group labels in kind order, each naming the list of its links, numbered 1..N', () => {
    renderNav();
    expectGroupedLists(nav());
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the "DSA" label above the groups', () => {
    renderNav();
    const first = nav().querySelector('p');
    expect(first?.textContent?.trim()).toBe('DSA');
  });
});
