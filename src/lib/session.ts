import { DEMO_USERS } from "@/lib/auth";
import type { AppRole, Profile } from "@/types/domain";

const STORAGE_KEY = "arms_session";

export function readSession(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function writeSession(profile: Profile) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function signIn(email: string, password: string) {
  const user = DEMO_USERS.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
  );
  if (!user) return { error: "Invalid email or password." };

  const profile: Profile = {
    id: user.role,
    fullName: user.fullName,
    role: user.role as AppRole,
    email: user.email,
  };

  writeSession(profile);
  return { error: null };
}

export function signOut() {
  clearSession();
}
