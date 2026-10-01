import { createContext, useMemo, useState, type ReactNode } from 'react';
import { readStoredChoice, writeStoredChoice } from '@/lib/stored-choice';

/** The languages a DSA code pair is written in. */
export type CodeLanguage = 'python' | 'typescript';

const STORAGE_KEY = 'til-code-language';

export interface CodeLanguageContextValue {
  language: CodeLanguage;
  setLanguage: (language: CodeLanguage) => void;
}

export const CodeLanguageContext = createContext<CodeLanguageContextValue | null>(null);

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
