import { useEffect, useId, useRef, useState } from 'react';
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
 * The narrow-view copy (below `xl`): a bar pinned under the sticky header
 * (`top` is the `--header-height` the header publishes; `z-20` keeps it under
 * the header's `z-30`) whose button names the section being read and opens a
 * panel of the same links over the content. A disclosure, not a modal: no
 * focus trap or scroll lock. The panel closes on the button, a link click (the
 * browser still makes the jump), Escape (focus goes back to the button), a
 * pointer press outside the bar, or focus moving outside the bar. Closed, it's `hidden` rather than unmounted,
 * so a clicked link is still in the document when the browser follows it.
 * Its height is `--on-this-page-height` (index.css), which the headings'
 * scroll margin adds so a jump lands below the bar.
 */
function OnThisPageBar({
  headings,
  current,
}: {
  headings: Heading[];
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const navRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const currentText = headings.find(({ id }) => id === current)?.text;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <nav
      ref={navRef}
      aria-label={LABEL}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        setOpen(false);
        buttonRef.current?.focus();
      }}
      onBlur={(event) => {
        // Focus moved to something outside the bar (Tab past the last link):
        // close, or the open panel would cover the newly focused element. A
        // null relatedTarget (window blur, or a click Safari doesn't focus)
        // is left to the pointerdown handler.
        const next = event.relatedTarget as Node | null;
        if (open && next && !navRef.current?.contains(next)) setOpen(false);
      }}
      className="sticky top-[var(--header-height,8rem)] z-20 h-[var(--on-this-page-height)] border-b border-border bg-bg-primary/95 backdrop-blur xl:hidden"
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex h-full w-full items-center gap-2 text-left text-sm"
      >
        <span className="shrink-0 font-medium text-text-tertiary">
          {LABEL}
          {currentText && ':'}
        </span>
        {currentText && (
          <>
            {' '}
            <span className="min-w-0 truncate text-text-primary">{currentText}</span>
          </>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`ml-auto h-4 w-4 shrink-0 text-text-tertiary ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as Element).closest('a')) setOpen(false);
        }}
        className="scrollbar-thin absolute inset-x-0 top-full max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-bg-secondary px-4 py-3"
      >
        <HeadingLinks headings={headings} current={current} />
      </div>
    </nav>
  );
}

/**
 * The body's `##` sections as in-page links, in two copies of which exactly
 * one is displayed at any width: the sticky bar at the top of the body below
 * `xl` (`OnThisPageBar`), and a sticky list in the shell's right column
 * (rendered there with a portal) from `xl`. `h2Headings` numbers the ids with
 * the same `createHeadingIds` the markdown renderer uses, so every link lands
 * on its heading, duplicates included (`notes`, `notes-1`). Rendered inside
 * `LazyBody`'s children, so it appears once the body has loaded and unmounts
 * with the page. One `useCurrentHeading` state marks the section being read
 * in both copies, and names it in the bar.
 */
export function OnThisPage({ headings }: { headings: Heading[] }) {
  const aside = usePageAside();
  const current = useCurrentHeading(headings.map(({ id }) => id));
  if (headings.length === 0) return null;
  return (
    <>
      <OnThisPageBar headings={headings} current={current} />
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
