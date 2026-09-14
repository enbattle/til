import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { searchTopics } from '@/lib/search';
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
  const results = useMemo(() => searchTopics(query), [query]);

  // Called before the autofocus effect below (hook order = call order), so
  // it captures whatever had focus before the dialog opened, not the input
  // this component is about to focus itself.
  useFocusTrap(true, panelRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function goTo(section: string, slug: string) {
    onClose();
    navigate(`/${section}/${slug}`);
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
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && query.trim() && (
            <li className="px-4 py-3 text-sm text-text-tertiary">
              No topics match &ldquo;{query}&rdquo;.
            </li>
          )}
          {results.map((topic) => {
            const section = getSection(topic.section);
            return (
              <li key={`${topic.section}/${topic.slug}`}>
                <button
                  type="button"
                  onClick={() => goTo(topic.section, topic.slug)}
                  className="block w-full px-4 py-2 text-left hover:bg-bg-secondary"
                >
                  <div className="text-sm font-medium text-text-primary">
                    {topic.title}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {section?.label ?? topic.section} · {topic.summary}
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
