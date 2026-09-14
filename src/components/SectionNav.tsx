import { Link, useLocation } from 'react-router-dom';
import { topicsBySection } from '@/lib/content';

interface SectionNavProps {
  /** Called after a link is clicked — the mobile overlay uses this to close
   * itself on navigation. The persistent desktop copy omits it. */
  onNavigate?: () => void;
  className?: string;
}

// Non-color-only "current page" signal per docs/DESIGN.md: bold weight plus
// a left accent-colored border, not just a color/background change.
const CURRENT_CLASSES = 'font-bold border-accent text-text-primary';
const DEFAULT_CLASSES =
  'border-transparent text-text-secondary hover:border-accent transition-colors';

/**
 * Presentational section/topic nav tree, reused as both the persistent
 * desktop sidebar (`App.tsx`) and the content of the mobile overlay
 * (`MobileNav.tsx`). Always fully expanded — no collapse/expand state.
 */
export function SectionNav({ onNavigate, className }: SectionNavProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Sections" className={className}>
      <ul className="space-y-6">
        {topicsBySection().map(({ section, topics }) => {
          const sectionPath = `/${section.slug}`;
          const isTopicCurrent = topics.some(
            (topic) => pathname === `${sectionPath}/${topic.slug}`,
          );
          const isSectionCurrent = pathname === sectionPath || isTopicCurrent;

          return (
            <li key={section.slug}>
              <Link
                to={sectionPath}
                onClick={onNavigate}
                aria-current={isSectionCurrent ? 'page' : undefined}
                className={`block border-l-2 pl-3 text-sm font-medium uppercase tracking-wide no-underline ${
                  isSectionCurrent ? CURRENT_CLASSES : DEFAULT_CLASSES
                }`}
              >
                {section.label}
              </Link>
              <ul className="mt-2 space-y-1.5">
                {topics.map((topic) => {
                  const topicPath = `${sectionPath}/${topic.slug}`;
                  const isCurrent = pathname === topicPath;
                  return (
                    <li key={topic.slug}>
                      <Link
                        to={topicPath}
                        onClick={onNavigate}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`block border-l-2 pl-3 text-sm no-underline ${
                          isCurrent ? CURRENT_CLASSES : DEFAULT_CLASSES
                        }`}
                      >
                        {topic.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
