import type { AppRole } from "@/types/domain";

export const ROLE_LABELS: Record<AppRole, string> = {
  manager: "Manager",
  supervisor: "Supervisor",
  technician: "Technician",
  branch_employee: "Branch Employee",
  service_center_employee: "Service Center Employee",
};

export const DEMO_USERS: Array<{
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
}> = [
  {
    email: "manager@arms.local",
    password: "demo",
    fullName: "Lina Haddad",
    role: "manager",
  },
  {
    email: "supervisor@arms.local",
    password: "demo",
    fullName: "Omar Nasser",
    role: "supervisor",
  },
  {
    email: "tech@arms.local",
    password: "demo",
    fullName: "Karim Saleh",
    role: "technician",
  },
  {
    email: "branch@arms.local",
    password: "demo",
    fullName: "Nour Khalil",
    role: "branch_employee",
  },
  {
    email: "center@arms.local",
    password: "demo",
    fullName: "Maya Farhat",
    role: "service_center_employee",
  },
];

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_USE_DEMO !== "false";
}
