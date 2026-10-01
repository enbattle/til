import { isDsaPath } from './dsa';
import { isSystemDesignPath } from './system-design';

type Tab = 'catalog' | 'system-design' | 'dsa';

/** Which header tab a route belongs to: System Design and DSA own their
 * routes, and Catalog owns every other one (topic pages included). The header
 * marks that tab current, and the sidebar and mobile nav show its nav. */
export function tabForPath(pathname: string): Tab {
  if (isSystemDesignPath(pathname)) return 'system-design';
  if (isDsaPath(pathname)) return 'dsa';
  return 'catalog';
}
