/**
 * أسباب الإرجاع / إعادة الفتح — طلب متابعة مرتبط أو إعادة فتح نفس الطلب.
 */
import {
  getMaintenanceRequestById,
  normalizeLifecycleStatus,
  replaceMaintenanceRequest,
  updateDevicesLifecycle,
} from "@/lib/branch-store";
import type {
  DeviceLifecycleStatus,
  DraftRequestDevice,
  MaintenanceRequestRecord,
  Profile,
  RequestLinkEvent,
  RequestReturnReason,
} from "@/types/domain";

export const REQUEST_RETURN_REASON_LABELS: Record<RequestReturnReason, string> = {
  repeat_fault: "تكرار العطل",
  new_fault: "عطل جديد",
  wrong_delivery: "تسليم خاطئ",
  customer_refusal: "رفض العميل",
  missing_part_or_approval: "نقص قطعة / موافقة",
  closed_by_mistake: "إغلاق بالخطأ",
  other: "أخرى",
};

export const REQUEST_RETURN_REASON_OPTIONS: RequestReturnReason[] = [
  "repeat_fault",
  "new_fault",
  "wrong_delivery",
  "customer_refusal",
  "missing_part_or_approval",
  "closed_by_mistake",
  "other",
];

export function requestReturnReasonLabel(reason: RequestReturnReason | null | undefined): string {
  if (!reason) return "—";
  return REQUEST_RETURN_REASON_LABELS[reason] ?? reason;
}

export function validateReturnReason(
  reason: RequestReturnReason | "" | null | undefined,
  note: string,
): string | null {
  if (!reason) return "يجب اختيار سبب الإرجاع / إعادة الفتح.";
  if (reason === "other" && !note.trim()) {
    return "الملاحظة إلزامية عند اختيار «أخرى».";
  }
  return null;
}

function deviceStatuses(request: MaintenanceRequestRecord): DeviceLifecycleStatus[] {
  return request.devices.map((device) => normalizeLifecycleStatus(device.lifecycleStatus));
}

/** الطلب منتهٍ بالكامل (تسليم أو إغلاق). */
export function isRequestTerminal(request: MaintenanceRequestRecord): boolean {
  const statuses = deviceStatuses(request);
  if (!statuses.length) return false;
  return statuses.every((status) => status === "delivered_to_customer" || status === "closed");
}

/** قبل التسليم النهائي للعميل (في الفرع أو في مسار الإرجاع). */
export function isBeforeFinalDelivery(request: MaintenanceRequestRecord): boolean {
  const statuses = deviceStatuses(request);
  if (!statuses.length) return false;
  if (statuses.some((status) => status === "delivered_to_customer")) return false;
  const preDelivery = new Set<DeviceLifecycleStatus>([
    "awaiting_customer",
    "ready_to_return",
    "ready_to_send",
    "in_return_transit",
    "closed",
  ]);
  return statuses.every((status) => preDelivery.has(status));
}

/** المسار الأساسي: إنشاء طلب متابعة بعد تسليم/إغلاق. */
export function canCreateFollowUpRequest(request: MaintenanceRequestRecord): boolean {
  return request.devices.some((device) => {
    const status = normalizeLifecycleStatus(device.lifecycleStatus);
    return status === "delivered_to_customer" || status === "closed";
  });
}

/** المسار الثانوي: إعادة فتح نفس الطلب (إغلاق بالخطأ أو قبل التسليم النهائي). */
export function canReopenRequest(request: MaintenanceRequestRecord): boolean {
  return isRequestTerminal(request) || isBeforeFinalDelivery(request);
}

export function listFollowUpRequests(
  parentRequestId: string,
  all: MaintenanceRequestRecord[],
): MaintenanceRequestRecord[] {
  return all.filter((item) => item.parentRequestId === parentRequestId);
}

function reopenPatchForDevice(
  request: MaintenanceRequestRecord,
  device: DraftRequestDevice,
): Partial<DraftRequestDevice> {
  const status = normalizeLifecycleStatus(device.lifecycleStatus);
  const mobile = request.assignmentPath === "mobile_technician";

  if (status === "delivered_to_customer" || status === "closed") {
    return {
      lifecycleStatus: "awaiting_customer",
      currentLocation: "branch",
      lockedAfterShip: false,
    };
  }

  if (
    status === "awaiting_customer" ||
    status === "ready_to_return" ||
    status === "ready_to_send" ||
    status === "in_return_transit"
  ) {
    if (mobile) {
      return {
        lifecycleStatus: "in_maintenance_at_branch",
        currentLocation: "branch",
        lockedAfterShip: false,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceStartedAt: null,
        maintenanceFinishedAt: null,
      };
    }
    return {
      lifecycleStatus: "awaiting_maintenance",
      currentLocation: "service_center",
      lockedAfterShip: false,
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      maintenanceStartedAt: null,
      maintenanceFinishedAt: null,
    };
  }

  return {};
}

export function reopenMaintenanceRequest(input: {
  user: Profile;
  requestId: string;
  reason: RequestReturnReason;
  note?: string;
}): { ok: true; request: MaintenanceRequestRecord } | { ok: false; error: string } {
  const note = (input.note || "").trim();
  const reasonError = validateReturnReason(input.reason, note);
  if (reasonError) return { ok: false, error: reasonError };

  const current = getMaintenanceRequestById(input.requestId);
  if (!current) return { ok: false, error: "طلب الصيانة غير موجود." };
  if (!canReopenRequest(current)) {
    return {
      ok: false,
      error: "إعادة الفتح متاحة فقط عند الإغلاق بالخطأ أو قبل التسليم النهائي للعميل.",
    };
  }

  const event: RequestLinkEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: "reopened",
    reason: input.reason,
    note: note || undefined,
    actorId: input.user.id,
    actorName: input.user.fullName,
  };

  const withEvent: MaintenanceRequestRecord = {
    ...current,
    linkReason: input.reason,
    linkNote: note || null,
    linkEvents: [...(current.linkEvents ?? []), event],
  };
  replaceMaintenanceRequest(withEvent);

  const updates = withEvent.devices
    .map((device) => {
      const patch = reopenPatchForDevice(withEvent, device);
      if (!Object.keys(patch).length) return null;
      return { requestId: withEvent.id, deviceLocalId: device.localId, patch };
    })
    .filter(Boolean) as Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Partial<DraftRequestDevice>;
  }>;

  if (updates.length) updateDevicesLifecycle(updates);

  const refreshed = getMaintenanceRequestById(input.requestId);
  if (!refreshed) return { ok: false, error: "تعذر تحديث الطلب بعد إعادة الفتح." };
  return { ok: true, request: refreshed };
}
