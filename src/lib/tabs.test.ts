import { describe, expect, it } from 'vitest';
import { TABS, tabForPath } from './tabs';

// docs/specs/ui-dedupe.md, criterion 1: one definition of the header tabs and
// the routes each owns. This table replaces the separate isSystemDesignPath
// and isDsaPath tests; App.tabs.test.tsx checks the header, the sidebar and
// the mobile nav per tab.

describe('TABS', () => {
  it('lists Catalog, System Design and DSA in header order, each with its landing route', () => {
    expect(TABS).toEqual([
      { id: 'catalog', label: 'Catalog', to: '/' },
      { id: 'system-design', label: 'System Design', to: '/system-design' },
      { id: 'dsa', label: 'DSA', to: '/dsa' },
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
    ['/dsa', 'dsa'],
    ['/dsa/heap', 'dsa'],
    ['/dsa/binary-search', 'dsa'],
    // A route that only starts with a tab's text belongs to the catalog.
    ['/dsa-notes', 'catalog'],
    ['/dsas', 'catalog'],
    ['/system-designer', 'catalog'],
    ['/system-designs', 'catalog'],
    // A tab's text deeper in a catalog route doesn't move it either.
    ['/ai-and-ml/dsa', 'catalog'],
    ['/networking/system-design', 'catalog'],
  ] as const)('maps %s to %s', (path, tab) => {
    expect(tabForPath(path)).toBe(tab);
  });
});
