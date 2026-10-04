import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DSA_ENTRIES } from '@/lib/dsa';
import { renderAt } from '@/test/render';
import { DsaNav } from './DsaNav';
import { MobileNav } from './MobileNav';

// docs/specs/dsa-tab.md, criterion 8: `DsaNav` is a flat ordered list of the
// entries like `CaseStudyNav`, and MobileNav shows it on DSA routes.

const NAV_NAME = 'DSA entries';

function renderNav(
  initialPath = '/dsa',
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return renderAt(initialPath, <DsaNav {...extra} />);
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
      group.entries.map((e) => `/dsa/${e.slug}`),
    );
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
  ).toEqual(DSA_ENTRIES.map((e) => `/dsa/${e.slug}`));
  expect(number).toBe(DSA_ENTRIES.length);
}

describe('DsaNav groups (dsa-kind-groups criterion 4)', () => {
  it('shows the group labels in kind order, each naming the list of its links, numbered 1..N', () => {
    renderNav();
    expectGroupedLists(nav());
  });

  it('keeps the "DSA" label above the groups', () => {
    renderNav();
    const first = nav().querySelector('p');
    expect(first?.textContent?.trim()).toBe('DSA');
  });

  it('still marks the current entry with aria-current="page" when grouped', () => {
    const slug = KIND_GROUPS.at(-1)!.entries[0].slug;
    renderNav(`/dsa/${slug}`);
    expectGroupedLists(nav());
    const current = within(nav())
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual([`/dsa/${slug}`]);
  });
});

describe('DsaNav (criterion 8)', () => {
  it('lists exactly one link per entry, in DSA_ENTRIES order, each to its page', () => {
    renderNav();
    const links = within(nav()).getAllByRole('link');
    expect(DSA_ENTRIES.length).toBeGreaterThan(0);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      DSA_ENTRIES.map((e) => `/dsa/${e.slug}`),
    );
    DSA_ENTRIES.forEach((entry, i) => expect(links[i]).toHaveTextContent(entry.title));
  });

  it('is an ordered list with no disclosure buttons', () => {
    renderNav('/dsa/binary-search');
    expect(nav().querySelector('ol')).not.toBeNull();
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });

  it('marks no link current on the landing page', () => {
    renderNav('/dsa');
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it.each(DSA_ENTRIES.map((e) => [e.slug] as const))(
    'marks only %s current (aria-current, bold, accent border) on its page',
    (slug) => {
      renderNav(`/dsa/${slug}`);
      for (const link of within(nav()).getAllByRole('link')) {
        if (link.getAttribute('href') === `/dsa/${slug}`) {
          expect(link).toHaveAttribute('aria-current', 'page');
          expect(link).toHaveClass('font-bold');
          expect(link).toHaveClass('border-accent');
        } else {
          expect(link).not.toHaveAttribute('aria-current');
          expect(link).not.toHaveClass('font-bold');
        }
      }
    },
  );

  it('calls onNavigate and navigates when a link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderNav('/dsa', { onNavigate });
    await user.click(within(nav()).getAllByRole('link')[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/dsa/${DSA_ENTRIES[0].slug}`,
    );
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/dsa', { className: 'my-custom-class' });
    expect(nav()).toHaveClass('my-custom-class');
  });
});

describe('MobileNav on DSA routes (criterion 8)', () => {
  function renderMobileNav(path: string) {
    const onClose = vi.fn();
    renderAt(path, <MobileNav onClose={onClose} />);
    return onClose;
  }

  it.each(['/dsa', '/dsa/binary-search'])(
    'renders the DSA nav, not Sections or Case studies, in the dialog at %s',
    (path) => {
      renderMobileNav(path);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      const dsa = within(dialog).getByRole('navigation', { name: NAV_NAME });
      expect(
        within(dsa)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(DSA_ENTRIES.map((e) => `/dsa/${e.slug}`));
      expect(
        screen.queryByRole('navigation', { name: 'Sections' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Case studies' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(['/dsa', '/dsa/binary-search'])(
    'shows the DSA nav grouped by kind, numbered 1..N, in the dialog at %s (dsa-kind-groups criterion 4)',
    (path) => {
      renderMobileNav(path);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expectGroupedLists(within(dialog).getByRole('navigation', { name: NAV_NAME }));
    },
  );

  it('marks the current entry with aria-current="page"', () => {
    renderMobileNav('/dsa/binary-search');
    const current = within(screen.getByRole('navigation', { name: NAV_NAME }))
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/dsa/binary-search']);
  });

  it('closes when an entry link is clicked', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav('/dsa');
    const dsa = screen.getByRole('navigation', { name: NAV_NAME });
    await user.click(within(dsa).getAllByRole('link')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Case studies, not the DSA nav, on a System Design route', () => {
    renderMobileNav('/system-design/url-shortener');
    expect(screen.getByRole('navigation', { name: 'Case studies' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: NAV_NAME })).not.toBeInTheDocument();
  });

  it('shows Sections, not the DSA nav, on a catalog route', () => {
    renderMobileNav('/ai-and-ml/prompt-engineering');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: NAV_NAME })).not.toBeInTheDocument();
  });
});
