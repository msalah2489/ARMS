import type { AppRole, AssignableUserRole, ManagedUser, Profile } from "@/types/domain";
import { normalizeRole } from "@/lib/auth";

/** All toggleable permission keys (stable identifiers). */
export type PermissionKey =
  | "view_requests"
  | "create_edit_request"
  | "view_devices"
  | "assign_mobile_tech"
  | "create_ship_to_center"
  | "receive_from_customer"
  | "receive_return_from_service"
  | "deliver_to_customer"
  | "branch_shipping"
  | "create_pickup_receipt"
  | "review_pickup_receipt"
  | "request_courier_handover"
  | "approve_courier_handover"
  | "receive_inbound_waybill"
  | "create_return_waybill"
  | "manager_decisions"
  | "view_work_queue"
  | "run_maintenance"
  | "return_to_manager"
  | "deduct_spares"
  | "mobile_tech_branch"
  | "view_inventory"
  | "receive_spares"
  | "consume_spares"
  | "manage_catalog"
  | "manage_users"
  | "manage_permissions"
  | "manage_branches"
  | "view_reports"
  | "export_reports"
  | "system_settings"
  | "repair_shipping_status"
  | "login"
  | "edit_own_profile";

export type PermissionGroupId =
  | "requests_devices"
  | "branch"
  | "service_center"
  | "technician"
  | "inventory"
  | "admin"
  | "general";

export type PermissionGroup = {
  id: PermissionGroupId;
  labelAr: string;
  keys: PermissionKey[];
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_requests: "عرض الطلبات",
  create_edit_request: "إنشاء/تعديل طلب",
  view_devices: "عرض الأجهزة",
  assign_mobile_tech: "تعيين فني متنقل",
  create_ship_to_center: "إنشاء شحنة لمركز الصيانة",
  receive_from_customer: "استلام من العميل",
  receive_return_from_service: "استلام مرتجع من الصيانة",
  deliver_to_customer: "تسليم للعميل",
  branch_shipping: "شحن الفرع",
  create_pickup_receipt: "إنشاء نموذج استلام للمندوب",
  review_pickup_receipt: "مراجعة نموذج استلام (مندوب)",
  request_courier_handover: "طلب تسليم للصيانة من المندوب",
  approve_courier_handover: "اعتماد تسليم المندوب للصيانة",
  receive_inbound_waybill: "استلام بوليصة واردة",
  create_return_waybill: "إنشاء بوليصة إرجاع",
  manager_decisions: "قرارات المدير",
  view_work_queue: "عرض قائمة العمل",
  run_maintenance: "تنفيذ الصيانة",
  return_to_manager: "إعادة للمدير",
  deduct_spares: "خصم قطع الغيار",
  mobile_tech_branch: "فني متنقل / فرع",
  view_inventory: "عرض المخزون",
  receive_spares: "استلام قطع غيار",
  consume_spares: "استهلاك قطع غيار",
  manage_catalog: "إدارة الكتالوج",
  manage_users: "إدارة المستخدمين",
  manage_permissions: "إدارة الصلاحيات",
  manage_branches: "إدارة الفروع",
  view_reports: "عرض التقارير",
  export_reports: "تصدير التقارير",
  system_settings: "إعدادات النظام",
  repair_shipping_status: "إصلاح حالات الشحن غير المتسقة",
  login: "تسجيل الدخول",
  edit_own_profile: "تعديل الملف الشخصي",
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "requests_devices",
    labelAr: "الطلبات والأجهزة",
    keys: [
      "view_requests",
      "create_edit_request",
      "view_devices",
      "assign_mobile_tech",
      "create_ship_to_center",
    ],
  },
  {
    id: "branch",
    labelAr: "الفرع",
    keys: [
      "receive_from_customer",
      "receive_return_from_service",
      "deliver_to_customer",
      "branch_shipping",
      "create_pickup_receipt",
    ],
  },
  {
    id: "service_center",
    labelAr: "مركز الصيانة",
    keys: [
      "receive_inbound_waybill",
      "create_return_waybill",
      "manager_decisions",
      "approve_courier_handover",
    ],
  },
  {
    id: "technician",
    labelAr: "الفني",
    keys: [
      "view_work_queue",
      "run_maintenance",
      "return_to_manager",
      "deduct_spares",
      "mobile_tech_branch",
      "request_courier_handover",
      "review_pickup_receipt",
    ],
  },
  {
    id: "inventory",
    labelAr: "المخزون",
    keys: ["view_inventory", "receive_spares", "consume_spares", "manage_catalog"],
  },
  {
    id: "admin",
    labelAr: "الإدارة",
    keys: [
      "manage_users",
      "manage_permissions",
      "manage_branches",
      "view_reports",
      "export_reports",
      "system_settings",
      "repair_shipping_status",
    ],
  },
  {
    id: "general",
    labelAr: "عام",
    keys: ["login", "edit_own_profile"],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.keys);

/** Permissions a system_admin must keep on their own account. */
export const CRITICAL_SELF_ADMIN_PERMISSIONS: PermissionKey[] = [
  "login",
  "manage_users",
  "manage_permissions",
];

const GENERAL: PermissionKey[] = ["login", "edit_own_profile"];

function uniq(keys: PermissionKey[]): PermissionKey[] {
  return [...new Set(keys)];
}

/** Default permission set for each assignable role (template). */
export const ROLE_DEFAULT_PERMISSIONS: Record<AssignableUserRole, PermissionKey[]> = {
  system_admin: [...ALL_PERMISSION_KEYS],

  maintenance_manager: uniq([
    ...GENERAL,
    "view_requests",
    "create_edit_request",
    "view_devices",
    "assign_mobile_tech",
    "create_ship_to_center",
    "receive_inbound_waybill",
    "create_return_waybill",
    "manager_decisions",
    "approve_courier_handover",
    "create_pickup_receipt",
    "view_inventory",
    "receive_spares",
    "consume_spares",
    "view_reports",
    "export_reports",
    "repair_shipping_status",
  ]),

  maintenance_supervisor: uniq([
    ...GENERAL,
    "view_requests",
    "view_devices",
    "create_ship_to_center",
    "receive_inbound_waybill",
    "create_return_waybill",
    "approve_courier_handover",
    "create_pickup_receipt",
    "view_reports",
  ]),

  branch: uniq([
    ...GENERAL,
    "view_requests",
    "create_edit_request",
    "receive_from_customer",
    "receive_return_from_service",
    "deliver_to_customer",
    "branch_shipping",
    "create_pickup_receipt",
    "view_reports",
  ]),

  technician: uniq([
    ...GENERAL,
    "view_work_queue",
    "run_maintenance",
    "return_to_manager",
    "deduct_spares",
    "request_courier_handover",
    "review_pickup_receipt",
    "create_pickup_receipt",
  ]),

  mobile_technician: uniq([
    ...GENERAL,
    "view_work_queue",
    "run_maintenance",
    "return_to_manager",
    "deduct_spares",
    "mobile_tech_branch",
    "create_edit_request",
    "view_requests",
  ]),

  pickup_courier: uniq([
    ...GENERAL,
    "review_pickup_receipt",
    "view_devices",
    "view_requests",
  ]),
};

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && (ALL_PERMISSION_KEYS as string[]).includes(value);
}

export function getDefaultPermissionsForRole(role: AssignableUserRole | AppRole): PermissionKey[] {
  const normalized = normalizeRole(role);
  if (normalized in ROLE_DEFAULT_PERMISSIONS) {
    return [...ROLE_DEFAULT_PERMISSIONS[normalized as AssignableUserRole]];
  }
  return [...GENERAL];
}

export function normalizePermissions(
  permissions: unknown,
  role: AssignableUserRole | AppRole,
): PermissionKey[] {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return getDefaultPermissionsForRole(role);
  }
  const filtered = permissions.filter(isPermissionKey);
  if (filtered.length === 0) return getDefaultPermissionsForRole(role);
  return uniq(filtered);
}

export type PermissionBearer = {
  role?: AppRole | AssignableUserRole | string | null;
  permissions?: string[] | PermissionKey[] | null;
};

/**
 * Check whether a user/profile has a permission.
 * Falls back to role defaults when permissions are missing (legacy sessions).
 */
export function hasPermission(
  user: PermissionBearer | null | undefined,
  key: PermissionKey,
): boolean {
  if (!user) return false;
  const role = (user.role ? normalizeRole(String(user.role)) : "branch") as AppRole;
  const perms = normalizePermissions(user.permissions, role);
  return perms.includes(key);
}

export function hasAnyPermission(
  user: PermissionBearer | null | undefined,
  keys: PermissionKey[],
): boolean {
  return keys.some((key) => hasPermission(user, key));
}

/**
 * When a system_admin edits their own permissions, keep critical admin powers.
 */
export function protectSelfAdminPermissions(
  actor: { id: string; role: string } | null | undefined,
  targetUserId: string,
  targetRole: AssignableUserRole,
  permissions: PermissionKey[],
): PermissionKey[] {
  if (!actor) return permissions;
  if (actor.id !== targetUserId) return permissions;
  if (normalizeRole(actor.role) !== "system_admin") return permissions;
  if (targetRole !== "system_admin") {
    // Demoting self away from system_admin is also blocked for critical safety.
    return uniq([...permissions, ...CRITICAL_SELF_ADMIN_PERMISSIONS]);
  }
  return uniq([...permissions, ...CRITICAL_SELF_ADMIN_PERMISSIONS]);
}

/** True if actor may edit another user's permission toggles. */
export function canManagePermissions(actor: PermissionBearer | null | undefined): boolean {
  if (!actor) return false;
  if (normalizeRole(String(actor.role ?? "")) === "system_admin") {
    return hasPermission(actor, "manage_permissions");
  }
  return false;
}

export function permissionsEqual(a: PermissionKey[], b: PermissionKey[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((key) => setB.has(key));
}

export function userPermissions(user: ManagedUser | Profile): PermissionKey[] {
  return normalizePermissions(user.permissions, user.role);
}
