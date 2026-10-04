import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface OrderedNavItem {
  to: string;
  title: string;
  number: number;
}

interface OrderedNavGroup {
  /** The small label shown above the group's list, which also names it. */
  label: string;
  items: OrderedNavItem[];
}

interface OrderedNavProps {
  /** The nav's accessible name, e.g. "Case studies". */
  label: string;
  /** The small heading shown above the list. */
  heading: string;
  /** One flat list (`CaseStudyNav`), or labelled lists in order (`DsaNav`). */
  items: OrderedNavItem[] | OrderedNavGroup[];
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
const LABEL_CLASSES =
  'pl-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase';
// A group's label sits under the nav's own heading, so it's styled as a
// subheading (serif, sentence case, like the landing page's group `h2`s)
// rather than as another uppercase label of the same rank.
const GROUP_LABEL_CLASSES = 'pl-3 font-serif text-sm font-semibold text-text-primary';

function isGrouped(
  items: OrderedNavItem[] | OrderedNavGroup[],
): items is OrderedNavGroup[] {
  return items.length > 0 && 'items' in items[0];
}

/**
 * A numbered sidebar list of pages (`CaseStudyNav`, `DsaNav`), flat or split
 * into labelled groups. There's nothing to expand, since each page has its
 * own "On this page" list. Reused as both the persistent desktop sidebar and
 * the mobile overlay's content.
 */
export function OrderedNav({
  label,
  heading,
  items,
  onNavigate,
  className,
}: OrderedNavProps) {
  const { pathname } = useLocation();
  const idPrefix = useId();

  // `start` keeps the list's own numbering in step with the visible numbers,
  // which continue across groups.
  const renderList = (list: OrderedNavItem[], labelledBy?: string) => (
    <ol
      aria-labelledby={labelledBy}
      start={labelledBy ? list[0]?.number : undefined}
      className="mt-3 space-y-1"
    >
      {list.map(({ to, title, number }) => {
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
  );

  return (
    <nav aria-label={label} className={className}>
      <p className={LABEL_CLASSES}>{heading}</p>
      {isGrouped(items)
        ? items.map((group, index) => {
            const id = `${idPrefix}-group-${index}`;
            return (
              <div key={group.label} className={index === 0 ? 'mt-3' : 'mt-5'}>
                <p id={id} className={GROUP_LABEL_CLASSES}>
                  {group.label}
                </p>
                {renderList(group.items, id)}
              </div>
            );
          })
        : renderList(items)}
    </nav>
  );
}
