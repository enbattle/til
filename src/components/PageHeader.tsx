import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** The top of a topic, case study or DSA entry page: a link back to its
 * section or landing page, the title as the page's one `h1`, and a meta line
 * under it. */
export function PageHeader({
  back,
  title,
  meta,
}: {
  back: { to: string; label: string };
  title: string;
  meta: ReactNode;
}) {
  return (
    <div>
      <Link
        to={back.to}
        className="text-sm font-medium text-text-tertiary hover:text-accent"
      >
        ← {back.label}
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-text-tertiary">{meta}</p>
    </div>
  );
}
