import { DEMO_USERS, isDemoMode, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  authenticateManagedUser,
  listManagedUsers,
  managedUserToProfile,
  normalizeCredentialText,
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

function profilesLookEqual(a: Profile, b: Profile) {
  return (
    a.id === b.id &&
    a.role === b.role &&
    a.fullName === b.fullName &&
    a.username === b.username &&
    a.email === b.email &&
    a.mobile === b.mobile &&
    a.opsBranchId === b.opsBranchId &&
    a.opsBranchName === b.opsBranchName &&
    a.isActive === b.isActive &&
    a.photoDataUrl === b.photoDataUrl &&
    JSON.stringify(a.permissions ?? null) === JSON.stringify(b.permissions ?? null)
  );
}

export function writeSession(profile: Profile) {
  // Skip no-op writes — hydrate used to rewrite the session every pull and
  // re-render the whole app (and can freeze the tab when a photo is stored).
  const current = readSession();
  if (current && profilesLookEqual(current, profile)) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("arms-session-updated"));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("arms-session-updated"));
}

function findManagedLoginMatch(login: string) {
  const normalized = normalizeCredentialText(login);
  const key = normalized.toLowerCase();
  const mobileKey = normalized;
  return listManagedUsers({ includeArchived: true }).find(
    (item) =>
      item.username.toLowerCase() === key ||
      item.email.toLowerCase() === key ||
      item.mobile === mobileKey,
  );
}

/** True when login is a real Auth email (not username / @arms.local managed accounts). */
function looksLikeSupabaseAuthEmail(login: string) {
  const value = normalizeCredentialText(login).toLowerCase();
  if (!value.includes("@") || value.endsWith("@arms.local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function tryLocalSignIn(login: string, password: string) {
  const managed = authenticateManagedUser(login, password);
  if (managed) {
    writeSession(managedUserToProfile(managed));
    return { error: null as string | null };
  }

  const match = findManagedLoginMatch(login);
  if (match?.isArchived) {
    return { error: "هذا الحساب مؤرشف. راجع مدير النظام." };
  }
  if (match && !match.isActive) {
    return { error: "هذا الحساب معطّل. راجع مدير النظام." };
  }
  // Known managed user + wrong password: stop here (do not show Supabase Auth English errors).
  if (match) {
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  return null;
}

export async function signIn(email: string, password: string) {
  const login = normalizeCredentialText(email);
  const pass = normalizeCredentialText(password);

  // Pull cloud users (and other ops) before authenticating so Pages logins see shared accounts.
  try {
    const { hydrateOpsFromSupabase } = await import("@/lib/supabase/hydrate");
    await hydrateOpsFromSupabase();
  } catch {
    // Offline / misconfigured: fall through to local cache.
  }

  // Local managed users work in demo and on GitHub Pages static export.
  const local = tryLocalSignIn(login, pass);
  if (local) return local;

  if (isDemoMode()) {
    const user = DEMO_USERS.find(
      (item) =>
        item.email.toLowerCase() === login.toLowerCase() &&
        normalizeCredentialText(item.password) === pass,
    );
    if (!user) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة." };

    const managed = authenticateManagedUser(user.email, pass);
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

  // Pages prototype logins are managed users in app_users. Only fall through to
  // Supabase Auth for real email addresses (not bare usernames / @arms.local).
  if (!looksLikeSupabaseAuthEmail(login)) {
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: login,
    password: pass,
  });
  if (error || !data.user) {
    const raw = error?.message ?? "";
    if (/invalid login credentials/i.test(raw) || /email not confirmed/i.test(raw)) {
      return { error: "اسم المستخدم أو كلمة المرور غير صحيحة." };
    }
    return { error: raw || "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  let role = normalizeRole((profile?.role as AppRole | undefined) ?? "branch");
  if (login.toLowerCase() === "tech@arms.app") role = "technician";
  if (login.toLowerCase() === "branch@arms.app") role = "branch";

  // Prefer managed-user branch assignment from cloud cache — never invent demo branch IDs.
  const managedMatch = listManagedUsers().find(
    (item) =>
      item.id === data.user.id ||
      (item.email && item.email.toLowerCase() === (data.user.email ?? login).toLowerCase()),
  );

  writeSession({
    id: data.user.id,
    fullName: profile?.full_name ?? managedMatch?.fullName ?? data.user.email ?? "مستخدم",
    username: managedMatch?.username ?? (data.user.email ?? login).split("@")[0],
    role: managedMatch ? normalizeRole(managedMatch.role) : role,
    email: data.user.email ?? login,
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
