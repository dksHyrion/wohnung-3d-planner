import { useCallback, useSyncExternalStore } from 'react';
import { getGlobalLanguage, getTranslation, setGlobalLanguage, subscribeLanguage } from './i18n';
import type { Language } from './types';

export function useTranslation(): {
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
} {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getGlobalLanguage,
    getGlobalLanguage
  );

  const translate = useCallback(
    (keyPath: string, params?: Record<string, string | number>) => {
      return getTranslation(language, keyPath, params);
    },
    [language]
  );

  const setLanguage = useCallback((lang: Language) => {
    setGlobalLanguage(lang);
  }, []);

  return {
    t: translate,
    language,
    setLanguage,
  };
}
