/** The header tabs, in header order, each with the landing route it links to.
 * System Design owns its landing route and every route under it;
 * Catalog owns every other route (topic pages included). The one definition
 * the header, the sidebar and the mobile nav share. */
export const TABS = [
  { id: 'catalog', label: 'Catalog', to: '/' },
  { id: 'system-design', label: 'System Design', to: '/system-design' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** Which header tab a route belongs to: the tab whose `to` is the path or
 * prefixes it as `<to>/…`, and Catalog for anything else. The header marks
 * that tab current, and the sidebar and mobile nav show its nav. */
export function tabForPath(pathname: string): TabId {
  const owner = TABS.find(
    (tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  );
  return owner?.id ?? 'catalog';
}
