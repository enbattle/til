import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ensureFullTextSearch, isFullTextSearchReady, searchContent } from '@/lib/search';
import { useModal } from '@/hooks/useFocusTrap';

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
  // Topic, case-study and DSA bodies load on demand (they aren't in the main bundle), so
  // title and summary matches work at once and body matches join in when they arrive.
  const [fullText, setFullText] = useState<'loading' | 'ready' | 'failed'>(() =>
    isFullTextSearchReady() ? 'ready' : 'loading',
  );
  // Searched on every render rather than memoized on `query`: when the bodies
  // arrive the same query has to start matching them, and the state change
  // above is what triggers this re-render. The index is small, so it's cheap.
  const results = searchContent(query);

  // Focus starts on the input; Tab stays inside, Escape closes, and focus
  // returns to the opener on close.
  useModal(panelRef, { onClose, initialFocusRef: inputRef });

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
          onKeyDown={(event) => {
            // Enter opens the first result, as a search box is expected to,
            // except while an input method (IME) is composing: that Enter
            // commits the composed text. Some browsers flag it only with
            // keyCode 229.
            const composing = event.nativeEvent.isComposing || event.keyCode === 229;
            if (event.key === 'Enter' && !composing && results.length > 0) {
              event.preventDefault();
              goTo(results[0].path);
            }
          }}
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
          {results.map(({ key, path, title, label, summary }) => (
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
          ))}
        </ul>
        <div className="border-t border-border px-4 py-2 text-xs text-text-tertiary">
          <kbd className="rounded border border-border bg-bg-secondary px-1">Enter</kbd>{' '}
          opens the first result ·{' '}
          <kbd className="rounded border border-border bg-bg-secondary px-1">Esc</kbd> to
          close · searches title, summary, and body text
        </div>
      </div>
    </div>
  );
}
