import { DEMO_USERS, isDemoMode } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
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

export async function signIn(email: string, password: string) {
  if (isDemoMode()) {
    const user = DEMO_USERS.find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
    );
    if (!user) return { error: "Invalid email or password." };

    writeSession({
      id: user.role,
      fullName: user.fullName,
      role: user.role as AppRole,
      email: user.email,
    });
    return { error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message ?? "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  writeSession({
    id: data.user.id,
    fullName: profile?.full_name ?? data.user.email ?? "User",
    role: (profile?.role as AppRole | undefined) ?? "branch_employee",
    email: data.user.email ?? email,
  });

  return { error: null };
}

export async function signOut() {
  clearSession();
  if (!isDemoMode()) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
}
