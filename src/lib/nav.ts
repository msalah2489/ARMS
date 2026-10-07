import type { AppRole, Profile } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/messages";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
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
  /** When set, item is shown only if user has this permission (or any of them). */
  permission?: PermissionKey | PermissionKey[];
};

/** Branch account tabs only */
const BRANCH_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["branch", "branch_employee"],
    permission: "login",
  },
  {
    href: "/service-requests/new",
    labelKey: "nav.newRequest",
    icon: FilePlus2,
    roles: ["branch", "branch_employee"],
    permission: "create_edit_request",
  },
  {
    href: "/branch/receiving",
    labelKey: "nav.branchReceiving",
    icon: PackageCheck,
    roles: ["branch", "branch_employee"],
    permission: ["receive_from_customer", "receive_return_from_service", "deliver_to_customer"],
  },
  {
    href: "/branch/shipping",
    labelKey: "nav.branchShipping",
    icon: Truck,
    roles: ["branch", "branch_employee"],
    permission: "branch_shipping",
  },
  {
    href: "/scan",
    labelKey: "nav.scan",
    icon: QrCode,
    roles: ["branch", "branch_employee"],
    permission: "login",
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    icon: ClipboardList,
    roles: ["branch", "branch_employee"],
    permission: "view_reports",
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["branch", "branch_employee"],
    permission: "edit_own_profile",
  },
];

/** Technician account tabs only */
const TECHNICIAN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["technician", "mobile_technician"],
    permission: "login",
  },
  {
    href: "/scan",
    labelKey: "nav.scan",
    icon: QrCode,
    roles: ["technician", "mobile_technician"],
    permission: "login",
  },
  {
    href: "/technician/work",
    labelKey: "nav.technicianWork",
    icon: Wrench,
    roles: ["technician", "mobile_technician"],
    permission: "view_work_queue",
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["technician", "mobile_technician"],
    permission: "edit_own_profile",
  },
];

/** Admin / managers / supervisors */
const ADMIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "login",
  },
  {
    href: "/service-requests",
    labelKey: "nav.serviceRequests",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "view_requests",
  },
  {
    href: "/devices",
    labelKey: "nav.devices",
    icon: Cpu,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "view_devices",
  },
  {
    href: "/customers",
    labelKey: "nav.customers",
    icon: Users,
    roles: ["system_admin", "manager", "maintenance_manager"],
    permission: "view_requests",
  },
  {
    href: "/branches",
    labelKey: "nav.branches",
    icon: Store,
    roles: ["system_admin", "manager", "maintenance_manager"],
    permission: "view_requests",
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
    permission: ["receive_inbound_waybill", "create_return_waybill", "manager_decisions"],
  },
  {
    href: "/admin/catalog",
    labelKey: "nav.catalog",
    icon: Tags,
    roles: ["system_admin", "manager"],
    permission: "manage_catalog",
  },
  {
    href: "/admin/users",
    labelKey: "nav.users",
    icon: Users,
    roles: ["system_admin", "manager"],
    permission: "manage_users",
  },
  {
    href: "/admin/branches",
    labelKey: "nav.adminBranches",
    icon: Store,
    roles: ["system_admin", "manager"],
    permission: "manage_branches",
  },
  {
    href: "/spare-parts",
    labelKey: "nav.spareParts",
    icon: Package,
    roles: ["system_admin", "manager", "maintenance_manager"],
    permission: "view_inventory",
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    icon: ClipboardList,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "view_reports",
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["system_admin", "manager", "maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: ["edit_own_profile", "system_settings"],
  },
];

export const NAV_ITEMS: NavItem[] = [...BRANCH_NAV, ...TECHNICIAN_NAV, ...ADMIN_NAV];

function itemAllowedByPermission(
  item: NavItem,
  user: { role?: string; permissions?: string[] | null },
): boolean {
  if (!item.permission) return true;
  const keys = Array.isArray(item.permission) ? item.permission : [item.permission];
  return keys.some((key) => hasPermission(user, key));
}

/** Role-based nav (legacy). Prefer `navForUser` when a profile is available. */
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

/** Nav filtered by role lane + effective permissions. */
export function navForUser(user: Pick<Profile, "role" | "permissions">) {
  const base = navForRole(user.role);
  return base.filter((item) => itemAllowedByPermission(item, user));
}
