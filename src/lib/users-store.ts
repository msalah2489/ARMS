import { isDemoMode } from "@/lib/auth";
import { isValidSaudiMobile } from "@/lib/branch-catalog";
import { listBranchOptions } from "@/lib/branches-store";
import {
  getDefaultPermissionsForRole,
  normalizePermissions,
  protectSelfAdminPermissions,
  type PermissionKey,
} from "@/lib/permissions";
import { pushAppUsers, pullAppUsers } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AssignableUserRole, ManagedUser, Profile, UserGender } from "@/types/domain";

export function genderSymbol(gender?: UserGender | null): string {
  if (gender === "male") return "♂";
  if (gender === "female") return "♀";
  return "";
}

export function normalizeGender(value: unknown): UserGender | null {
  if (value === "male" || value === "female") return value;
  return null;
}

const USERS_KEY = "arms_managed_users_v1";

export const ASSIGNABLE_ROLE_LABELS: Record<AssignableUserRole, string> = {
  system_admin: "مدير نظام",
  maintenance_manager: "مدير صيانة",
  maintenance_supervisor: "مشرف صيانة",
  branch: "فرع",
  technician: "فني",
  mobile_technician: "فني متنقل",
  pickup_courier: "مندوب الاستلام",
};

export const ASSIGNABLE_ROLES = Object.keys(ASSIGNABLE_ROLE_LABELS) as AssignableUserRole[];

const SEED_USERS: Array<Omit<ManagedUser, "createdAt" | "updatedAt" | "permissions">> = [
  {
    id: "admin-local",
    fullName: "أحمد المدير",
    username: "admin",
    email: "admin@arms.local",
    mobile: "0500000001",
    role: "system_admin",
    opsBranchId: null,
    opsBranchName: null,
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "maint-manager-local",
    fullName: "سارة مدير الصيانة",
    username: "maint-manager",
    email: "maint-manager@arms.local",
    mobile: "0500000002",
    role: "maintenance_manager",
    opsBranchId: null,
    opsBranchName: null,
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "branch-local",
    fullName: "نورة الفرع",
    username: "branch",
    email: "branch@arms.local",
    mobile: "0500000003",
    role: "branch",
    opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName: "فرع الرياض",
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "tech-local",
    fullName: "كريم الفني",
    username: "tech",
    email: "tech@arms.local",
    mobile: "0500000004",
    role: "technician",
    opsBranchId: null,
    opsBranchName: "مركز الصيانة",
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "supervisor-local",
    fullName: "عمر المشرف",
    username: "supervisor",
    email: "supervisor@arms.local",
    mobile: "0500000005",
    role: "maintenance_supervisor",
    opsBranchId: null,
    opsBranchName: null,
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "mobile-local",
    fullName: "ياسر المتنقل",
    username: "mobile",
    email: "mobile@arms.local",
    mobile: "0500000006",
    role: "mobile_technician",
    opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName: "فرع الرياض",
    password: "demo",
    isActive: true,
    isArchived: false,
  },
  {
    id: "courier-local",
    fullName: "فهد مندوب الاستلام",
    username: "courier",
    email: "courier@arms.local",
    mobile: "0500000007",
    role: "pickup_courier",
    opsBranchId: null,
    opsBranchName: null,
    password: "demo",
    isActive: true,
    isArchived: false,
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function schedulePersist(users: ManagedUser[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  // Never schedule an empty wipe — pushAppUsers also guards, but skip the round-trip.
  if (!Array.isArray(users) || users.length === 0) {
    console.warn("[arms] schedulePersist: skipped empty users push");
    return;
  }
  void persistUsersNow(users);
}

/** Awaited cloud persist — used by admin create/update so UI can surface sync failures. */
async function persistUsersNow(
  users: ManagedUser[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || isDemoMode()) return { ok: true };
  if (!Array.isArray(users) || users.length === 0) {
    return { ok: false, error: "رفض مزامنة قائمة مستخدمين فارغة." };
  }
  // Upsert only — orphan prune disabled by default (incomplete cache must never wipe cloud).
  const result = await pushAppUsers(users, { pruneOrphans: false });
  if (!result.ok) {
    console.error("[arms] persist users failed:", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

/**
 * Union merge by id. Local-only users are always kept.
 * When preferLocal=true, local overwrites remote for shared ids (recovery / passwords).
 */
export function mergeManagedUserLists(
  remote: ManagedUser[],
  local: ManagedUser[],
  options?: { preferLocal?: boolean },
): ManagedUser[] {
  const byId = new Map<string, ManagedUser>();
  const preferLocal = options?.preferLocal === true;
  const first = preferLocal ? remote : local;
  const second = preferLocal ? local : remote;
  for (const user of first) {
    if (user?.id) byId.set(user.id, normalizeUser(user));
  }
  for (const user of second) {
    if (user?.id) byId.set(user.id, normalizeUser(user));
  }
  return [...byId.values()];
}

/**
 * TEMPORARY recovery: push every local managed user to app_users (upsert, no prune).
 * Use when cloud was accidentally reduced while the browser tab still holds the full list.
 */
export async function recoverLocalUsersToSupabase(): Promise<
  | { ok: true; recovered: number; localCount: number; mergedCount: number }
  | { ok: false; error: string; localCount: number }
> {
  if (typeof window === "undefined") {
    return { ok: false, error: "الاستعادة تعمل من المتصفح فقط.", localCount: 0 };
  }
  if (!isSupabaseConfigured() || isDemoMode()) {
    return {
      ok: false,
      error: "Supabase غير مضبوط أو الوضع تجريبي.",
      localCount: listManagedUsersLocal().length,
    };
  }

  const local = listManagedUsersLocal();
  if (local.length === 0) {
    return { ok: false, error: "لا توجد حسابات في التخزين المحلي للاستعادة.", localCount: 0 };
  }

  let remote: ManagedUser[] = [];
  try {
    remote = await pullAppUsers();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `تعذر قراءة الحسابات من السحابة: ${message}`, localCount: local.length };
  }

  // Prefer local for shared ids so passwords/names from this browser win during recovery.
  const merged = mergeManagedUserLists(remote, local, { preferLocal: true });
  replaceManagedUsers(merged);

  const result = await pushAppUsers(merged, { pruneOrphans: false });
  if (!result.ok) {
    return { ok: false, error: result.error, localCount: local.length };
  }

  return {
    ok: true,
    recovered: local.length,
    localCount: local.length,
    mergedCount: merged.length,
  };
}

/**
 * Merge remote app_users into local cache before a write/push.
 * Prevents creating a user on an empty/partial local cache from orphan-deleting
 * everyone else already in the cloud.
 */
async function mergeRemoteUsersIntoLocal(): Promise<void> {
  if (!isSupabaseConfigured() || isDemoMode() || typeof window === "undefined") return;
  try {
    const remote = await pullAppUsers();
    if (remote.length === 0) return;
    const local = listManagedUsersLocal();
    // Local wins on shared ids so in-progress edits aren't clobbered before push.
    replaceManagedUsers(mergeManagedUserLists(remote, local, { preferLocal: true }));
  } catch (error) {
    console.warn("[arms] mergeRemoteUsersIntoLocal", error);
  }
}

/** Raw localStorage read (no seed). Used by Supabase hydrate. */
export function listManagedUsersLocal(): ManagedUser[] {
  return readJson<ManagedUser[]>(USERS_KEY, []).map(normalizeUser);
}

export function replaceManagedUsers(users: ManagedUser[]) {
  if (typeof window === "undefined") return;
  writeJson(USERS_KEY, users.map(normalizeUser));
}

export function applyRemoteManagedUsers(users: ManagedUser[]) {
  replaceManagedUsers(users);
}

/** Minimal bootstrap admin used when cloud + local users are both empty. */
export function getBootstrapAdminUser(): ManagedUser {
  const now = new Date().toISOString();
  return normalizeUser({
    ...SEED_USERS[0],
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Keep at least one loginable account when local cache is empty.
 * Writes bootstrap admin to localStorage only — does NOT push to cloud.
 * Pushing here (before hydrate) used to wipe remote users down to admin alone.
 * Hydrate seeds remote when it confirms app_users is empty.
 */
export function ensureBootstrapAdminIfEmpty(): ManagedUser[] {
  const existing = listManagedUsersLocal();
  if (existing.length > 0) return existing;
  const admin = getBootstrapAdminUser();
  replaceManagedUsers([admin]);
  return [admin];
}

/** Active, non-archived users for temporary login shortcuts. */
export function listLoginShortcutUsers(): ManagedUser[] {
  ensureBootstrapAdminIfEmpty();
  return listManagedUsers().filter((user) => user.isActive && !user.isArchived);
}

/** Seed demo accounts when both remote and local are empty (demo mode only). */
export function seedManagedUsersIfEmpty(): ManagedUser[] {
  const existing = listManagedUsersLocal();
  if (existing.length > 0) return existing;
  if (isSupabaseConfigured() && !isDemoMode()) return [];
  const now = new Date().toISOString();
  return SEED_USERS.map((seed) =>
    normalizeUser({
      ...seed,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function normalizeUser(user: ManagedUser): ManagedUser {
  const username =
    user.username?.trim() ||
    (user.email && !user.email.endsWith("@arms.local")
      ? user.email.split("@")[0]
      : user.mobile) ||
    user.id.slice(0, 8);
  const role = user.role;
  const photoDataUrl = user.photoDataUrl?.trim() || null;
  const photoName = photoDataUrl ? user.photoName?.trim() || null : null;
  return {
    ...user,
    username: username.toLowerCase(),
    role,
    permissions: normalizePermissions(user.permissions, role),
    isActive: user.isActive !== false,
    isArchived: Boolean(user.isArchived),
    gender: normalizeGender(user.gender),
    photoDataUrl,
    photoName,
  };
}

function readAllManagedUsers(): ManagedUser[] {
  return ensureSeededUsers();
}

/** Ensure built-in demo accounts appear in the admin users list (demo mode only). */
function ensureSeededUsers(): ManagedUser[] {
  const existing = readJson<ManagedUser[]>(USERS_KEY, []).map(normalizeUser);

  // Cloud mode: never inject demo users; hydrate/remote is the source of truth.
  if (isSupabaseConfigured() && !isDemoMode()) {
    return existing;
  }

  const ids = new Set(existing.map((user) => user.id));
  const emails = new Set(existing.map((user) => user.email.toLowerCase()));
  const usernames = new Set(existing.map((user) => user.username.toLowerCase()));

  const now = new Date().toISOString();
  const missing = SEED_USERS.filter(
    (seed) =>
      !ids.has(seed.id) &&
      !emails.has(seed.email.toLowerCase()) &&
      !usernames.has(seed.username.toLowerCase()),
  ).map((seed) => ({
    ...seed,
    createdAt: now,
    updatedAt: now,
  }));

  if (missing.length === 0) return existing;

  const merged = [...existing, ...missing].map(normalizeUser);
  writeJson(USERS_KEY, merged);
  return merged;
}

export function listManagedUsers(options?: { includeArchived?: boolean }): ManagedUser[] {
  const all = readAllManagedUsers().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (options?.includeArchived) return all;
  return all.filter((user) => !user.isArchived);
}

export function getManagedUser(id: string) {
  return readAllManagedUsers().find((user) => user.id === id) ?? null;
}

export function findManagedUserForSession(profile: {
  id: string;
  email?: string | null;
  username?: string | null;
}) {
  const all = listManagedUsers({ includeArchived: true });
  return (
    all.find((user) => user.id === profile.id) ??
    all.find(
      (user) =>
        profile.email && user.email.toLowerCase() === profile.email.toLowerCase(),
    ) ??
    all.find(
      (user) =>
        profile.username &&
        user.username.toLowerCase() === profile.username.toLowerCase(),
    ) ??
    null
  );
}

export function listBranchOptionsForUsers() {
  return listBranchOptions().map((item) => ({
    id: item.id,
    name: item.name,
  }));
}

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}

function validateUserInput(input: {
  fullName: string;
  username?: string;
  email?: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId?: string | null;
  excludeId?: string;
  requireUsername?: boolean;
}):
  | {
      ok: true;
      fullName: string;
      username: string | null;
      email: string;
      mobile: string;
      branch: { id: string; name: string } | null;
    }
  | { ok: false; error: string } {
  const fullName = input.fullName.trim();
  const mobile = input.mobile.trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const username = (input.username ?? "").trim().toLowerCase();

  if (!fullName) return { ok: false, error: "الاسم إلزامي." };
  if (!mobile) return { ok: false, error: "رقم الجوال إلزامي." };
  if (!isValidSaudiMobile(mobile)) {
    return { ok: false, error: "رقم الجوال يجب أن يكون بصيغة سعودية صحيحة (05xxxxxxxx)." };
  }
  if (!input.role || !ASSIGNABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "صلاحية المستخدم إلزامية." };
  }
  if (input.requireUsername) {
    if (!username) return { ok: false, error: "اسم المستخدم إلزامي." };
    if (!isValidUsername(username)) {
      return {
        ok: false,
        error: "اسم المستخدم: 3–32 حرفًا (إنجليزي/أرقام . _ - فقط).",
      };
    }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صحيحة." };
  }

  const all = listManagedUsers({ includeArchived: true });
  if (all.some((user) => user.id !== input.excludeId && user.mobile === mobile)) {
    return { ok: false, error: "رقم الجوال مستخدم لحساب آخر." };
  }
  if (
    username &&
    all.some((user) => user.id !== input.excludeId && user.username.toLowerCase() === username)
  ) {
    return { ok: false, error: "اسم المستخدم مستخدم مسبقًا." };
  }
  if (email && all.some((user) => user.id !== input.excludeId && user.email.toLowerCase() === email)) {
    return { ok: false, error: "البريد الإلكتروني مستخدم لحساب آخر." };
  }

  let branch: { id: string; name: string } | null = null;
  if (input.role === "branch") {
    if (!input.opsBranchId) {
      return { ok: false, error: "اختيار الفرع إلزامي لحساب الفرع." };
    }
    branch = listBranchOptionsForUsers().find((item) => item.id === input.opsBranchId) ?? null;
    if (!branch) return { ok: false, error: "الفرع المحدد غير موجود." };
  } else if (input.opsBranchId) {
    branch = listBranchOptionsForUsers().find((item) => item.id === input.opsBranchId) ?? null;
  }

  return {
    ok: true,
    fullName,
    username: username || null,
    email,
    mobile,
    branch,
  };
}

export async function createManagedUser(input: {
  fullName: string;
  username: string;
  email?: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId?: string | null;
  password?: string;
  permissions?: string[];
  gender?: UserGender | null;
  photoDataUrl?: string | null;
  photoName?: string | null;
}): Promise<{ ok: true; user: ManagedUser } | { ok: false; error: string }> {
  await mergeRemoteUsersIntoLocal();
  const checked = validateUserInput({ ...input, requireUsername: true });
  if (!checked.ok) return checked;

  const now = new Date().toISOString();
  const password = (input.password?.trim() || "demo").slice(0, 64);
  const permissions = normalizePermissions(
    input.permissions ?? getDefaultPermissionsForRole(input.role),
    input.role,
  );
  const photoDataUrl = input.photoDataUrl?.trim() || null;
  const user: ManagedUser = {
    id: crypto.randomUUID(),
    fullName: checked.fullName,
    username: checked.username!,
    email: checked.email || `${checked.username}@arms.local`,
    mobile: checked.mobile,
    role: input.role,
    permissions,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password,
    isActive: true,
    isArchived: false,
    gender: normalizeGender(input.gender),
    photoDataUrl,
    photoName: photoDataUrl ? input.photoName?.trim() || null : null,
    createdAt: now,
    updatedAt: now,
  };

  const next = [user, ...listManagedUsers({ includeArchived: true })];
  writeJson(USERS_KEY, next);
  const synced = await persistUsersNow(next);
  if (!synced.ok) {
    return {
      ok: false,
      error: `حُفظ محليًا لكن المزامنة مع السحابة فشلت: ${synced.error}`,
    };
  }
  return { ok: true, user };
}

/** Admin update — username, branch/role/active, permissions, and password can change (upsert by id). */
export async function updateManagedUserByAdmin(
  id: string,
  input: {
    fullName: string;
    username?: string;
    email?: string;
    mobile: string;
    role: AssignableUserRole;
    opsBranchId?: string | null;
    password?: string;
    isActive?: boolean;
    permissions?: string[];
    gender?: UserGender | null;
    photoDataUrl?: string | null;
    photoName?: string | null;
    /** Actor performing the update (used to protect self-admin powers). */
    actor?: { id: string; role: string } | null;
  },
): Promise<{ ok: true; user: ManagedUser } | { ok: false; error: string }> {
  await mergeRemoteUsersIntoLocal();
  const all = listManagedUsers({ includeArchived: true });
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  if (existing.isArchived) return { ok: false, error: "لا يمكن تعديل مستخدم مؤرشف. ألغِ الأرشفة أولاً." };

  const checked = validateUserInput({
    ...input,
    username: input.username ?? existing.username,
    excludeId: id,
    requireUsername: true,
  });
  if (!checked.ok) return checked;

  const nextUsername = checked.username!;
  const nextEmail =
    checked.email ||
    (existing.email.toLowerCase().endsWith("@arms.local")
      ? `${nextUsername}@arms.local`
      : existing.email);

  let permissions = normalizePermissions(
    input.permissions ?? existing.permissions,
    input.role,
  ) as PermissionKey[];
  permissions = protectSelfAdminPermissions(
    input.actor,
    id,
    input.role,
    permissions,
  );

  // Block careless self-demotion of system_admin (strips all admin powers).
  if (
    input.actor?.id === id &&
    existing.role === "system_admin" &&
    input.role !== "system_admin"
  ) {
    return {
      ok: false,
      error: "لا يمكنك إزالة دور مدير النظام عن نفسك. اطلب من مدير نظام آخر إن لزم.",
    };
  }

  const photoDataUrl =
    input.photoDataUrl !== undefined
      ? input.photoDataUrl?.trim() || null
      : existing.photoDataUrl ?? null;
  const next: ManagedUser = {
    ...existing,
    fullName: checked.fullName,
    username: nextUsername,
    email: nextEmail,
    mobile: checked.mobile,
    role: input.role,
    permissions,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password: input.password?.trim() ? input.password.trim() : existing.password,
    isActive: input.isActive ?? existing.isActive,
    gender:
      input.gender !== undefined ? normalizeGender(input.gender) : existing.gender ?? null,
    photoDataUrl,
    photoName: photoDataUrl
      ? input.photoName !== undefined
        ? input.photoName?.trim() || null
        : existing.photoName ?? null
      : null,
    updatedAt: new Date().toISOString(),
  };

  const updated = all.map((user) => (user.id === id ? next : user));
  writeJson(USERS_KEY, updated);
  const synced = await persistUsersNow(updated);
  if (!synced.ok) {
    return {
      ok: false,
      error: `حُفظ محليًا لكن المزامنة مع السحابة فشلت: ${synced.error}`,
    };
  }
  return { ok: true, user: next };
}

export async function setManagedUserActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true; user: ManagedUser } | { ok: false; error: string }> {
  const existing = getManagedUser(id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  return updateManagedUserByAdmin(id, {
    fullName: existing.fullName,
    username: existing.username,
    email: existing.email,
    mobile: existing.mobile,
    role: existing.role,
    opsBranchId: existing.opsBranchId,
    isActive,
  });
}

/** Employee self-service: username, mobile, password, and optional photo. No branch/role. */
export async function updateManagedUserSelf(
  id: string,
  input: {
    username?: string;
    mobile: string;
    currentPassword?: string;
    newPassword?: string;
    gender?: UserGender | null;
    photoDataUrl?: string | null;
    photoName?: string | null;
  },
): Promise<{ ok: true; user: ManagedUser } | { ok: false; error: string }> {
  await mergeRemoteUsersIntoLocal();
  const all = listManagedUsers({ includeArchived: true });
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  if (existing.isArchived) return { ok: false, error: "الحساب مؤرشف. راجع مدير النظام." };
  if (!existing.isActive) return { ok: false, error: "الحساب معطّل. راجع مدير النظام." };

  const username =
    input.username !== undefined
      ? input.username.trim().toLowerCase()
      : existing.username.trim().toLowerCase();
  if (!username) return { ok: false, error: "اسم المستخدم إلزامي." };
  if (!isValidUsername(username)) {
    return {
      ok: false,
      error: "اسم المستخدم يجب أن يكون ٣–٣٢ حرفًا (حروف إنجليزية أو أرقام أو . _ -).",
    };
  }
  if (
    all.some(
      (user) => user.id !== id && user.username.toLowerCase() === username,
    )
  ) {
    return { ok: false, error: "اسم المستخدم مستخدم لحساب آخر." };
  }

  const mobile = input.mobile.trim();
  if (!mobile) return { ok: false, error: "رقم الجوال إلزامي." };
  if (!isValidSaudiMobile(mobile)) {
    return { ok: false, error: "رقم الجوال يجب أن يكون بصيغة سعودية صحيحة (05xxxxxxxx)." };
  }
  if (all.some((user) => user.id !== id && user.mobile === mobile)) {
    return { ok: false, error: "رقم الجوال مستخدم لحساب آخر." };
  }

  let password = existing.password;
  if (input.newPassword?.trim()) {
    if (!input.currentPassword?.trim()) {
      return { ok: false, error: "أدخل كلمة المرور الحالية لتغييرها." };
    }
    if (input.currentPassword !== existing.password) {
      return { ok: false, error: "كلمة المرور الحالية غير صحيحة." };
    }
    if (input.newPassword.trim().length < 4) {
      return { ok: false, error: "كلمة المرور الجديدة يجب ألا تقل عن 4 أحرف." };
    }
    password = input.newPassword.trim();
  }

  const photoDataUrl =
    input.photoDataUrl !== undefined
      ? input.photoDataUrl?.trim() || null
      : existing.photoDataUrl ?? null;
  const next: ManagedUser = {
    ...existing,
    username,
    mobile,
    password,
    gender:
      input.gender !== undefined ? normalizeGender(input.gender) : existing.gender ?? null,
    photoDataUrl,
    photoName: photoDataUrl
      ? input.photoName !== undefined
        ? input.photoName?.trim() || null
        : existing.photoName ?? null
      : null,
    updatedAt: new Date().toISOString(),
  };

  const updated = all.map((user) => (user.id === id ? next : user));
  writeJson(USERS_KEY, updated);
  const synced = await persistUsersNow(updated);
  if (!synced.ok) {
    return {
      ok: false,
      error: `حُفظ محليًا لكن المزامنة مع السحابة فشلت: ${synced.error}`,
    };
  }
  return { ok: true, user: next };
}

/** Soft-archive: keep history/related data, hide from active lists. */
export async function archiveManagedUser(
  id: string,
  archived = true,
): Promise<{ ok: true; user: ManagedUser } | { ok: false; error: string }> {
  await mergeRemoteUsersIntoLocal();
  const all = listManagedUsers({ includeArchived: true });
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };

  const next: ManagedUser = {
    ...existing,
    isArchived: archived,
    isActive: archived ? false : existing.isActive,
    updatedAt: new Date().toISOString(),
  };
  const updated = all.map((user) => (user.id === id ? next : user));
  writeJson(USERS_KEY, updated);
  const synced = await persistUsersNow(updated);
  if (!synced.ok) {
    return {
      ok: false,
      error: `حُفظ محليًا لكن المزامنة مع السحابة فشلت: ${synced.error}`,
    };
  }
  return { ok: true, user: next };
}

/** @deprecated Use archiveManagedUser — hard delete removed to preserve history. */
export async function deleteManagedUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await archiveManagedUser(id, true);
  if (!result.ok) return result;
  return { ok: true };
}

export function managedUserToProfile(user: ManagedUser): Profile {
  const normalized = normalizeUser(user);
  return {
    id: normalized.id,
    fullName: normalized.fullName,
    username: normalized.username,
    role: normalized.role,
    email: normalized.email,
    mobile: normalized.mobile,
    opsBranchId: normalized.opsBranchId,
    opsBranchName:
      normalized.opsBranchName ??
      (normalized.role === "technician" || normalized.role === "mobile_technician"
        ? "مركز الصيانة"
        : null),
    isActive: normalized.isActive,
    permissions: normalized.permissions,
    gender: normalized.gender ?? null,
    photoDataUrl: normalized.photoDataUrl ?? null,
    photoName: normalized.photoName ?? null,
  };
}

export function authenticateManagedUser(
  login: string,
  password: string,
): ManagedUser | null {
  const key = login.trim().toLowerCase();
  const mobileKey = login.trim();
  const user = listManagedUsers({ includeArchived: true }).find(
    (item) =>
      item.username.toLowerCase() === key ||
      item.email.toLowerCase() === key ||
      item.mobile === mobileKey,
  );
  if (!user) return null;
  if (user.isArchived) return null;
  if (!user.isActive) return null;
  if (user.password !== password) return null;
  return user;
}
