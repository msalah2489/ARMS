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
  getPrefsForUser,
  setPrefsForUser,
  type AppLocale,
  type AppTheme,
} from "@/lib/preferences";
import { readSession } from "@/lib/session";

type PreferencesContextValue = {
  locale: AppLocale;
  theme: AppTheme;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  t: (key: MessageKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  return readSession()?.id ?? null;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<AppLocale>("ar");
  const [theme, setThemeState] = useState<AppTheme>("light");

  const applyForUser = useCallback((nextUserId: string | null) => {
    const prefs = getPrefsForUser(nextUserId);
    setUserId((prevId) => {
      if (prevId === nextUserId) return prevId;
      return nextUserId;
    });
    setLocaleState((prev) => (prev === prefs.locale ? prev : prefs.locale));
    setThemeState((prev) => (prev === prefs.theme ? prev : prefs.theme));
    applyDocumentPreferences(prefs.locale, prefs.theme);
  }, []);

  useEffect(() => {
    applyForUser(readActiveUserId());

    function onSessionUpdated() {
      applyForUser(readActiveUserId());
    }

    window.addEventListener("arms-session-updated", onSessionUpdated);
    return () => window.removeEventListener("arms-session-updated", onSessionUpdated);
  }, [applyForUser]);

  const setLocale = useCallback(
    (next: AppLocale) => {
      const id = userId ?? readActiveUserId();
      const prefs = setPrefsForUser(id, { locale: next });
      setUserId(id);
      setLocaleState(prefs.locale);
      applyDocumentPreferences(prefs.locale, prefs.theme);
    },
    [userId],
  );

  const setTheme = useCallback(
    (next: AppTheme) => {
      const id = userId ?? readActiveUserId();
      const prefs = setPrefsForUser(id, { theme: next });
      setUserId(id);
      setThemeState(prefs.theme);
      applyDocumentPreferences(prefs.locale, prefs.theme);
    },
    [userId],
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
