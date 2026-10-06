import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AppRole } from "@/types/domain";

export const ROLE_LABELS: Record<AppRole, string> = {
  system_admin: "مدير نظام",
  maintenance_manager: "مدير صيانة",
  branch: "فرع",
  technician: "فني",
  maintenance_supervisor: "مشرف صيانة",
  mobile_technician: "فني متنقل",
  manager: "مدير نظام",
  supervisor: "مشرف صيانة",
  branch_employee: "فرع",
  service_center_employee: "مركز صيانة",
};

export const DEMO_USERS: Array<{
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  opsBranchId?: string;
  opsBranchName?: string;
}> = [
  {
    email: "admin@arms.local",
    password: "demo",
    fullName: "أحمد المدير",
    role: "system_admin",
  },
  {
    email: "maint-manager@arms.local",
    password: "demo",
    fullName: "سارة مدير الصيانة",
    role: "maintenance_manager",
  },
  {
    email: "branch@arms.local",
    password: "demo",
    fullName: "نورة الفرع",
    role: "branch",
    opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName: "فرع الرياض",
  },
  {
    email: "tech@arms.local",
    password: "demo",
    fullName: "كريم الفني",
    role: "technician",
  },
  {
    email: "supervisor@arms.local",
    password: "demo",
    fullName: "عمر المشرف",
    role: "maintenance_supervisor",
  },
  {
    email: "mobile@arms.local",
    password: "demo",
    fullName: "ياسر المتنقل",
    role: "mobile_technician",
    opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName: "فرع الرياض",
  },
];

/**
 * Demo mode (sample data + local-only demo logins).
 * - USE_DEMO=true → always demo
 * - USE_DEMO=false → never demo
 * - unset → demo only when Supabase env is missing
 */
export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_USE_DEMO === "true") return true;
  if (process.env.NEXT_PUBLIC_USE_DEMO === "false") return false;
  return !isSupabaseConfigured();
}

export function normalizeRole(role: string): AppRole {
  switch (role) {
    case "manager":
      return "system_admin";
    case "supervisor":
      return "maintenance_supervisor";
    case "branch_employee":
      return "branch";
    case "service_center_employee":
      return "technician";
    default:
      return role as AppRole;
  }
}

export function isBranchRole(role: AppRole) {
  const normalized = normalizeRole(role);
  return normalized === "branch";
}

export function isTechnicianRole(role: AppRole) {
  const normalized = normalizeRole(role);
  return normalized === "technician" || normalized === "mobile_technician";
}

export function isMaintenanceManagerRole(role: AppRole) {
  const normalized = normalizeRole(role);
  return normalized === "maintenance_manager" || normalized === "system_admin";
}

export function isSystemAdminRole(role: AppRole) {
  const normalized = normalizeRole(role);
  return normalized === "system_admin";
}
