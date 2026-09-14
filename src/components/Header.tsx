import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onOpenSearch: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-primary/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <Link
          to="/"
          className="font-serif text-xl font-semibold text-text-primary no-underline"
        >
          til
        </Link>
        <div className="flex items-center gap-2">
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
