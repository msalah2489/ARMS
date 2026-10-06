import type { AppRole } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/messages";
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
  Tags,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  roles: AppRole[];
};

/** Branch account tabs only */
const BRANCH_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ["branch", "branch_employee"] },
  { href: "/service-requests/new", labelKey: "nav.newRequest", icon: FilePlus2, roles: ["branch", "branch_employee"] },
  { href: "/branch/receiving", labelKey: "nav.branchReceiving", icon: PackageCheck, roles: ["branch", "branch_employee"] },
  { href: "/branch/shipping", labelKey: "nav.branchShipping", icon: Truck, roles: ["branch", "branch_employee"] },
  { href: "/scan", labelKey: "nav.scan", icon: QrCode, roles: ["branch", "branch_employee"] },
  { href: "/reports", labelKey: "nav.reports", icon: ClipboardList, roles: ["branch", "branch_employee"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["branch", "branch_employee"] },
];

/** Technician account tabs only */
const TECHNICIAN_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ["technician", "mobile_technician"] },
  { href: "/scan", labelKey: "nav.scan", icon: QrCode, roles: ["technician", "mobile_technician"] },
  { href: "/technician/work", labelKey: "nav.technicianWork", icon: Wrench, roles: ["technician", "mobile_technician"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["technician", "mobile_technician"] },
];

/** Admin / managers / supervisors */
const ADMIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/service-requests",
    labelKey: "nav.serviceRequests",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/devices",
    labelKey: "nav.devices",
    icon: Cpu,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/customers",
    labelKey: "nav.customers",
    icon: Users,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/branches",
    labelKey: "nav.branches",
    icon: Store,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/maintenance/shipping",
    labelKey: "nav.maintenanceShipping",
    icon: Truck,
    roles: [
      "maintenance_manager",
      "maintenance_supervisor",
      "system_admin",
      "manager",
      "supervisor",
    ],
  },
  {
    href: "/admin/catalog",
    labelKey: "nav.catalog",
    icon: Tags,
    roles: ["system_admin", "manager"],
  },
  {
    href: "/admin/users",
    labelKey: "nav.users",
    icon: Users,
    roles: ["system_admin", "manager"],
  },
  {
    href: "/admin/branches",
    labelKey: "nav.adminBranches",
    icon: Store,
    roles: ["system_admin", "manager"],
  },
  {
    href: "/spare-parts",
    labelKey: "nav.spareParts",
    icon: Package,
    roles: ["system_admin", "manager", "maintenance_manager"],
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
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
