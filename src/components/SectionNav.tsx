import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useExpandedGroups } from '@/hooks/useExpandedGroups';
import { topicsBySection } from '@/lib/content';
import type { Section } from '@/content/registry';
import type { Topic } from '@/types';

interface SectionNavProps {
  /** Called after a link is clicked — the mobile overlay uses this to close
   * itself on navigation. The persistent desktop copy omits it. */
  onNavigate?: () => void;
  className?: string;
}

// Non-color-only "current page" signal per docs/DESIGN.md: bold weight plus
// a left accent-colored border, not just a color/background change.
const CURRENT_CLASSES = 'font-bold border-accent text-text-primary';
// Topics default to the muted secondary color; sections stay on the primary
// color even when not current, on top of their own uppercase/tracking-wide
// treatment, so the two levels read as visually distinct without relying on
// indentation alone — color reinforces the hierarchy, it isn't the only
// signal carrying it (indentation on the topic <ul> is the non-color one).
const TOPIC_DEFAULT_CLASSES =
  'border-transparent text-text-secondary hover:border-accent transition-colors';
const SECTION_DEFAULT_CLASSES =
  'border-transparent text-text-primary hover:border-accent transition-colors';

/** The slug of the section containing `pathname` (its own page or one of its
 * topics), or `undefined` on the home page / an unrecognized path. */
function currentSectionSlug(
  pathname: string,
  groups: { section: Section; topics: Topic[] }[],
): string | undefined {
  for (const { section, topics } of groups) {
    const sectionPath = `/${section.slug}`;
    if (pathname === sectionPath) return section.slug;
    if (topics.some((topic) => pathname === `${sectionPath}/${topic.slug}`)) {
      return section.slug;
    }
  }
  return undefined;
}

/**
 * Presentational section/topic nav tree, reused as both the persistent
 * desktop sidebar (`App.tsx`) and the content of the mobile overlay
 * (`MobileNav.tsx`). Sections are collapsible — only the section containing
 * the current route starts expanded; navigating into a different section
 * auto-expands it without ever collapsing a section the user already opened.
 */
export function SectionNav({ onNavigate, className }: SectionNavProps) {
  const { pathname } = useLocation();
  const groups = topicsBySection();
  const idPrefix = useId();

  const { isExpanded: isSectionExpanded, toggle: toggleSection } = useExpandedGroups(
    currentSectionSlug(pathname, groups),
  );

  return (
    <nav aria-label="Sections" className={className}>
      <ul className="space-y-6">
        {groups.map(({ section, topics }) => {
          const sectionPath = `/${section.slug}`;
          const isTopicCurrent = topics.some(
            (topic) => pathname === `${sectionPath}/${topic.slug}`,
          );
          const isSectionCurrent = pathname === sectionPath || isTopicCurrent;
          const isExpanded = isSectionExpanded(section.slug);
          const topicListId = `${idPrefix}-${section.slug}-topics`;

          return (
            <li key={section.slug}>
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={sectionPath}
                  onClick={onNavigate}
                  aria-current={isSectionCurrent ? 'page' : undefined}
                  className={`block border-l-2 pl-3 text-sm font-medium uppercase tracking-wide no-underline ${
                    isSectionCurrent ? CURRENT_CLASSES : SECTION_DEFAULT_CLASSES
                  }`}
                >
                  {section.label}
                </Link>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={topicListId}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.label}`}
                  onClick={() => toggleSection(section.slug)}
                  className="shrink-0 rounded p-1.5 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {/* Fixed-size inline SVG rather than a Unicode glyph (was
                      U+25B6 `▶`): a font glyph's rendered box can run a
                      fraction of a pixel wider than its line box depending on
                      the active font, which was enough to push the tightly
                      fitted sidebar's scrollWidth past its clientWidth and
                      trigger an always-on horizontal scrollbar sliver. An SVG
                      with an explicit viewBox has no such font-metrics
                      slop. */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor"
                  >
                    <path d="M3 2.2 8.5 6 3 9.8Z" />
                  </svg>
                </button>
              </div>
              <ul id={topicListId} hidden={!isExpanded} className="mt-2 ml-3 space-y-2">
                {topics.map((topic) => {
                  const topicPath = `${sectionPath}/${topic.slug}`;
                  const isCurrent = pathname === topicPath;
                  return (
                    <li key={topic.slug}>
                      <Link
                        to={topicPath}
                        onClick={onNavigate}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`block border-l-2 py-1 pl-3 text-sm leading-snug no-underline ${
                          isCurrent ? CURRENT_CLASSES : TOPIC_DEFAULT_CLASSES
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
