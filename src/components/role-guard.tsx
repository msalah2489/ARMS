"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homePathForRole, isBranchRole, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { hasAnyPermission, hasPermission, type PermissionKey } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import type { AppRole } from "@/types/domain";

type AllowedRole =
  | "branch"
  | "technician"
  | "admin"
  | AppRole;

type Allowed = AllowedRole | AllowedRole[];

function roleAllowed(role: AppRole, allowed: Allowed) {
  const normalized = normalizeRole(role);
  const list = Array.isArray(allowed) ? allowed : [allowed];

  return list.some((item) => {
    if (item === "branch") return isBranchRole(normalized);
    if (item === "technician") return isTechnicianRole(normalized);
    if (item === "admin") {
      return (
        normalized === "system_admin" ||
        normalized === "maintenance_manager" ||
        normalized === "maintenance_supervisor"
      );
    }
    return normalized === item || role === item;
  });
}

export function RoleGuard({
  allow,
  permission,
  children,
}: {
  /** Role(s) that may access. Optional when `permission` is set. */
  allow?: Allowed;
  /** Permission key(s) — access if user has any of these (OR with roles). */
  permission?: PermissionKey | PermissionKey[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  function isAllowed(session: NonNullable<ReturnType<typeof readSession>>) {
    const roleOk = allow ? roleAllowed(session.role, allow) : false;
    const permList = permission
      ? Array.isArray(permission)
        ? permission
        : [permission]
      : [];
    const permOk =
      permList.length > 0 ? hasAnyPermission(session, permList) : false;
    // If neither constraint provided, deny. If either matches, allow.
    if (!allow && permList.length === 0) return false;
    if (allow && permList.length > 0) return roleOk || permOk;
    if (allow) return roleOk;
    return permOk;
  }

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!isAllowed(session)) {
      router.replace(homePathForRole(session.role));
    }
  }, [allow, permission, router]);

  const session = typeof window !== "undefined" ? readSession() : null;
  if (!session || !isAllowed(session)) {
    return <p className="text-sm text-ink-700/70">جاري التحقق من الصلاحيات…</p>;
  }

  return <>{children}</>;
}

/** Convenience for action-level checks in pages. */
export function sessionHasPermission(key: PermissionKey) {
  return hasPermission(readSession(), key);
}
