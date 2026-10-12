export type AppLocale = "ar" | "en";
export type AppTheme = "light" | "dark";

export type UserDisplayPrefs = {
  locale: AppLocale;
  theme: AppTheme;
};

/** @deprecated global keys — migrated once into per-user prefs */
const LEGACY_LOCALE_KEY = "arms_locale";
const LEGACY_THEME_KEY = "arms_theme";
const USER_PREFS_KEY = "arms_user_prefs_v1";
const MIGRATED_FLAG = "arms_user_prefs_migrated_v1";

const DEFAULT_PREFS: UserDisplayPrefs = { locale: "ar", theme: "light" };

type PrefsMap = Record<string, UserDisplayPrefs>;

function readPrefsMap(): PrefsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(USER_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PrefsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePrefsMap(map: PrefsMap) {
  window.localStorage.setItem(USER_PREFS_KEY, JSON.stringify(map));
}

function normalizePrefs(input: Partial<UserDisplayPrefs> | null | undefined): UserDisplayPrefs {
  return {
    locale: input?.locale === "en" ? "en" : "ar",
    theme: input?.theme === "dark" ? "dark" : "light",
  };
}

/** One-time: copy old device-wide prefs into the currently signed-in account, then clear globals. */
function migrateLegacyPrefsOnce(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  if (window.localStorage.getItem(MIGRATED_FLAG) === "1") return;

  const map = readPrefsMap();
  if (!map[userId]) {
    let locale: AppLocale = "ar";
    let theme: AppTheme = "light";
    try {
      if (window.localStorage.getItem(LEGACY_LOCALE_KEY) === "en") locale = "en";
      if (window.localStorage.getItem(LEGACY_THEME_KEY) === "dark") theme = "dark";
    } catch {
      /* ignore */
    }
    map[userId] = { locale, theme };
    writePrefsMap(map);
  }

  try {
    window.localStorage.removeItem(LEGACY_LOCALE_KEY);
    window.localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    /* ignore */
  }
  window.localStorage.setItem(MIGRATED_FLAG, "1");
}

export function getPrefsForUser(userId: string | null | undefined): UserDisplayPrefs {
  if (!userId) return { ...DEFAULT_PREFS };
  migrateLegacyPrefsOnce(userId);
  const saved = readPrefsMap()[userId];
  return saved ? normalizePrefs(saved) : { ...DEFAULT_PREFS };
}

export function setPrefsForUser(
  userId: string | null | undefined,
  patch: Partial<UserDisplayPrefs>,
): UserDisplayPrefs {
  if (!userId) {
    return normalizePrefs({ ...DEFAULT_PREFS, ...patch });
  }
  migrateLegacyPrefsOnce(userId);
  const map = readPrefsMap();
  const next = normalizePrefs({ ...getPrefsForUser(userId), ...patch });
  map[userId] = next;
  writePrefsMap(map);
  return next;
}

/** Active session prefs (or defaults when logged out). */
export function getStoredLocale(userId?: string | null): AppLocale {
  return getPrefsForUser(userId).locale;
}

export function getStoredTheme(userId?: string | null): AppTheme {
  return getPrefsForUser(userId).theme;
}

export function setStoredLocale(locale: AppLocale, userId?: string | null) {
  if (userId) setPrefsForUser(userId, { locale });
  else if (typeof window !== "undefined") {
    // Logged-out fallback (login page) — do not bleed into other accounts.
    window.localStorage.setItem(LEGACY_LOCALE_KEY, locale);
  }
}

export function setStoredTheme(theme: AppTheme, userId?: string | null) {
  if (userId) setPrefsForUser(userId, { theme });
  else if (typeof window !== "undefined") {
    window.localStorage.setItem(LEGACY_THEME_KEY, theme);
  }
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
