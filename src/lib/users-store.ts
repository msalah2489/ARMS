import { isValidSaudiMobile } from "@/lib/branch-catalog";
import { listBranchOptions } from "@/lib/branches-store";
import type { AssignableUserRole, ManagedUser, Profile } from "@/types/domain";

const USERS_KEY = "arms_managed_users_v1";

export const ASSIGNABLE_ROLE_LABELS: Record<AssignableUserRole, string> = {
  maintenance_manager: "مدير",
  maintenance_supervisor: "مشرف",
  branch: "فرع",
  technician: "فني",
};

export const ASSIGNABLE_ROLES = Object.keys(ASSIGNABLE_ROLE_LABELS) as AssignableUserRole[];

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

function normalizeUser(user: ManagedUser): ManagedUser {
  const username =
    user.username?.trim() ||
    (user.email && !user.email.endsWith("@arms.local")
      ? user.email.split("@")[0]
      : user.mobile) ||
    user.id.slice(0, 8);
  return {
    ...user,
    username: username.toLowerCase(),
    isActive: user.isActive !== false,
  };
}

export function listManagedUsers(): ManagedUser[] {
  return readJson<ManagedUser[]>(USERS_KEY, [])
    .map(normalizeUser)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getManagedUser(id: string) {
  return listManagedUsers().find((user) => user.id === id) ?? null;
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

  const all = listManagedUsers();
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

export function createManagedUser(input: {
  fullName: string;
  username: string;
  email?: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId?: string | null;
  password?: string;
}): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const checked = validateUserInput({ ...input, requireUsername: true });
  if (!checked.ok) return checked;

  const now = new Date().toISOString();
  const password = (input.password?.trim() || "demo").slice(0, 64);
  const user: ManagedUser = {
    id: crypto.randomUUID(),
    fullName: checked.fullName,
    username: checked.username!,
    email: checked.email || `${checked.username}@arms.local`,
    mobile: checked.mobile,
    role: input.role,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  writeJson(USERS_KEY, [user, ...listManagedUsers()]);
  return { ok: true, user };
}

/** Admin update — username is immutable; branch/role/active can change. */
export function updateManagedUserByAdmin(
  id: string,
  input: {
    fullName: string;
    email?: string;
    mobile: string;
    role: AssignableUserRole;
    opsBranchId?: string | null;
    password?: string;
    isActive?: boolean;
  },
): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const all = listManagedUsers();
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };

  const checked = validateUserInput({
    ...input,
    username: existing.username,
    excludeId: id,
    requireUsername: false,
  });
  if (!checked.ok) return checked;

  const next: ManagedUser = {
    ...existing,
    fullName: checked.fullName,
    // username never changes
    email: checked.email || existing.email,
    mobile: checked.mobile,
    role: input.role,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password: input.password?.trim() ? input.password.trim() : existing.password,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: new Date().toISOString(),
  };

  writeJson(
    USERS_KEY,
    all.map((user) => (user.id === id ? next : user)),
  );
  return { ok: true, user: next };
}

export function setManagedUserActive(
  id: string,
  isActive: boolean,
): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const existing = getManagedUser(id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  return updateManagedUserByAdmin(id, {
    fullName: existing.fullName,
    email: existing.email,
    mobile: existing.mobile,
    role: existing.role,
    opsBranchId: existing.opsBranchId,
    isActive,
  });
}

/** Employee self-service: mobile + password only. No branch/role/username. */
export function updateManagedUserSelf(
  id: string,
  input: {
    mobile: string;
    currentPassword?: string;
    newPassword?: string;
  },
): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const all = listManagedUsers();
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };
  if (!existing.isActive) return { ok: false, error: "الحساب معطّل. راجع مدير النظام." };

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

  const next: ManagedUser = {
    ...existing,
    mobile,
    password,
    updatedAt: new Date().toISOString(),
  };

  writeJson(
    USERS_KEY,
    all.map((user) => (user.id === id ? next : user)),
  );
  return { ok: true, user: next };
}

export function deleteManagedUser(id: string): { ok: true } | { ok: false; error: string } {
  const all = listManagedUsers();
  if (!all.some((user) => user.id === id)) return { ok: false, error: "المستخدم غير موجود." };
  writeJson(
    USERS_KEY,
    all.filter((user) => user.id !== id),
  );
  return { ok: true };
}

export function managedUserToProfile(user: ManagedUser): Profile {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    email: user.email,
    mobile: user.mobile,
    opsBranchId: user.opsBranchId,
    opsBranchName:
      user.opsBranchName ??
      (user.role === "technician" ? "مركز الصيانة" : null),
    isActive: user.isActive,
  };
}

export function authenticateManagedUser(
  login: string,
  password: string,
): ManagedUser | null {
  const key = login.trim().toLowerCase();
  const mobileKey = login.trim();
  const user = listManagedUsers().find(
    (item) =>
      item.username.toLowerCase() === key ||
      item.email.toLowerCase() === key ||
      item.mobile === mobileKey,
  );
  if (!user) return null;
  if (!user.isActive) return null;
  if (user.password !== password) return null;
  return user;
}
