import { describe, expect, it } from 'vitest';
import { TABS, tabForPath } from './tabs';

// docs/specs/ui-dedupe.md, criterion 1: one definition of the header tabs and
// the routes each owns. This table replaces the separate isSystemDesignPath
// test; App.tabs.test.tsx checks the header, the sidebar and the mobile nav
// per tab. docs/specs/remove-dsa-tab.md, criterion 1: exactly two tabs.

describe('TABS', () => {
  it('lists Catalog and System Design in header order, each with its landing route', () => {
    expect(TABS).toEqual([
      { id: 'catalog', label: 'Catalog', to: '/' },
      { id: 'system-design', label: 'System Design', to: '/system-design' },
    ]);
  });

  it('maps each tab’s own landing route to that tab', () => {
    for (const tab of TABS) expect(tabForPath(tab.to), tab.to).toBe(tab.id);
  });
});

describe('tabForPath', () => {
  it.each([
    ['/', 'catalog'],
    ['/networking', 'catalog'],
    ['/networking/dns', 'catalog'],
    ['/ai-and-ml/prompt-engineering', 'catalog'],
    ['/not-found', 'catalog'],
    ['/system-design', 'system-design'],
    ['/system-design/x', 'system-design'],
    ['/system-design/url-shortener', 'system-design'],
    // The retired DSA tab's routes are unknown catalog routes now
    // (docs/specs/remove-dsa-tab.md, criterion 2).
    ['/dsa', 'catalog'],
    ['/dsa/heap', 'catalog'],
    // A route that only starts with a tab's text belongs to the catalog.
    ['/system-designer', 'catalog'],
    ['/system-designs', 'catalog'],
    // A tab's text deeper in a catalog route doesn't move it either.
    ['/networking/system-design', 'catalog'],
  ] as const)('maps %s to %s', (path, tab) => {
    expect(tabForPath(path)).toBe(tab);
  });
});
