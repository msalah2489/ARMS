import { DEMO_USERS, isDemoMode, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, Profile } from "@/types/domain";

const STORAGE_KEY = "arms_session";

export function readSession(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as Profile;
    return { ...profile, role: normalizeRole(profile.role) };
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
    if (!user) return { error: "البريد أو كلمة المرور غير صحيحة." };

    writeSession({
      id: user.role,
      fullName: user.fullName,
      role: normalizeRole(user.role),
      email: user.email,
      opsBranchId: user.opsBranchId ?? null,
      opsBranchName: user.opsBranchName ?? null,
    });
    return { error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message ?? "البريد أو كلمة المرور غير صحيحة." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  let role = normalizeRole((profile?.role as AppRole | undefined) ?? "branch");
  // Temporary switch for testing technician UI until a dedicated Auth user is created.
  if (email.toLowerCase() === "tech@arms.app") role = "technician";

  writeSession({
    id: data.user.id,
    fullName: profile?.full_name ?? data.user.email ?? "مستخدم",
    role,
    email: data.user.email ?? email,
    opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName:
      role === "branch" || role === "system_admin" || isTechnicianRole(role) ? "فرع الرياض" : null,
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
