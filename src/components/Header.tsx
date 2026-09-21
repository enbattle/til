import { Link, useLocation } from 'react-router-dom';
import { isSystemDesignPath } from '@/lib/system-design';
import { ThemeToggle } from './ThemeToggle';

// Same non-color "current" signal as the sidebar navs (docs/DESIGN.md): bold
// weight plus an accent underline, not just a color change.
const TAB_BASE = 'border-b-2 px-1 py-1 text-sm no-underline transition-colors';
const TAB_CURRENT = 'font-bold border-accent text-text-primary';
const TAB_DEFAULT = 'border-transparent text-text-secondary hover:border-accent';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNav: () => void;
}

export function Header({ onOpenSearch, onOpenNav }: HeaderProps) {
  const systemDesignActive = isSystemDesignPath(useLocation().pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-primary/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNav}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary lg:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span>Menu</span>
          </button>
          <Link
            to="/"
            className="font-serif text-xl font-semibold text-text-primary no-underline"
          >
            til
          </Link>
        </div>
        {/* Wraps to its own row below the logo row under `sm` so the tabs stay
            visible at 375 px without crowding it or scrolling the page. */}
        <nav
          aria-label="Primary"
          className="order-last flex w-full gap-5 sm:order-none sm:mr-auto sm:w-auto"
        >
          <Link
            to="/"
            aria-current={systemDesignActive ? undefined : 'page'}
            className={`${TAB_BASE} ${systemDesignActive ? TAB_DEFAULT : TAB_CURRENT}`}
          >
            Catalog
          </Link>
          <Link
            to="/system-design"
            aria-current={systemDesignActive ? 'page' : undefined}
            className={`${TAB_BASE} ${systemDesignActive ? TAB_CURRENT : TAB_DEFAULT}`}
          >
            System Design
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          >
            <span>Search</span>
            <kbd className="rounded border border-border bg-bg-secondary px-1 font-sans text-xs text-text-tertiary">
              Ctrl/⌘ K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
