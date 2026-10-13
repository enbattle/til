import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TABS } from '@/lib/tabs';
import { renderAt } from '@/test/render';

// docs/specs/ui-dedupe.md, criterion 1, through the whole app: one test per
// tab, over its landing route and one of its item routes. The header shows the
// tabs from TABS with only this one current; the persistent sidebar and the
// mobile nav show this tab's nav and not the other. This replaces
// Header.tabs.test.tsx, MobileNav.system-design.test.tsx and the "sidebar
// selection" block of App.system-design.test.tsx; tabs.test.ts holds the
// table of routes. docs/specs/remove-dsa-tab.md, criteria 1 and 2: exactly
// two tabs, no nav ever lists DSA entries (the retired nav's name stays in
// NAVS so every route checks it is absent), and the retired /dsa routes are
// unknown catalog routes. On each tab's item route it also checks the wiring that
// OrderedNav.test.tsx can't see: App's sidebar classes reach the nav element,
// and MobileNav's onClose reaches the nav's links (clicking the current page's
// link changes no route, so only onNavigate can close the dialog).

const NAVS = ['Sections', 'Case studies', 'DSA entries'] as const;
const TAB_LABELS = ['Catalog', 'System Design'];

const CASES = [
  {
    id: 'catalog',
    label: 'Catalog',
    nav: 'Sections',
    paths: [
      '/',
      '/ai-and-ml',
      '/ai-and-ml/prompt-engineering',
      '/not-found',
      '/dsa',
      '/dsa/binary-search',
    ],
    item: '/ai-and-ml/prompt-engineering',
  },
  {
    id: 'system-design',
    label: 'System Design',
    nav: 'Case studies',
    paths: ['/system-design', '/system-design/url-shortener'],
    item: '/system-design/url-shortener',
  },
] as const;

function primaryNav() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

/** Renders the app at `path` and waits for the page's h1, so the lazy routes
 * have settled before anything is asserted. */
async function open(path: string) {
  renderAt(path);
  await screen.findByRole('heading', { level: 1 });
}

describe.each(CASES)('the $label tab', ({ id, label, nav, paths, item }) => {
  it.each(paths)(
    `header at %s: the tabs from TABS, in order, with only ${label} current`,
    async (path) => {
      await open(path);
      const links = within(primaryNav()).getAllByRole('link');
      expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual(
        TABS.map((tab) => [tab.label, tab.to]),
      );
      expect(links.map((a) => a.textContent?.trim())).toEqual(TAB_LABELS);
      const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map((a) => a.textContent?.trim())).toEqual([label]);
      expect(TABS.find((tab) => tab.label === label)?.id).toBe(id);
    },
  );

  it.each(paths)(
    `sidebar and mobile nav at %s: only the ${nav} nav, and a link in the mobile nav closes it`,
    async (path) => {
      const user = userEvent.setup();
      await open(path);

      // The persistent sidebar (the inactive navs are hidden, so out of the
      // accessibility tree).
      expect(screen.getByRole('navigation', { name: nav })).toBeInTheDocument();
      for (const other of NAVS.filter((name) => name !== nav)) {
        expect(screen.queryByRole('navigation', { name: other })).not.toBeInTheDocument();
      }

      // The mobile nav.
      await user.click(screen.getByRole('button', { name: /menu/i }));
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      const inDialog = within(dialog).getByRole('navigation', { name: nav });
      for (const other of NAVS.filter((name) => name !== nav)) {
        expect(
          within(dialog).queryByRole('navigation', { name: other }),
        ).not.toBeInTheDocument();
      }
      await user.click(within(inDialog).getAllByRole('link')[0]);
      expect(
        screen.queryByRole('dialog', { name: 'Navigation' }),
      ).not.toBeInTheDocument();
    },
  );

  it(`at ${item}: the sidebar nav has App's classes, and the mobile nav's link to the current page closes it`, async () => {
    const user = userEvent.setup();
    await open(item);

    // App passes `${SIDE_COLUMN} lg:block` to the sidebar nav.
    expect(screen.getByRole('navigation', { name: nav }).className).toContain('lg:block');

    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    const inDialog = within(dialog).getByRole('navigation', { name: nav });
    const current = within(inDialog)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === item);
    expect(current).toHaveLength(1);
    await user.click(current[0]);
    expect(screen.getByTestId('location-display')).toHaveTextContent(item);
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});
