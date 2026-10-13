import { useEffect, useRef, type RefObject } from 'react';

// The one definition of what counts as focusable inside a modal: the Tab trap
// and the modal's initial focus both use it.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The focusable elements inside `container` that are shown, in document
 * order. */
function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  );
}

/**
 * Standard modal a11y: while `active`, Tab and Shift+Tab cycle only within
 * `containerRef` instead of escaping to whatever's behind the backdrop —
 * without this, a keyboard user can Tab past the dialog into background
 * content that's only *visually* dimmed, and activate it while the dialog
 * is still open. Focus returns to whatever had it before the modal opened
 * once `active` goes false (or the component unmounts). Doesn't set initial
 * focus or handle Escape itself; `useModal` adds both.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = focusableIn(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [active, containerRef]);
}

interface ModalOptions {
  /** Called on Escape. */
  onClose: () => void;
  /** The element to focus on open; the first focusable element inside the
   * container when omitted. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Everything a mounted-while-open modal (the search dialog, the mobile nav)
 * needs, following the WAI-ARIA APG modal dialog pattern: on open, focus
 * moves inside (to `initialFocusRef`, else the first focusable element); Tab
 * and Shift+Tab stay inside (`useFocusTrap`); Escape calls `onClose`; on
 * close (unmount), focus returns to the element that had it before opening.
 */
export function useModal(
  containerRef: RefObject<HTMLElement | null>,
  { onClose, initialFocusRef }: ModalOptions,
): void {
  // Called before the initial-focus effect below (effects run in call
  // order), so it captures whatever had focus before the modal opened (its
  // opener), not the element this hook is about to focus.
  useFocusTrap(true, containerRef);

  useEffect(() => {
    const container = containerRef.current;
    const target =
      initialFocusRef?.current ?? (container ? focusableIn(container)[0] : undefined);
    target?.focus();
  }, [containerRef, initialFocusRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}
