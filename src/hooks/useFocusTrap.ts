import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard modal a11y: while `active`, Tab and Shift+Tab cycle only within
 * `containerRef` instead of escaping to whatever's behind the backdrop —
 * without this, a keyboard user can Tab past the dialog into background
 * content that's only *visually* dimmed, and activate it while the dialog
 * is still open. Focus returns to whatever had it before the modal opened
 * once `active` goes false (or the component unmounts). Doesn't set initial
 * focus itself — a caller that needs a specific first-focused element (a
 * search input, for example) still handles that separately.
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
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);
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
