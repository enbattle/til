import { createContext, useContext } from 'react';

// The shell's right-hand column (`AppShell` in App.tsx), which a page fills
// with `createPortal` (`OnThisPage`). `null` until the column has mounted, and
// outside the shell (a page rendered on its own in a test).
export const PageAsideContext = createContext<HTMLElement | null>(null);

export function usePageAside(): HTMLElement | null {
  return useContext(PageAsideContext);
}
