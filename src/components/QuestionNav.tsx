import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useExpandedGroups } from '@/hooks/useExpandedGroups';
import { QUESTIONS, topicsForQuestion } from '@/lib/system-design';

interface QuestionNavProps {
  /** Called after a link is clicked — the mobile overlay uses this to close
   * itself on navigation. The persistent desktop copy omits it. */
  onNavigate?: () => void;
  className?: string;
}

// Same non-color-only "current page" signal as SectionNav (docs/DESIGN.md):
// bold weight plus a left accent-colored border.
const CURRENT_CLASSES = 'font-bold border-accent text-text-primary';
const TOPIC_DEFAULT_CLASSES =
  'border-transparent text-text-secondary hover:border-accent transition-colors';
const QUESTION_DEFAULT_CLASSES =
  'border-transparent text-text-primary hover:border-accent transition-colors';

/** The slug of the question whose page is `pathname`, or `undefined` on the
 * System Design landing page or an unrecognized path. */
function currentQuestionSlug(pathname: string): string | undefined {
  return QUESTIONS.find((question) => pathname === `/system-design/${question.slug}`)
    ?.slug;
}

/**
 * The System Design counterpart to `SectionNav`: one entry per question, each
 * expandable to the catalog topics that question draws on. Reused as both the
 * persistent desktop sidebar and the mobile overlay's content, and shares its
 * expand/collapse behavior with `SectionNav` via `useExpandedGroups`.
 */
export function QuestionNav({ onNavigate, className }: QuestionNavProps) {
  const { pathname } = useLocation();
  const idPrefix = useId();

  const { isExpanded: isQuestionExpanded, toggle: toggleQuestion } = useExpandedGroups(
    currentQuestionSlug(pathname),
  );

  return (
    <nav aria-label="Questions" className={className}>
      <ul className="space-y-6">
        {QUESTIONS.map((question) => {
          const questionPath = `/system-design/${question.slug}`;
          const isCurrent = pathname === questionPath;
          const isExpanded = isQuestionExpanded(question.slug);
          const topicListId = `${idPrefix}-${question.slug}-topics`;

          return (
            <li key={question.slug}>
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={questionPath}
                  onClick={onNavigate}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`block border-l-2 pl-3 text-sm leading-snug font-medium no-underline ${
                    isCurrent ? CURRENT_CLASSES : QUESTION_DEFAULT_CLASSES
                  }`}
                >
                  {question.title}
                </Link>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={topicListId}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${question.title}`}
                  onClick={() => toggleQuestion(question.slug)}
                  className="shrink-0 rounded p-1.5 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {/* Fixed-size inline SVG for the same reason as SectionNav's
                      chevron: no font-metrics slop in the tightly fitted
                      sidebar. */}
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
                {topicsForQuestion(question).map((topic) => (
                  <li key={`${topic.section}/${topic.slug}`}>
                    <Link
                      to={`/${topic.section}/${topic.slug}`}
                      onClick={onNavigate}
                      className={`block border-l-2 py-1 pl-3 text-sm leading-snug no-underline ${TOPIC_DEFAULT_CLASSES}`}
                    >
                      {topic.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
