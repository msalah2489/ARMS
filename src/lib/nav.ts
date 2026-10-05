import type { AppRole } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";
import {
  ClipboardList,
  Cpu,
  FilePlus2,
  LayoutDashboard,
  Package,
  PackageCheck,
  QrCode,
  Settings,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[];
};

/** Branch account tabs only */
const BRANCH_NAV: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["branch", "branch_employee"] },
  { href: "/service-requests/new", label: "إنشاء طلب", icon: FilePlus2, roles: ["branch", "branch_employee"] },
  { href: "/branch/receiving", label: "استلام الصيانة", icon: PackageCheck, roles: ["branch", "branch_employee"] },
  { href: "/branch/shipping", label: "شحن الصيانة", icon: Truck, roles: ["branch", "branch_employee"] },
  { href: "/scan", label: "سكان الجهاز", icon: QrCode, roles: ["branch", "branch_employee"] },
  { href: "/reports", label: "التقارير", icon: ClipboardList, roles: ["branch", "branch_employee"] },
];

/** Technician account tabs only */
const TECHNICIAN_NAV: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["technician", "mobile_technician"] },
  { href: "/scan", label: "سكان الجهاز", icon: QrCode, roles: ["technician", "mobile_technician"] },
  { href: "/technician/work", label: "عمل الفني", icon: Wrench, roles: ["technician", "mobile_technician"] },
];

/** Admin / managers / supervisors */
const ADMIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "الرئيسية",
    icon: LayoutDashboard,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/service-requests",
    label: "طلبات الصيانة",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/devices",
    label: "الأجهزة",
    icon: Cpu,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/customers",
    label: "العملاء",
    icon: Users,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/branches",
    label: "الفروع",
    icon: Store,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/branch/shipping",
    label: "بوالص الشحن",
    icon: Truck,
    roles: ["maintenance_manager"],
  },
  {
    href: "/spare-parts",
    label: "قطع الغيار",
    icon: Package,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/reports",
    label: "التقارير",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/settings",
    label: "إعدادات النظام",
    icon: Settings,
    roles: ["system_admin", "manager"],
  },
];

export const NAV_ITEMS: NavItem[] = [...BRANCH_NAV, ...TECHNICIAN_NAV, ...ADMIN_NAV];

export function navForRole(role: AppRole) {
  const normalized = normalizeRole(role);

  if (normalized === "branch") {
    return BRANCH_NAV;
  }

  if (normalized === "technician" || normalized === "mobile_technician") {
    return TECHNICIAN_NAV;
  }

  return ADMIN_NAV.filter((item) => item.roles.includes(role) || item.roles.includes(normalized));
}
