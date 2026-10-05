"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isBranchRole, isTechnicianRole, normalizeRole } from "@/lib/auth";
import { readSession } from "@/lib/session";
import type { AppRole } from "@/types/domain";

type Allowed =
  | "branch"
  | "technician"
  | "admin"
  | AppRole
  | Array<"branch" | "technician" | "admin" | AppRole>;

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
  children,
}: {
  allow: Allowed;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!roleAllowed(session.role, allow)) {
      router.replace("/dashboard");
    }
  }, [allow, router]);

  const session = typeof window !== "undefined" ? readSession() : null;
  if (!session || !roleAllowed(session.role, allow)) {
    return <p className="text-sm text-ink-700/70">جاري التحقق من الصلاحيات…</p>;
  }

  return <>{children}</>;
}
