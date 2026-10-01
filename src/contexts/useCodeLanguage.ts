import { createContext, useContext } from 'react';

/** The languages a DSA code pair is written in. */
export type CodeLanguage = 'python' | 'typescript';

export interface CodeLanguageContextValue {
  language: CodeLanguage;
  setLanguage: (language: CodeLanguage) => void;
}

// Created here rather than beside CodeLanguageProvider, so
// CodeLanguageContext.tsx exports only a component and fast refresh keeps
// working on it.
export const CodeLanguageContext = createContext<CodeLanguageContextValue | null>(null);

export function useCodeLanguage(): CodeLanguageContextValue {
  const context = useContext(CodeLanguageContext);
  if (!context) {
    throw new Error('useCodeLanguage must be used within a CodeLanguageProvider');
  }
  return context;
}
