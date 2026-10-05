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

export function listManagedUsers(): ManagedUser[] {
  return readJson<ManagedUser[]>(USERS_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getManagedUser(id: string) {
  return listManagedUsers().find((user) => user.id === id) ?? null;
}

export function findManagedUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return listManagedUsers().find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function findManagedUserByMobile(mobile: string) {
  const normalized = mobile.trim();
  if (!normalized) return null;
  return listManagedUsers().find((user) => user.mobile === normalized) ?? null;
}

export function listBranchOptionsForUsers() {
  return listBranchOptions().map((item) => ({
    id: item.id,
    name: item.name,
  }));
}

function validateUserInput(input: {
  fullName: string;
  email?: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId?: string | null;
  excludeId?: string;
}): { ok: true; email: string; branch: { id: string; name: string } | null } | { ok: false; error: string } {
  const fullName = input.fullName.trim();
  const mobile = input.mobile.trim();
  const email = (input.email ?? "").trim().toLowerCase();

  if (!fullName) return { ok: false, error: "اسم المستخدم إلزامي." };
  if (!mobile) return { ok: false, error: "رقم الجوال إلزامي." };
  if (!isValidSaudiMobile(mobile)) {
    return { ok: false, error: "رقم الجوال يجب أن يكون بصيغة سعودية صحيحة (05xxxxxxxx)." };
  }
  if (!input.role || !ASSIGNABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "صلاحية المستخدم إلزامية." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "صيغة البريد الإلكتروني غير صحيحة." };
  }

  const all = listManagedUsers();
  if (all.some((user) => user.id !== input.excludeId && user.mobile === mobile)) {
    return { ok: false, error: "رقم الجوال مستخدم لحساب آخر." };
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

  return { ok: true, email, branch };
}

export function createManagedUser(input: {
  fullName: string;
  email?: string;
  mobile: string;
  role: AssignableUserRole;
  opsBranchId?: string | null;
  password?: string;
}): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const checked = validateUserInput(input);
  if (!checked.ok) return checked;

  const now = new Date().toISOString();
  const password = (input.password?.trim() || "demo").slice(0, 64);
  const user: ManagedUser = {
    id: crypto.randomUUID(),
    fullName: input.fullName.trim(),
    email: checked.email || `${input.mobile.trim()}@arms.local`,
    mobile: input.mobile.trim(),
    role: input.role,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password,
    createdAt: now,
    updatedAt: now,
  };

  writeJson(USERS_KEY, [user, ...listManagedUsers()]);
  return { ok: true, user };
}

/** Admin update — may change role. */
export function updateManagedUserByAdmin(
  id: string,
  input: {
    fullName: string;
    email?: string;
    mobile: string;
    role: AssignableUserRole;
    opsBranchId?: string | null;
    password?: string;
  },
): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const all = listManagedUsers();
  const existing = all.find((user) => user.id === id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };

  const checked = validateUserInput({ ...input, excludeId: id });
  if (!checked.ok) return checked;

  const next: ManagedUser = {
    ...existing,
    fullName: input.fullName.trim(),
    email: checked.email || existing.email,
    mobile: input.mobile.trim(),
    role: input.role,
    opsBranchId: checked.branch?.id ?? null,
    opsBranchName: checked.branch?.name ?? null,
    password: input.password?.trim() ? input.password.trim() : existing.password,
    updatedAt: new Date().toISOString(),
  };

  writeJson(
    USERS_KEY,
    all.map((user) => (user.id === id ? next : user)),
  );
  return { ok: true, user: next };
}

/** Self-service update — role cannot change. */
export function updateManagedUserSelf(
  id: string,
  input: {
    fullName: string;
    email?: string;
    mobile: string;
    opsBranchId?: string | null;
  },
): { ok: true; user: ManagedUser } | { ok: false; error: string } {
  const existing = getManagedUser(id);
  if (!existing) return { ok: false, error: "المستخدم غير موجود." };

  return updateManagedUserByAdmin(id, {
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile,
    role: existing.role,
    opsBranchId: input.opsBranchId ?? existing.opsBranchId,
  });
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
    role: user.role,
    email: user.email,
    mobile: user.mobile,
    opsBranchId: user.opsBranchId,
    opsBranchName:
      user.opsBranchName ??
      (user.role === "technician" ? "مركز الصيانة" : null),
  };
}

export function authenticateManagedUser(
  emailOrMobile: string,
  password: string,
): ManagedUser | null {
  const key = emailOrMobile.trim().toLowerCase();
  const mobileKey = emailOrMobile.trim();
  const user = listManagedUsers().find(
    (item) =>
      item.email.toLowerCase() === key ||
      item.mobile === mobileKey ||
      item.mobile === key,
  );
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}
