import type { AppRole, Profile } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/messages";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import {
  ClipboardList,
  ClipboardSignature,
  Cpu,
  Home,
  LayoutDashboard,
  Package,
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

/** Branch: عمل اليوم · طلباتي · أجهزتي · مسح · حسابي */
const BRANCH_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.workToday",
    icon: Home,
    roles: ["branch", "branch_employee"],
    permission: "login",
  },
  {
    href: "/service-requests",
    labelKey: "nav.myRequests",
    icon: ClipboardList,
    roles: ["branch", "branch_employee"],
    permission: "view_requests",
  },
  {
    href: "/devices",
    labelKey: "nav.myDevices",
    icon: Cpu,
    roles: ["branch", "branch_employee"],
    permission: "view_requests",
  },
  {
    href: "/scan",
    labelKey: "nav.scan",
    icon: QrCode,
    roles: ["branch", "branch_employee"],
    permission: "login",
  },
  {
    href: "/settings",
    labelKey: "nav.account",
    icon: Settings,
    roles: ["branch", "branch_employee"],
    permission: "edit_own_profile",
  },
];

/** Technician: طابور · عملي · تسليم مندوب · حسابي */
const TECHNICIAN_NAV: NavItem[] = [
  {
    href: "/technician/work",
    labelKey: "nav.techQueue",
    icon: Wrench,
    roles: ["technician", "mobile_technician"],
    permission: "view_work_queue",
  },
  {
    href: "/technician/work?focus=mine",
    labelKey: "nav.techMine",
    icon: Cpu,
    roles: ["technician", "mobile_technician"],
    permission: "view_work_queue",
  },
  {
    href: "/technician/courier-handover",
    labelKey: "nav.courierHandover",
    icon: ClipboardSignature,
    roles: ["technician", "mobile_technician"],
    permission: "request_courier_handover",
  },
  {
    href: "/settings",
    labelKey: "nav.account",
    icon: Settings,
    roles: ["technician", "mobile_technician"],
    permission: "edit_own_profile",
  },
];

/** Pickup courier: نماذج · حسابي */
const COURIER_NAV: NavItem[] = [
  {
    href: "/courier/receipts",
    labelKey: "nav.courierReceipts",
    icon: ClipboardSignature,
    roles: ["pickup_courier"],
    permission: "review_pickup_receipt",
  },
  {
    href: "/scan",
    labelKey: "nav.scan",
    icon: QrCode,
    roles: ["pickup_courier"],
    permission: "login",
  },
  {
    href: "/settings",
    labelKey: "nav.account",
    icon: Settings,
    roles: ["pickup_courier"],
    permission: "edit_own_profile",
  },
];

/** Maintenance manager / supervisor: لوحة · شحن · اعتماد مندوب · حسابي */
const MAINTENANCE_HUB_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.decisionBoard",
    icon: LayoutDashboard,
    roles: ["maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "login",
  },
  {
    href: "/maintenance/shipping",
    labelKey: "nav.shippingShort",
    icon: Truck,
    roles: ["maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: [
      "receive_inbound_waybill",
      "create_return_waybill",
      "manager_decisions",
      "approve_courier_handover",
      "create_pickup_receipt",
    ],
  },
  {
    href: "/maintenance/courier-handover",
    labelKey: "nav.courierHandoverApprove",
    icon: ClipboardSignature,
    roles: ["maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: ["approve_courier_handover", "create_pickup_receipt"],
  },
  {
    href: "/settings",
    labelKey: "nav.account",
    icon: Settings,
    roles: ["maintenance_manager", "maintenance_supervisor", "supervisor"],
    permission: "edit_own_profile",
  },
];

/** System admin / legacy manager — full ops nav */
const ADMIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin", "manager"],
    permission: "login",
  },
  {
    href: "/service-requests",
    labelKey: "nav.serviceRequests",
    icon: ClipboardList,
    roles: ["system_admin", "manager"],
    permission: "view_requests",
  },
  {
    href: "/devices",
    labelKey: "nav.devices",
    icon: Cpu,
    roles: ["system_admin", "manager"],
    permission: "view_devices",
  },
  {
    href: "/scan",
    labelKey: "nav.scan",
    icon: QrCode,
    roles: ["system_admin", "manager"],
    permission: "view_devices",
  },
  {
    href: "/customers",
    labelKey: "nav.customers",
    icon: Users,
    roles: ["system_admin", "manager"],
    permission: "view_requests",
  },
  {
    href: "/branches",
    labelKey: "nav.branches",
    icon: Store,
    roles: ["system_admin", "manager"],
    permission: "view_requests",
  },
  {
    href: "/maintenance/shipping",
    labelKey: "nav.maintenanceShipping",
    icon: Truck,
    roles: ["system_admin", "manager"],
    permission: [
      "receive_inbound_waybill",
      "create_return_waybill",
      "manager_decisions",
      "approve_courier_handover",
      "create_pickup_receipt",
    ],
  },
  {
    href: "/maintenance/courier-handover",
    labelKey: "nav.courierHandoverApprove",
    icon: ClipboardSignature,
    roles: ["system_admin", "manager"],
    permission: ["approve_courier_handover", "create_pickup_receipt"],
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
    href: "/admin/shipping-repair",
    labelKey: "nav.shippingRepair",
    icon: Truck,
    roles: ["system_admin", "manager"],
    permission: "login",
  },
  {
    href: "/spare-parts",
    labelKey: "nav.spareParts",
    icon: Package,
    roles: ["system_admin", "manager"],
    permission: "view_inventory",
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    icon: ClipboardList,
    roles: ["system_admin", "manager"],
    permission: "view_reports",
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["system_admin", "manager"],
    permission: ["edit_own_profile", "system_settings"],
  },
];

export const NAV_ITEMS: NavItem[] = [
  ...BRANCH_NAV,
  ...TECHNICIAN_NAV,
  ...COURIER_NAV,
  ...MAINTENANCE_HUB_NAV,
  ...ADMIN_NAV,
];

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

  if (normalized === "pickup_courier") {
    return COURIER_NAV;
  }

  if (
    normalized === "maintenance_manager" ||
    normalized === "maintenance_supervisor" ||
    normalized === "supervisor"
  ) {
    return MAINTENANCE_HUB_NAV;
  }

  return ADMIN_NAV.filter((item) => item.roles.includes(role) || item.roles.includes(normalized));
}

/** Nav filtered by role lane + effective permissions. */
export function navForUser(user: Pick<Profile, "role" | "permissions">) {
  const base = navForRole(user.role);
  return base.filter((item) => itemAllowedByPermission(item, user));
}

/** Whether a nav href is active for the current location (supports ?query on href). */
export function isNavHrefActive(pathname: string, search: string, href: string): boolean {
  const path = pathname || "";
  const q = search.startsWith("?") ? search.slice(1) : search;
  const [hrefPath, hrefQuery = ""] = href.split("?");
  const pathMatches = path === hrefPath || path.startsWith(`${hrefPath}/`);
  if (!pathMatches) return false;

  if (hrefQuery) {
    const params = new URLSearchParams(q);
    const wanted = new URLSearchParams(hrefQuery);
    for (const [key, value] of wanted.entries()) {
      if (params.get(key) !== value) return false;
    }
    return true;
  }

  // Path-only item: inactive when another sibling uses the same path with a focus query
  // that is currently set (e.g. /technician/work vs ?focus=mine).
  if (hrefPath === "/technician/work") {
    const focus = new URLSearchParams(q).get("focus");
    if (focus === "mine") return false;
  }

  return true;
}

/** Roles that use the mobile bottom tab bar (cycle prototype UX). */
export function usesRoleBottomNav(role: AppRole): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === "branch" ||
    normalized === "technician" ||
    normalized === "mobile_technician" ||
    normalized === "pickup_courier" ||
    normalized === "maintenance_manager" ||
    normalized === "maintenance_supervisor" ||
    normalized === "supervisor"
  );
}
