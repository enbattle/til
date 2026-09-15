import { useEffect, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { SectionNav } from './SectionNav';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MobileNavProps {
  onClose: () => void;
}

/**
 * Narrow-viewport nav overlay: fixed backdrop + a panel sliding in from the
 * left edge, containing the same `SectionNav` tree the persistent desktop
 * sidebar uses. Mirrors `SearchDialog`'s overlay/focus-trap/close-on-navigate
 * pattern, opening from the left edge instead of a centered panel.
 */
export function MobileNav({ onClose }: MobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Called before any other effect that might move focus, so it captures
  // whatever had focus before the overlay opened (the Menu button) and
  // restores it on close, exactly as SearchDialog does for its own trigger.
  useFocusTrap(true, panelRef);

  // Moves focus into the panel on open, mirroring SearchDialog's own
  // input-focus effect — without this, Tab escapes straight into whatever's
  // behind the backdrop since useFocusTrap only traps Tab once focus is
  // already inside the container.
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
        <SectionNav onNavigate={onClose} />
      </div>
    </div>
  );
}
