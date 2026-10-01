import { useId, useRef, type KeyboardEvent } from 'react';
import type { CodeLanguage } from '@/contexts/CodeLanguageContext';
import { useCodeLanguage } from '@/contexts/useCodeLanguage';
import { CodeBlock } from './CodeBlock';

/** The tabs, in order. */
const CODE_LANGUAGES: readonly CodeLanguage[] = ['python', 'typescript'];

const LABELS: Record<CodeLanguage, string> = {
  python: 'Python',
  typescript: 'TypeScript',
};

// The header tabs' non-color "current" signal (docs/DESIGN.md): bold weight
// plus an accent underline.
const TAB_BASE = 'border-b-2 px-2 py-1 text-sm transition-colors';
const TAB_CURRENT = 'font-bold border-accent text-text-primary';
const TAB_DEFAULT =
  'border-transparent text-text-secondary hover:border-accent hover:text-text-primary';

/**
 * One code example written in both languages, shown as WAI-ARIA tabs over a
 * single `CodeBlock`. The selected language comes from `CodeLanguageProvider`,
 * so choosing one here switches every pair on the page (and is remembered).
 * Tabs use manual activation: the arrow keys (and Home/End) move focus between
 * the tabs, and Enter or Space selects one, so moving focus alone never
 * re-renders every code block on the page. The selected tab is the one in the
 * page's tab order (roving tabindex). `MarkdownRenderer` renders one of these
 * for each python fence directly followed by a typescript fence when it's
 * given `codeTabs`.
 */
export function CodeTabs({ code }: { code: Record<CodeLanguage, string> }) {
  const { language, setLanguage } = useCodeLanguage();
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (lang: CodeLanguage) => `${id}-tab-${lang}`;
  const panelId = `${id}-panel`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = CODE_LANGUAGES.length;
    // Where each key moves focus; the arrows wrap around.
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    tabs.current[targets[event.key]]?.focus();
  }

  return (
    <div className="not-prose my-5">
      <div role="tablist" aria-label="Code language" className="flex gap-2">
        {CODE_LANGUAGES.map((lang, index) => {
          const selected = lang === language;
          return (
            <button
              key={lang}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(lang)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setLanguage(lang)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`${TAB_BASE} ${selected ? TAB_CURRENT : TAB_DEFAULT}`}
            >
              {LABELS[lang]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(language)}>
        <CodeBlock code={code[language]} language={language} className="mt-2" />
      </div>
    </div>
  );
}
