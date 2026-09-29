import { Link, useLocation } from 'react-router-dom';
import { CASE_STUDIES } from '@/lib/system-design';

interface CaseStudyNavProps {
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
 * The System Design counterpart to `SectionNav`: a flat list of the case
 * studies in `order`. There's nothing to expand, since each case study page
 * has its own Contents list. Reused as both the persistent desktop sidebar
 * and the mobile overlay's content.
 */
export function CaseStudyNav({ onNavigate, className }: CaseStudyNavProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Case studies" className={className}>
      <p className="pl-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
        Case studies
      </p>
      <ol className="mt-3 space-y-1">
        {CASE_STUDIES.map((caseStudy) => {
          const path = `/system-design/${caseStudy.slug}`;
          const isCurrent = pathname === path;
          return (
            <li key={caseStudy.slug}>
              <Link
                to={path}
                onClick={onNavigate}
                aria-current={isCurrent ? 'page' : undefined}
                className={`flex gap-2 border-l-2 py-1 pl-3 text-sm leading-snug no-underline ${
                  isCurrent ? CURRENT_CLASSES : DEFAULT_CLASSES
                }`}
              >
                <span aria-hidden="true" className="tabular-nums text-text-tertiary">
                  {caseStudy.order}.
                </span>
                <span>{caseStudy.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
