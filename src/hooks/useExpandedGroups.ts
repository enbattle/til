import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Expand/collapse state for a nav tree of collapsible groups (`SectionNav`'s
 * sections, `QuestionNav`'s questions). Only the group containing the current
 * route (`currentKey`) starts expanded; navigating to a different group
 * auto-expands it without ever collapsing one the user already opened.
 */
export function useExpandedGroups(currentKey: string | undefined) {
  const { pathname } = useLocation();

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(currentKey ? [currentKey] : []),
  );

  // Auto-expand the newly-current group on navigation (search, a cross-link,
  // browser back/forward, …) without collapsing anything the user already
  // opened manually.
  useEffect(() => {
    if (!currentKey) return;
    setExpanded((prev) => {
      if (prev.has(currentKey)) return prev;
      const next = new Set(prev);
      next.add(currentKey);
      return next;
    });
    // Keyed on pathname, not currentKey: re-navigating within a group the
    // user collapsed re-expands it, as it always has. currentKey is derived
    // from pathname, so it can't be stale here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return { isExpanded: (key: string) => expanded.has(key), toggle };
}
