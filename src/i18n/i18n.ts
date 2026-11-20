import { Language, TranslationSchema, TranslationKey } from './types';
import { de } from './locales/de';
import { en } from './locales/en';

export type { Language, TranslationSchema, TranslationKey };

const dictionaries: Record<Language, TranslationSchema> = { de, en };

const STORAGE_KEY = 'wohnung-3d-planner-lang';

function getInitialLanguage(): Language {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'de' || stored === 'en') {
        return stored;
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return 'de';
}

let currentLanguage: Language = getInitialLanguage();
const listeners = new Set<() => void>();

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setGlobalLanguage(lang: Language): void {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {
    // Ignore storage errors
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

export function getGlobalLanguage(): Language {
  return currentLanguage;
}

function resolvePathInObject(dict: unknown, keyPath: string): unknown {
  if (!dict || typeof dict !== 'object') return undefined;
  const root = dict as Record<string, unknown>;
  const parts = keyPath.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (current && typeof current === 'object' && Object.hasOwn(current, part)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }
  if (current !== undefined) return current;

  // Convenience alias for dialogs (e.g. 'export.scaleValue' -> dict.dialogs.export.scaleValue)
  if (
    parts.length > 0 &&
    root.dialogs &&
    typeof root.dialogs === 'object' &&
    Object.hasOwn(root.dialogs, parts[0])
  ) {
    let sub: unknown = root.dialogs;
    for (const part of parts) {
      if (sub && typeof sub === 'object' && Object.hasOwn(sub, part)) {
        sub = (sub as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return sub;
  }

  return undefined;
}

export function getTranslation(
  lang: Language,
  keyPath: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[lang] || dictionaries.de;
  let value = resolvePathInObject(dict, keyPath);

  // Fallback to German if key is missing in target language
  if (value === undefined && lang !== 'de') {
    value = resolvePathInObject(dictionaries.de, keyPath);
  }

  if (typeof value !== 'string') {
    return keyPath;
  }

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replaceAll(`{${k}}`, String(v)),
      value
    );
  }

  return value;
}

export function t(
  keyPath: TranslationKey,
  params?: Record<string, string | number>
): string {
  return getTranslation(currentLanguage, keyPath, params);
}
