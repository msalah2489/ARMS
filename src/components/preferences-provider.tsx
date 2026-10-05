"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type MessageKey } from "@/lib/i18n/messages";
import {
  applyDocumentPreferences,
  getStoredLocale,
  getStoredTheme,
  setStoredLocale,
  setStoredTheme,
  type AppLocale,
  type AppTheme,
} from "@/lib/preferences";

type PreferencesContextValue = {
  locale: AppLocale;
  theme: AppTheme;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  t: (key: MessageKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("ar");
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const nextLocale = getStoredLocale();
    const nextTheme = getStoredTheme();
    setLocaleState(nextLocale);
    setThemeState(nextTheme);
    applyDocumentPreferences(nextLocale, nextTheme);
  }, []);

  const setLocale = useCallback(
    (next: AppLocale) => {
      setLocaleState(next);
      setStoredLocale(next);
      applyDocumentPreferences(next, theme);
    },
    [theme],
  );

  const setTheme = useCallback(
    (next: AppTheme) => {
      setThemeState(next);
      setStoredTheme(next);
      applyDocumentPreferences(locale, next);
    },
    [locale],
  );

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  const value = useMemo(
    () => ({ locale, theme, setLocale, setTheme, t }),
    [locale, theme, setLocale, setTheme, t],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}
