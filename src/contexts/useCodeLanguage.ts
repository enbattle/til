import { useContext } from 'react';
import {
  CodeLanguageContext,
  type CodeLanguageContextValue,
} from './CodeLanguageContext';

export function useCodeLanguage(): CodeLanguageContextValue {
  const context = useContext(CodeLanguageContext);
  if (!context) {
    throw new Error('useCodeLanguage must be used within a CodeLanguageProvider');
  }
  return context;
}
