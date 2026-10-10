import { DEMO_USERS, isDemoMode, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  authenticateManagedUser,
  authenticateSeedUser,
  listManagedUsers,
  managedUserToProfile,
} from "@/lib/users-store";
import type { AppRole, Profile } from "@/types/domain";

const STORAGE_KEY = "arms_session";
const LOGIN_FAILED_AR = "اسم المستخدم أو كلمة المرور غير صحيحة.";

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
  window.dispatchEvent(new CustomEvent("arms-session-updated"));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("arms-session-updated"));
}

/**
 * Local prototype auth without Supabase Auth:
 * - demo mode, or
 * - NEXT_PUBLIC_LOCAL_DEMO_AUTH=true, or
 * - login is @arms.local / a built-in seed username (branch, courier, tech, …)
 */
function shouldPreferLocalDemoAuth(login: string): boolean {
  if (isDemoMode()) return true;
  if (process.env.NEXT_PUBLIC_LOCAL_DEMO_AUTH === "true") return true;
  if (process.env.NEXT_PUBLIC_LOCAL_DEMO_AUTH === "false") return false;
  const key = login.trim().toLowerCase();
  if (key.endsWith("@arms.local")) return true;
  return DEMO_USERS.some((user) => user.email.split("@")[0].toLowerCase() === key);
}

function localizeAuthError(message?: string | null): string {
  if (!message) return LOGIN_FAILED_AR;
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed") ||
    lower.includes("user not found")
  ) {
    return LOGIN_FAILED_AR;
  }
  return LOGIN_FAILED_AR;
}

function tryLocalSignIn(login: string, password: string) {
  const managed = authenticateManagedUser(login, password);
  if (managed) {
    writeSession(managedUserToProfile(managed));
    return { error: null as string | null };
  }

  // Built-in seeds even when cloud cache has no matching row / no password_plain.
  const seed = authenticateSeedUser(login, password);
  if (seed) {
    writeSession(managedUserToProfile(seed));
    return { error: null as string | null };
  }

  const key = login.trim().toLowerCase();
  const blocked = listManagedUsers({ includeArchived: true }).find(
    (item) =>
      (item.isArchived || !item.isActive) &&
      (item.username.toLowerCase() === key ||
        item.email.toLowerCase() === key ||
        item.mobile === login.trim()),
  );
  if (blocked?.isArchived) {
    return { error: "هذا الحساب مؤرشف. راجع مدير النظام." };
  }
  if (blocked) {
    return { error: "هذا الحساب معطّل. راجع مدير النظام." };
  }

  return null;
}

function tryDemoUsersSignIn(login: string, password: string) {
  const key = login.trim().toLowerCase();
  const user = DEMO_USERS.find(
    (item) =>
      item.password === password &&
      (item.email.toLowerCase() === key || item.email.split("@")[0].toLowerCase() === key),
  );
  if (!user) return null;

  const managed = authenticateManagedUser(user.email, password) ?? authenticateSeedUser(user.email, password);
  if (managed) {
    writeSession(managedUserToProfile(managed));
    return { error: null as string | null };
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
  return { error: null as string | null };
}

export async function signIn(email: string, password: string) {
  // Pull cloud users (and other ops) before authenticating so Pages logins see shared accounts.
  try {
    const { hydrateOpsFromSupabase } = await import("@/lib/supabase/hydrate");
    await hydrateOpsFromSupabase();
  } catch {
    // Offline / misconfigured: fall through to local cache.
  }

  // Local managed users + prototype seeds (username OR @arms.local email).
  const local = tryLocalSignIn(email, password);
  if (local) return local;

  if (shouldPreferLocalDemoAuth(email)) {
    const demo = tryDemoUsersSignIn(email, password);
    if (demo) return demo;
    // Do not call Supabase Auth for local prototype accounts — they are not in Auth.
    return { error: LOGIN_FAILED_AR };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: localizeAuthError(error?.message) };
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
    photoDataUrl: managedMatch?.photoDataUrl ?? null,
    photoName: managedMatch?.photoName ?? null,
  });

  return { error: null };
}

export async function signOut() {
  clearSession();
  try {
    const { clearOpsHydrateSession } = await import("@/lib/supabase/hydrate");
    clearOpsHydrateSession();
  } catch {
    // ignore
  }
  if (!isDemoMode()) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
}
