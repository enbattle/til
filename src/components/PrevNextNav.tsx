import { Link } from 'react-router-dom';

interface Neighbour {
  to: string;
  title: string;
}

/** Links to the previous and next page in an ordered list (case studies, DSA
 * entries), each shown only when it exists; nothing at all when neither
 * does. */
export function PrevNextNav({
  label,
  prev,
  next,
}: {
  /** The nav's accessible name, e.g. "More case studies". */
  label: string;
  prev: Neighbour | null;
  next: Neighbour | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-sm"
    >
      {prev && (
        <Link to={prev.to} className="text-text-secondary hover:text-accent">
          ← {prev.title}
        </Link>
      )}
      {next && (
        <Link to={next.to} className="ml-auto text-text-secondary hover:text-accent">
          {next.title} →
        </Link>
      )}
    </nav>
  );
}
