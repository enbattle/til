import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { ensureFullTextSearch, isFullTextSearchReady, searchContent } from '@/lib/search';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface SearchDialogProps {
  onClose: () => void;
}

/** Rendered only while search is open (see `App.tsx`) — mounting fresh each
 * time means the query naturally starts empty, with no reset-on-open effect. */
export function SearchDialog({ onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // Topic bodies load on demand (they aren't in the main bundle), so title and
  // summary matches work at once and body matches join in when they arrive.
  const [fullText, setFullText] = useState<'loading' | 'ready' | 'failed'>(() =>
    isFullTextSearchReady() ? 'ready' : 'loading',
  );
  // Searched on every render rather than memoized on `query`: when the bodies
  // arrive the same query has to start matching them, and the state change
  // above is what triggers this re-render. The index is small, so it's cheap.
  const results = searchContent(query);

  // Called before the autofocus effect below (hook order = call order), so
  // it captures whatever had focus before the dialog opened, not the input
  // this component is about to focus itself.
  useFocusTrap(true, panelRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    ensureFullTextSearch().then(
      () => active && setFullText('ready'),
      () => active && setFullText('failed'),
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function goTo(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search topics"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="text"
          placeholder="Search topics..."
          className="w-full border-b border-border bg-transparent px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        {/* One live region for the dialog's whole life: it stays mounted and
            only its text changes, so screen readers announce the change. The
            min height equals the height with text (16px line + 16px padding +
            1px border), so the results below never shift. */}
        <p
          role="status"
          className="min-h-[33px] border-b border-border px-4 py-2 text-xs leading-4 text-text-tertiary"
        >
          {fullText === 'loading'
            ? 'Loading full-text search…'
            : fullText === 'failed'
              ? 'Full-text search couldn’t load; showing title and summary matches.'
              : ''}
        </p>
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && query.trim() && (
            <li className="px-4 py-3 text-sm text-text-tertiary">
              No topics match &ldquo;{query}&rdquo;.
            </li>
          )}
          {results.map((result) => {
            // A question stands in the position a topic gives its section
            // label; its own "section" is the System Design tab.
            const { key, path, title, label, summary } =
              result.kind === 'topic'
                ? {
                    key: `${result.topic.section}/${result.topic.slug}`,
                    path: `/${result.topic.section}/${result.topic.slug}`,
                    title: result.topic.title,
                    label:
                      getSection(result.topic.section)?.label ?? result.topic.section,
                    summary: result.topic.summary,
                  }
                : {
                    key: `system-design/${result.question.slug}`,
                    path: `/system-design/${result.question.slug}`,
                    title: result.question.title,
                    label: 'System Design',
                    summary: result.question.summary,
                  };
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => goTo(path)}
                  className="block w-full px-4 py-2 text-left hover:bg-bg-secondary"
                >
                  <div className="text-sm font-medium text-text-primary">{title}</div>
                  <div className="text-xs text-text-tertiary">
                    {label} · {summary}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-4 py-2 text-xs text-text-tertiary">
          <kbd className="rounded border border-border bg-bg-secondary px-1">Esc</kbd> to
          close · searches title, summary, and body text
        </div>
      </div>
    </div>
  );
}
