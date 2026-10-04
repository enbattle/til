import { createPortal } from 'react-dom';
import { usePageAside } from '@/contexts/usePageAside';
import { useCurrentHeading } from '@/hooks/useCurrentHeading';

interface Heading {
  text: string;
  id: string;
}

const LABEL = 'On this page';

// The left nav's link styles (OrderedNav): the current section gets the same
// non-color-only signal, bold weight plus a left accent-colored border.
const LINK_CLASSES = 'block border-l-2 py-1 pl-3 text-sm leading-snug no-underline';
const CURRENT_CLASSES = 'font-bold border-accent text-text-primary';
const DEFAULT_CLASSES =
  'border-transparent text-text-secondary transition-colors hover:border-accent';

/** Plain `<a href="#id">` rather than a router `Link`: the browser handles an
 * in-page jump itself. Keyed by id, which is unique where the text may not be.
 * `aria-current="location"` is ARIA's "current location within a page". */
function HeadingLinks({
  headings,
  current,
}: {
  headings: Heading[];
  current: string | null;
}) {
  return (
    <ol className="space-y-1">
      {headings.map(({ text, id }) => {
        const isCurrent = id === current;
        return (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={isCurrent ? 'location' : undefined}
              className={`${LINK_CLASSES} ${isCurrent ? CURRENT_CLASSES : DEFAULT_CLASSES}`}
            >
              {text}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The body's `##` sections as in-page links, in two copies of which exactly
 * one is displayed at any width: a closed `<details>` disclosure at the top
 * of the body below `xl`, and a sticky list in the shell's right column
 * (rendered there with a portal) from `xl`. `h2Headings` numbers the ids with
 * the same `createHeadingIds` the markdown renderer uses, so every link lands
 * on its heading, duplicates included (`notes`, `notes-1`). Rendered inside
 * `LazyBody`'s children, so it appears once the body has loaded and unmounts
 * with the page. One `useCurrentHeading` state marks the section being read
 * in both copies.
 */
export function OnThisPage({ headings }: { headings: Heading[] }) {
  const aside = usePageAside();
  const current = useCurrentHeading(headings.map(({ id }) => id));
  if (headings.length === 0) return null;
  return (
    <>
      <details className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm xl:hidden">
        <summary className="cursor-pointer font-medium text-text-tertiary">
          {LABEL}
        </summary>
        <nav aria-label={LABEL} className="mt-2">
          <HeadingLinks headings={headings} current={current} />
        </nav>
      </details>
      {aside &&
        createPortal(
          <nav aria-label={LABEL}>
            <p className="pl-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
              {LABEL}
            </p>
            <div className="mt-3">
              <HeadingLinks headings={headings} current={current} />
            </div>
          </nav>,
          aside,
        )}
    </>
  );
}
