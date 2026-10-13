import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useModal } from '@/hooks/useFocusTrap';
import { tabForPath } from '@/lib/tabs';
import { CaseStudyNav } from './CaseStudyNav';
import { SectionNav } from './SectionNav';

interface MobileNavProps {
  onClose: () => void;
}

/**
 * Narrow-viewport nav overlay: fixed backdrop + a panel sliding in from the
 * left edge, containing the same nav tree the persistent desktop sidebar
 * uses (`CaseStudyNav` on System Design routes, `SectionNav` everywhere
 * else).
 * A modal like `SearchDialog` (`useModal`: focus moves to the first link on
 * open, Tab stays inside, Escape closes, focus returns to the Menu button),
 * opening from the left edge instead of a centered panel.
 */
export function MobileNav({ onClose }: MobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tab = tabForPath(useLocation().pathname);

  useModal(panelRef, { onClose });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="scrollbar-thin h-full w-72 max-w-[80vw] overflow-y-auto overflow-x-hidden border-r border-border bg-bg-primary p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {tab === 'system-design' ? (
          <CaseStudyNav onNavigate={onClose} />
        ) : (
          <SectionNav onNavigate={onClose} />
        )}
      </div>
    </div>
  );
}
