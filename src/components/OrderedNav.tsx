import { Link, useLocation } from 'react-router-dom';

interface OrderedNavItem {
  to: string;
  title: string;
  number: number;
}

interface OrderedNavProps {
  /** The nav's accessible name, e.g. "Case studies". */
  label: string;
  /** The small heading shown above the list. */
  heading: string;
  items: OrderedNavItem[];
  /** Called after a link is clicked — the mobile overlay uses this to close
   * itself on navigation. The persistent desktop copy omits it. */
  onNavigate?: () => void;
  className?: string;
}

// Same non-color-only "current page" signal as SectionNav (docs/DESIGN.md):
// bold weight plus a left accent-colored border.
const CURRENT_CLASSES = 'font-bold border-accent text-text-primary';
const DEFAULT_CLASSES =
  'font-medium border-transparent text-text-secondary hover:border-accent transition-colors';

/**
 * A flat, numbered sidebar list of pages (`CaseStudyNav`, `DsaNav`). There's
 * nothing to expand, since each page has its own Contents list. Reused as
 * both the persistent desktop sidebar and the mobile overlay's content.
 */
export function OrderedNav({
  label,
  heading,
  items,
  onNavigate,
  className,
}: OrderedNavProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={label} className={className}>
      <p className="pl-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
        {heading}
      </p>
      <ol className="mt-3 space-y-1">
        {items.map(({ to, title, number }) => {
          const isCurrent = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                onClick={onNavigate}
                aria-current={isCurrent ? 'page' : undefined}
                className={`flex gap-2 border-l-2 py-1 pl-3 text-sm leading-snug no-underline ${
                  isCurrent ? CURRENT_CLASSES : DEFAULT_CLASSES
                }`}
              >
                <span aria-hidden="true" className="tabular-nums text-text-tertiary">
                  {number}.
                </span>
                <span>{title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
