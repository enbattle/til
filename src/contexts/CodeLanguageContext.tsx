import { useMemo, useState, type ReactNode } from 'react';
import { readStoredChoice, writeStoredChoice } from '@/lib/stored-choice';
import { CodeLanguageContext, type CodeLanguage } from './useCodeLanguage';

const STORAGE_KEY = 'til-code-language';

/**
 * The language every Python/TypeScript code pair shows (`CodeTabs`), shared
 * across the app so choosing one switches every pair on the page, and
 * remembered in localStorage like the theme (`ThemeContext`). Python by
 * default.
 */
export function CodeLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<CodeLanguage>(() =>
    readStoredChoice(STORAGE_KEY, ['python', 'typescript'], 'python'),
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage(next: CodeLanguage) {
        setLanguageState(next);
        writeStoredChoice(STORAGE_KEY, next);
      },
    }),
    [language],
  );

  return (
    <CodeLanguageContext.Provider value={value}>{children}</CodeLanguageContext.Provider>
  );
}
