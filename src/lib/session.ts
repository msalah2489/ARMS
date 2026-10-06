import { DEMO_USERS, isDemoMode, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  authenticateManagedUser,
  listManagedUsers,
  managedUserToProfile,
} from "@/lib/users-store";
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

function tryLocalSignIn(login: string, password: string) {
  const managed = authenticateManagedUser(login, password);
  if (managed) {
    writeSession(managedUserToProfile(managed));
    return { error: null as string | null };
  }

  const key = login.trim().toLowerCase();
  const disabled = listManagedUsers().find(
    (item) =>
      !item.isActive &&
      (item.username.toLowerCase() === key ||
        item.email.toLowerCase() === key ||
        item.mobile === login.trim()),
  );
  if (disabled) {
    return { error: "هذا الحساب معطّل. راجع مدير النظام." };
  }

  return null;
}

export async function signIn(email: string, password: string) {
  // Pull cloud users (and other ops) before authenticating so Pages logins see shared accounts.
  try {
    const { hydrateOpsFromSupabase } = await import("@/lib/supabase/hydrate");
    await hydrateOpsFromSupabase();
  } catch {
    // Offline / misconfigured: fall through to local cache.
  }

  // Local managed users work in demo and on GitHub Pages static export.
  const local = tryLocalSignIn(email, password);
  if (local) return local;

  if (isDemoMode()) {
    const user = DEMO_USERS.find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
    );
    if (!user) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة." };

    const managed = authenticateManagedUser(user.email, password);
    if (managed) {
      writeSession(managedUserToProfile(managed));
      return { error: null };
    }

    writeSession({
      id: user.role,
      fullName: user.fullName,
      username: user.email.split("@")[0],
      role: normalizeRole(user.role),
      email: user.email,
      mobile: null,
      opsBranchId: user.opsBranchId ?? null,
      opsBranchName: user.opsBranchName ?? null,
      isActive: true,
    });
    return { error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message ?? "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  let role = normalizeRole((profile?.role as AppRole | undefined) ?? "branch");
  if (email.toLowerCase() === "tech@arms.app") role = "technician";
  if (email.toLowerCase() === "branch@arms.app") role = "branch";

  // Prefer managed-user branch assignment from cloud cache — never invent demo branch IDs.
  const managedMatch = listManagedUsers().find(
    (item) =>
      item.id === data.user.id ||
      (item.email && item.email.toLowerCase() === (data.user.email ?? email).toLowerCase()),
  );

  writeSession({
    id: data.user.id,
    fullName: profile?.full_name ?? managedMatch?.fullName ?? data.user.email ?? "مستخدم",
    username: managedMatch?.username ?? (data.user.email ?? email).split("@")[0],
    role: managedMatch ? normalizeRole(managedMatch.role) : role,
    email: data.user.email ?? email,
    mobile: managedMatch?.mobile ?? null,
    opsBranchId: managedMatch?.opsBranchId ?? null,
    opsBranchName:
      managedMatch?.opsBranchName ??
      (isTechnicianRole(managedMatch ? normalizeRole(managedMatch.role) : role)
        ? "مركز الصيانة"
        : null),
    isActive: managedMatch?.isActive ?? true,
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
