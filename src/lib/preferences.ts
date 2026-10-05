export type AppLocale = "ar" | "en";
export type AppTheme = "light" | "dark";

const LOCALE_KEY = "arms_locale";
const THEME_KEY = "arms_theme";

export function getStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";
  try {
    const value = window.localStorage.getItem(LOCALE_KEY);
    return value === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setStoredLocale(locale: AppLocale) {
  window.localStorage.setItem(LOCALE_KEY, locale);
}

export function setStoredTheme(theme: AppTheme) {
  window.localStorage.setItem(THEME_KEY, theme);
}

export function applyDocumentPreferences(locale: AppLocale, theme: AppTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
