import {
  listAllRequestDevices,
  normalizeLifecycleStatus,
  updateDevicesLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { isDemoMode, normalizeRole } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { pushAppPickupReceipts } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listManagedUsers } from "@/lib/users-store";
import type {
  AppRole,
  PickupReceipt,
  PickupReceiptDirection,
  PickupReceiptLine,
  PickupReceiptStatus,
  Profile,
  ShippingBatch,
} from "@/types/domain";

const RECEIPTS_KEY = "arms_pickup_receipts_v1";
const SHIPPING_BATCHES_KEY = "arms_shipping_batches_v1";

function normalizeDeviceCodeKey(code: string | null | undefined) {
  return (code ?? "")
    .trim()
    .toUpperCase()
    .replace(/O/g, "0");
}

export const PICKUP_RECEIPT_STATUS_LABELS: Record<PickupReceiptStatus, string> = {
  draft: "مسودة",
  pending_courier: "بانتظار المندوب",
  partially_rejected: "مرفوض جزئياً — يحتاج تعديل",
  approved: "معتمد لدى المندوب",
  pending_supervisor: "بانتظار اعتماد التسليم للصيانة",
  received_at_center: "تم التسليم لمركز الصيانة",
  received_at_branch: "تم الاستلام في الفرع",
  cancelled: "ملغى",
};

export const PICKUP_RECEIPT_DIRECTION_LABELS: Record<PickupReceiptDirection, string> = {
  branch_to_center: "من الفرع إلى مركز الصيانة",
  center_to_branch: "من مركز الصيانة إلى الفرع",
};

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

function schedulePersist(receipts: PickupReceipt[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppPickupReceipts(receipts);
}

function readAll(): PickupReceipt[] {
  return readJson<PickupReceipt[]>(RECEIPTS_KEY, []);
}

function writeAll(receipts: PickupReceipt[]) {
  writeJson(RECEIPTS_KEY, receipts);
  schedulePersist(receipts);
}

export function listPickupReceiptsLocal(): PickupReceipt[] {
  return readAll();
}

export function replacePickupReceipts(receipts: PickupReceipt[]) {
  if (typeof window === "undefined") return;
  writeJson(RECEIPTS_KEY, receipts);
}

export function applyRemotePickupReceipts(receipts: PickupReceipt[]) {
  replacePickupReceipts(receipts);
}

export function listPickupReceipts(options?: {
  opsBranchId?: string | null;
  courierId?: string | null;
  statuses?: PickupReceiptStatus[];
  direction?: PickupReceiptDirection;
}): PickupReceipt[] {
  let all = readAll().filter((r) => r.status !== "cancelled");
  if (options?.opsBranchId) {
    all = all.filter((r) => r.opsBranchId === options.opsBranchId);
  }
  if (options?.courierId) {
    all = all.filter((r) => r.assignedCourierId === options.courierId);
  }
  if (options?.statuses?.length) {
    const set = new Set(options.statuses);
    all = all.filter((r) => set.has(r.status));
  }
  if (options?.direction) {
    all = all.filter((r) => r.direction === options.direction);
  }
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPickupReceipt(id: string) {
  return readAll().find((r) => r.id === id) ?? null;
}

/** Active (non-terminal) receipt line device ids — reserved / in courier custody. */
function openReceiptLineDeviceIds(excludeReceiptId?: string): Set<string> {
  const openStatuses: PickupReceiptStatus[] = [
    "draft",
    "pending_courier",
    "partially_rejected",
    "approved",
    "pending_supervisor",
  ];
  const ids = new Set<string>();
  for (const receipt of readAll()) {
    if (receipt.id === excludeReceiptId) continue;
    if (!openStatuses.includes(receipt.status)) continue;
    for (const line of receipt.lines) {
      if (line.status === "rejected") continue;
      ids.add(line.deviceLocalId);
    }
  }
  return ids;
}

function deviceOnOpenShippingBatch(deviceLocalId: string, deviceCode: string): boolean {
  const codeKey = normalizeDeviceCodeKey(deviceCode);
  const batches = readJson<ShippingBatch[]>(SHIPPING_BATCHES_KEY, []);
  return batches.some(
    (batch) =>
      batch.status !== "cancelled" &&
      batch.status !== "received" &&
      batch.items.some(
        (item) =>
          item.status === "active" &&
          (item.requestDeviceId === deviceLocalId ||
            normalizeDeviceCodeKey(item.deviceCode) === codeKey),
      ),
  );
}

/** True when device is covered by an open carrier waybill. */
export function deviceHasOpenShippingWaybill(deviceLocalId: string, deviceCode: string) {
  return deviceOnOpenShippingBatch(deviceLocalId, deviceCode);
}

export function deviceOnOpenPickupReceipt(deviceLocalId: string, excludeReceiptId?: string) {
  return openReceiptLineDeviceIds(excludeReceiptId).has(deviceLocalId);
}

/** Couriers (and technicians for return carrying). */
export function listPickupCouriers(options?: { includeTechnicians?: boolean }) {
  return listManagedUsers().filter((user) => {
    if (!user.isActive || user.isArchived) return false;
    const role = normalizeRole(user.role);
    if (role === "pickup_courier") return true;
    if (options?.includeTechnicians && (role === "technician" || role === "mobile_technician")) {
      return true;
    }
    return false;
  });
}

export function listDevicesEligibleForPickupOutbound(
  opsBranchId: string,
  excludeReceiptId?: string,
): TechnicianQueueItem[] {
  const reserved = openReceiptLineDeviceIds(excludeReceiptId);
  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (reserved.has(device.localId)) return false;
    if (deviceOnOpenShippingBatch(device.localId, device.deviceCode)) return false;
    const status = normalizeLifecycleStatus(device.lifecycleStatus);
    return (
      status === "received_at_branch" ||
      status === "excluded_from_shipment" ||
      status === "maintenance_failed"
    );
  });
}

export function listDevicesEligibleForPickupReturn(
  opsBranchId: string,
  excludeReceiptId?: string,
): TechnicianQueueItem[] {
  const reserved = openReceiptLineDeviceIds(excludeReceiptId);
  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (reserved.has(device.localId)) return false;
    if (deviceOnOpenShippingBatch(device.localId, device.deviceCode)) return false;
    return normalizeLifecycleStatus(device.lifecycleStatus) === "ready_to_return";
  });
}

function canCreateReceipt(user: Profile, direction: PickupReceiptDirection) {
  if (hasPermission(user, "create_pickup_receipt")) return true;
  const role = normalizeRole(user.role);
  if (direction === "branch_to_center" && role === "branch") return true;
  if (
    direction === "center_to_branch" &&
    (role === "maintenance_manager" ||
      role === "maintenance_supervisor" ||
      role === "system_admin" ||
      role === "technician")
  ) {
    return true;
  }
  return false;
}

export function createPickupReceipt(input: {
  user: Profile;
  direction: PickupReceiptDirection;
  opsBranchId: string;
  opsBranchName: string;
  assignedCourierId: string;
  assignedCourierName: string;
  assignedCarrierRole?: AppRole | string | null;
  deviceLocalIds: string[];
  notes?: string;
  submit?: boolean;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  if (!canCreateReceipt(input.user, input.direction)) {
    return { ok: false, error: "ليس لديك صلاحية إنشاء نموذج استلام." };
  }
  if (!input.assignedCourierId.trim()) {
    return { ok: false, error: "اختر مندوب الاستلام." };
  }
  if (!input.deviceLocalIds.length) {
    return { ok: false, error: "اختر جهازًا واحدًا على الأقل." };
  }

  const role = normalizeRole(input.user.role);
  if (role === "branch" && input.user.opsBranchId && input.opsBranchId !== input.user.opsBranchId) {
    return { ok: false, error: "يمكنك إنشاء نموذج لفرعك فقط." };
  }

  const eligible =
    input.direction === "branch_to_center"
      ? listDevicesEligibleForPickupOutbound(input.opsBranchId)
      : listDevicesEligibleForPickupReturn(input.opsBranchId);

  const selected = eligible.filter((item) => input.deviceLocalIds.includes(item.device.localId));
  if (selected.length !== input.deviceLocalIds.length) {
    return {
      ok: false,
      error: "أحد الأجهزة غير متاح (مرتبط ببوليصة شحن أو نموذج استلام آخر).",
    };
  }

  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900000 + 100000);
  const now = new Date().toISOString();
  const submit = input.submit !== false;

  const lines: PickupReceiptLine[] = selected.map(({ device, request }) => ({
    id: crypto.randomUUID(),
    deviceLocalId: device.localId,
    deviceCode: device.deviceCode,
    modelName: device.modelName,
    color: device.color ?? "",
    requestId: request.id,
    requestNumber: request.requestNumber,
    status: "included",
    rejectReason: null,
  }));

  const receipt: PickupReceipt = {
    id: crypto.randomUUID(),
    receiptNumber: `PR-${year}-${seq}`,
    direction: input.direction,
    opsBranchId: input.opsBranchId,
    opsBranchName: input.opsBranchName,
    createdBy: input.user.id,
    createdByName: input.user.fullName,
    assignedCourierId: input.assignedCourierId,
    assignedCourierName: input.assignedCourierName,
    assignedCarrierRole: input.assignedCarrierRole ?? "pickup_courier",
    status: submit ? "pending_courier" : "draft",
    createdAt: now,
    submittedAt: submit ? now : null,
    notes: input.notes?.trim() || undefined,
    lines,
  };

  writeAll([receipt, ...readAll()]);
  return { ok: true, receipt };
}

/** Branch re-submits after partial reject: replace lines / courier and send again. */
export function resubmitPickupReceipt(input: {
  user: Profile;
  receiptId: string;
  assignedCourierId: string;
  assignedCourierName: string;
  assignedCarrierRole?: AppRole | string | null;
  deviceLocalIds: string[];
  notes?: string;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const existing = all[idx]!;

  if (existing.status !== "partially_rejected" && existing.status !== "draft") {
    return { ok: false, error: "لا يمكن تعديل هذا النموذج في حالته الحالية." };
  }
  if (!canCreateReceipt(input.user, existing.direction)) {
    return { ok: false, error: "ليس لديك صلاحية تعديل نموذج الاستلام." };
  }
  if (!input.deviceLocalIds.length) {
    return { ok: false, error: "اختر جهازًا واحدًا على الأقل." };
  }

  const eligible =
    existing.direction === "branch_to_center"
      ? listDevicesEligibleForPickupOutbound(existing.opsBranchId, existing.id)
      : listDevicesEligibleForPickupReturn(existing.opsBranchId, existing.id);

  // Keep previously non-rejected lines that are still selected even if locked conceptually
  const eligibleIds = new Set(eligible.map((e) => e.device.localId));
  const previousOk = existing.lines.filter(
    (line) =>
      line.status !== "rejected" && input.deviceLocalIds.includes(line.deviceLocalId),
  );
  for (const line of previousOk) eligibleIds.add(line.deviceLocalId);

  const missing = input.deviceLocalIds.filter((id) => !eligibleIds.has(id));
  if (missing.length) {
    return { ok: false, error: "أحد الأجهزة غير متاح لإعادة الإرسال." };
  }

  const byLocal = new Map(
    listAllRequestDevices().map((row) => [row.device.localId, row] as const),
  );
  const now = new Date().toISOString();
  const lines: PickupReceiptLine[] = input.deviceLocalIds.map((localId) => {
    const prev = existing.lines.find((l) => l.deviceLocalId === localId);
    const row = byLocal.get(localId);
    return {
      id: prev?.id ?? crypto.randomUUID(),
      deviceLocalId: localId,
      deviceCode: row?.device.deviceCode ?? prev?.deviceCode ?? "",
      modelName: row?.device.modelName ?? prev?.modelName ?? "",
      color: row?.device.color ?? prev?.color ?? "",
      requestId: row?.request.id ?? prev?.requestId ?? "",
      requestNumber: row?.request.requestNumber ?? prev?.requestNumber ?? "",
      status: "included" as const,
      rejectReason: null,
    };
  });

  const updated: PickupReceipt = {
    ...existing,
    assignedCourierId: input.assignedCourierId,
    assignedCourierName: input.assignedCourierName,
    assignedCarrierRole: input.assignedCarrierRole ?? existing.assignedCarrierRole,
    status: "pending_courier",
    submittedAt: now,
    courierReviewedAt: null,
    courierReviewedBy: null,
    courierReviewedByName: null,
    notes: input.notes?.trim() || existing.notes,
    lines,
  };

  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}

export function courierReviewPickupReceipt(input: {
  user: Profile;
  receiptId: string;
  /** Line ids to reject; empty = full approve */
  rejectLineIds?: string[];
  rejectReasons?: Record<string, string>;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const role = normalizeRole(input.user.role);
  const canReview =
    hasPermission(input.user, "review_pickup_receipt") ||
    role === "pickup_courier" ||
    role === "technician" ||
    role === "mobile_technician";
  if (!canReview) {
    return { ok: false, error: "ليس لديك صلاحية مراجعة نموذج الاستلام." };
  }

  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const receipt = all[idx]!;

  if (receipt.status !== "pending_courier") {
    return { ok: false, error: "النموذج ليس بانتظار مراجعة المندوب." };
  }
  if (
    receipt.assignedCourierId !== input.user.id &&
    role === "pickup_courier"
  ) {
    return { ok: false, error: "هذا النموذج مسند لمندوب آخر." };
  }

  const rejectIds = new Set((input.rejectLineIds ?? []).filter(Boolean));
  const included = receipt.lines.filter((l) => l.status !== "rejected");
  if (rejectIds.size > 0 && rejectIds.size >= included.length) {
    return {
      ok: false,
      error: "لا يمكن رفض كل الأجهزة — استخدم الرفض الجزئي أو اطلب إلغاء النموذج من الفرع.",
    };
  }

  const now = new Date().toISOString();

  if (rejectIds.size === 0) {
    // Full approve
    const lines = receipt.lines.map((line) =>
      line.status === "rejected"
        ? line
        : { ...line, status: "approved" as const, rejectReason: null },
    );
    const approvedLines = lines.filter((l) => l.status === "approved");

    const lifecyclePatches = approvedLines
      .map((line) => {
        const match = listAllRequestDevices().find(
          (row) => row.device.localId === line.deviceLocalId,
        );
        if (!match) return null;
        if (receipt.direction === "branch_to_center") {
          return {
            requestId: match.request.id,
            deviceLocalId: line.deviceLocalId,
            patch: {
              lifecycleStatus: "in_transit_to_service" as const,
              currentLocation: "with_courier",
              lockedAfterShip: true,
              assignmentPath: "service_center" as const,
              assignedTechnicianId: null,
              assignedTechnicianName: null,
            },
          };
        }
        return {
          requestId: match.request.id,
          deviceLocalId: line.deviceLocalId,
          patch: {
            lifecycleStatus: "in_return_transit" as const,
            currentLocation: "with_courier",
            lockedAfterShip: true,
            assignedTechnicianId: null,
            assignedTechnicianName: null,
          },
        };
      })
      .filter(Boolean) as Array<{
      requestId: string;
      deviceLocalId: string;
      patch: Parameters<typeof updateDevicesLifecycle>[0][number]["patch"];
    }>;

    updateDevicesLifecycle(lifecyclePatches);

    const updated: PickupReceipt = {
      ...receipt,
      status: "approved",
      courierReviewedAt: now,
      courierReviewedBy: input.user.id,
      courierReviewedByName: input.user.fullName,
      lines,
    };
    all[idx] = updated;
    writeAll(all);
    return { ok: true, receipt: updated };
  }

  // Partial reject
  const lines = receipt.lines.map((line) => {
    if (rejectIds.has(line.id)) {
      return {
        ...line,
        status: "rejected" as const,
        rejectReason: (input.rejectReasons?.[line.id] ?? "").trim() || null,
      };
    }
    if (line.status === "rejected") return line;
    return { ...line, status: "included" as const };
  });

  const updated: PickupReceipt = {
    ...receipt,
    status: "partially_rejected",
    courierReviewedAt: now,
    courierReviewedBy: input.user.id,
    courierReviewedByName: input.user.fullName,
    lines,
  };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}

/** Devices held by courier awaiting center handover (outbound approved). */
export function listCourierHeldForHandover(): PickupReceipt[] {
  return listPickupReceipts({
    direction: "branch_to_center",
    statuses: ["approved"],
  });
}

export function listPendingSupervisorHandovers(): PickupReceipt[] {
  return listPickupReceipts({
    direction: "branch_to_center",
    statuses: ["pending_supervisor"],
  });
}

export function listApprovedReturnReceiptsForBranch(opsBranchId: string): PickupReceipt[] {
  return listPickupReceipts({
    opsBranchId,
    direction: "center_to_branch",
    statuses: ["approved"],
  });
}

export function requestCourierHandoverToMaintenance(input: {
  user: Profile;
  receiptId: string;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const can =
    hasPermission(input.user, "request_courier_handover") ||
    normalizeRole(input.user.role) === "technician";
  if (!can) {
    return { ok: false, error: "ليس لديك صلاحية طلب التسليم للصيانة." };
  }

  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const receipt = all[idx]!;

  if (receipt.direction !== "branch_to_center" || receipt.status !== "approved") {
    return { ok: false, error: "لا يمكن طلب التسليم إلا لنماذج معتمدة لدى المندوب (إرسال)." };
  }

  const now = new Date().toISOString();
  const updated: PickupReceipt = {
    ...receipt,
    status: "pending_supervisor",
    handoverRequestedAt: now,
    handoverRequestedBy: input.user.id,
    handoverRequestedByName: input.user.fullName,
  };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}

export function approveCourierHandoverToMaintenance(input: {
  user: Profile;
  receiptId: string;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const role = normalizeRole(input.user.role);
  const can =
    hasPermission(input.user, "approve_courier_handover") ||
    role === "maintenance_supervisor" ||
    role === "maintenance_manager" ||
    role === "system_admin";
  if (!can) {
    return { ok: false, error: "اعتماد التسليم للصيانة يتطلب مشرف/مدير صيانة." };
  }

  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const receipt = all[idx]!;

  if (receipt.status !== "pending_supervisor") {
    return { ok: false, error: "النموذج ليس بانتظار اعتماد المشرف." };
  }

  const approvedLines = receipt.lines.filter((l) => l.status === "approved");
  const patches = approvedLines
    .map((line) => {
      const match = listAllRequestDevices().find(
        (row) => row.device.localId === line.deviceLocalId,
      );
      if (!match) return null;
      return {
        requestId: match.request.id,
        deviceLocalId: line.deviceLocalId,
        patch: {
          lifecycleStatus: "awaiting_maintenance" as const,
          currentLocation: "service_center",
          lockedAfterShip: false,
        },
      };
    })
    .filter(Boolean) as Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Parameters<typeof updateDevicesLifecycle>[0][number]["patch"];
  }>;

  updateDevicesLifecycle(patches);

  const now = new Date().toISOString();
  const updated: PickupReceipt = {
    ...receipt,
    status: "received_at_center",
    handoverApprovedAt: now,
    handoverApprovedBy: input.user.id,
    handoverApprovedByName: input.user.fullName,
  };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}

/** Branch confirms devices returned via courier. */
export function confirmPickupReturnAtBranch(input: {
  user: Profile;
  receiptId: string;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const role = normalizeRole(input.user.role);
  if (role !== "branch" && !hasPermission(input.user, "receive_return_from_service")) {
    return { ok: false, error: "استلام المرتجع عبر المندوب لحساب الفرع فقط." };
  }

  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const receipt = all[idx]!;

  if (receipt.direction !== "center_to_branch" || receipt.status !== "approved") {
    return { ok: false, error: "لا يمكن تأكيد الاستلام إلا لنماذج إرجاع معتمدة لدى المندوب." };
  }
  if (input.user.opsBranchId && receipt.opsBranchId !== input.user.opsBranchId) {
    return { ok: false, error: "هذا النموذج يخص فرعًا آخر." };
  }

  const approvedLines = receipt.lines.filter((l) => l.status === "approved");
  const patches = approvedLines
    .map((line) => {
      const match = listAllRequestDevices().find(
        (row) => row.device.localId === line.deviceLocalId,
      );
      if (!match) return null;
      return {
        requestId: match.request.id,
        deviceLocalId: line.deviceLocalId,
        patch: {
          lifecycleStatus: "awaiting_customer" as const,
          currentLocation: "branch",
          lockedAfterShip: false,
        },
      };
    })
    .filter(Boolean) as Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Parameters<typeof updateDevicesLifecycle>[0][number]["patch"];
  }>;

  updateDevicesLifecycle(patches);

  const now = new Date().toISOString();
  const updated: PickupReceipt = {
    ...receipt,
    status: "received_at_branch",
    branchReceivedAt: now,
    branchReceivedBy: input.user.id,
    branchReceivedByName: input.user.fullName,
  };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}

export function cancelPickupReceipt(input: {
  user: Profile;
  receiptId: string;
}): { ok: true; receipt: PickupReceipt } | { ok: false; error: string } {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === input.receiptId);
  if (idx < 0) return { ok: false, error: "نموذج الاستلام غير موجود." };
  const receipt = all[idx]!;

  if (
    receipt.status !== "draft" &&
    receipt.status !== "pending_courier" &&
    receipt.status !== "partially_rejected"
  ) {
    return { ok: false, error: "لا يمكن إلغاء نموذج بعد اعتماد المندوب." };
  }

  const updated: PickupReceipt = { ...receipt, status: "cancelled" };
  all[idx] = updated;
  writeAll(all);
  return { ok: true, receipt: updated };
}
