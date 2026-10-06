import {
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
  repairStaleTechnicianAssignments,
  updateDeviceLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { isDemoMode } from "@/lib/auth";
import { consumeSpareParts } from "@/lib/spare-inventory-store";
import { pushAppTechnicianWork } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { HOLD_REASON_LABELS } from "@/lib/technician-catalog";
import type {
  ManagerDeviceDecision,
  Profile,
  TechnicianWorkRecord,
} from "@/types/domain";

const WORK_KEY = "arms_technician_work_v1";

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

function schedulePersist(work: TechnicianWorkRecord[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppTechnicianWork(work);
}

export function listTechnicianWorkLocal(): TechnicianWorkRecord[] {
  return readJson<TechnicianWorkRecord[]>(WORK_KEY, []);
}

export function replaceTechnicianWork(work: TechnicianWorkRecord[]) {
  if (typeof window === "undefined") return;
  writeJson(WORK_KEY, work);
}

export function applyRemoteTechnicianWork(work: TechnicianWorkRecord[]) {
  replaceTechnicianWork(work);
}

export function listTechnicianWork() {
  return listTechnicianWorkLocal();
}

/** Free devices stuck in maintenance after a hold/complete that left a stale assignment. */
function repairOrphanedMaintenanceDevices() {
  const work = listTechnicianWork();
  for (const item of listAllRequestDevices()) {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "in_maintenance") continue;

    const hasOpen = work.some(
      (record) =>
        record.deviceLocalId === item.device.localId &&
        record.requestId === item.request.id &&
        record.status === "in_progress",
    );
    if (hasOpen) continue;

    const held = work.find(
      (record) =>
        record.deviceLocalId === item.device.localId &&
        record.requestId === item.request.id &&
        record.status === "held",
    );

    updateDeviceLifecycle(item.request.id, item.device.localId, {
      lifecycleStatus: held ? "awaiting_manager_decision" : "awaiting_maintenance",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
    });
  }
}

export function getSortedAwaitingDevices(): TechnicianQueueItem[] {
  repairStaleTechnicianAssignments();
  repairOrphanedMaintenanceDevices();

  const awaiting = listAllRequestDevices().filter((item) => {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "awaiting_maintenance") {
      // Recover devices already at the service center with a mismatched status.
      if (
        (item.device.currentLocation ?? "").trim() === "service_center" &&
        status === "in_transit_to_service"
      ) {
        updateDeviceLifecycle(item.request.id, item.device.localId, {
          lifecycleStatus: "awaiting_maintenance",
          currentLocation: "service_center",
          assignedTechnicianId: null,
          assignedTechnicianName: null,
        });
        return true;
      }
      return false;
    }
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    if (!assigned) return true;
    // Assigned but still "ready" means stale claim — free it.
    const openWork = listTechnicianWork().some(
      (work) =>
        work.deviceLocalId === item.device.localId &&
        work.status === "in_progress" &&
        work.technicianId === assigned,
    );
    if (openWork) return false;
    updateDeviceLifecycle(item.request.id, item.device.localId, {
      assignedTechnicianId: null,
      assignedTechnicianName: null,
    });
    return true;
  });

  return [...awaiting].sort((a, b) => {
    const aUrgent = a.request.priority === "urgent" ? 0 : 1;
    const bUrgent = b.request.priority === "urgent" ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return b.request.receivedAt.localeCompare(a.request.receivedAt);
  });
}

export function startDeviceWork(item: TechnicianQueueItem, technician: Profile) {
  updateDeviceLifecycle(item.request.id, item.device.localId, {
    lifecycleStatus: "in_maintenance",
    currentLocation: "service_center",
    assignedTechnicianId: technician.id,
    assignedTechnicianName: technician.fullName,
  });

  const record: TechnicianWorkRecord = {
    id: crypto.randomUUID(),
    requestId: item.request.id,
    requestNumber: item.request.requestNumber,
    deviceLocalId: item.device.localId,
    deviceCode: item.device.deviceCode,
    technicianId: technician.id,
    technicianName: technician.fullName,
    startedAt: new Date().toISOString(),
    status: "in_progress",
    tests: {
      power: null,
      pump: null,
      light: null,
      sound: null,
      programming: null,
    },
  };

  const next = [record, ...listTechnicianWork()];
  writeJson(WORK_KEY, next);
  schedulePersist(next);
  return record;
}

export function saveTechnicianWork(record: TechnicianWorkRecord) {
  const all = listTechnicianWork();
  const idx = all.findIndex((item) => item.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.unshift(record);
  writeJson(WORK_KEY, all);
  schedulePersist(all);
  return record;
}

export function completeTechnicianWork(
  record: TechnicianWorkRecord,
  options?: { modelId?: string; modelName?: string; user?: Profile },
): { ok: true; record: TechnicianWorkRecord } | { ok: false; error: string } {
  const used = (record.sparePartsUsed ?? []).filter((part) => part.qty > 0);
  if (used.length > 0) {
    const modelId = options?.modelId;
    if (!modelId) {
      return { ok: false, error: "تعذر تحديد موديل الجهاز لخصم قطع الغيار." };
    }
    const actor =
      options?.user ??
      ({
        id: record.technicianId,
        fullName: record.technicianName,
        role: "technician",
        email: "",
      } as Profile);
    const consumed = consumeSpareParts({
      user: actor,
      modelId,
      modelName: options?.modelName,
      parts: used,
      reference: `${record.requestNumber}/${record.deviceCode}`,
    });
    if (!consumed.ok) return consumed;
  }

  const finished: TechnicianWorkRecord = {
    ...record,
    status: "completed",
    finishedAt: new Date().toISOString(),
  };
  saveTechnicianWork(finished);

  const success =
    record.outcome === "repaired" || record.outcome === "no_repair_needed";
  updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
    lifecycleStatus: success ? "ready_to_return" : "awaiting_manager_decision",
    currentLocation: "service_center",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
  });
  return { ok: true, record: finished };
}

function formatHoldReasonNote(record: TechnicianWorkRecord) {
  if (!record.holdReason) return "إرجاع للمشرف بدون سبب مسجّل";
  const label = HOLD_REASON_LABELS[record.holdReason] ?? record.holdReason;
  const extra =
    record.holdReason === "other" && record.holdOtherNote?.trim()
      ? ` — ${record.holdOtherNote.trim()}`
      : "";
  return `إرجاع للمشرف: ${label}${extra}`;
}

/** Technician returns a device to the supervisor; frees the technician for other ready devices. */
export function holdTechnicianWork(record: TechnicianWorkRecord) {
  const finishedAt = new Date().toISOString();
  const held: TechnicianWorkRecord = {
    ...record,
    status: "held",
    finishedAt,
  };

  // Close every open work row for this device so the technician is fully free.
  const all = listTechnicianWork().map((item) => {
    if (
      item.deviceLocalId === record.deviceLocalId &&
      item.requestId === record.requestId &&
      item.status === "in_progress"
    ) {
      return {
        ...item,
        ...held,
        id: item.id === record.id ? held.id : item.id,
        status: "held" as const,
        finishedAt,
      };
    }
    if (item.id === record.id) return held;
    return item;
  });
  if (!all.some((item) => item.id === record.id)) all.unshift(held);
  writeJson(WORK_KEY, all);
  schedulePersist(all);

  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === record.requestId && item.device.localId === record.deviceLocalId,
  );
  const reasonNote = formatHoldReasonNote(held);
  updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
    lifecycleStatus: "awaiting_manager_decision",
    currentLocation: "service_center",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    lockedAfterShip: false,
    extraDetails: [match?.device.extraDetails, reasonNote].filter(Boolean).join(" | "),
  });
  return held;
}

export function listAwaitingManagerDecisionDevices(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(
    (item) => item.device.lifecycleStatus === "awaiting_manager_decision",
  );
}

/** Latest hold / return-to-supervisor note for manager UI. */
export function getDeviceHoldSummary(requestId: string, deviceLocalId: string) {
  const held = listTechnicianWork()
    .filter(
      (item) =>
        item.requestId === requestId &&
        item.deviceLocalId === deviceLocalId &&
        item.status === "held",
    )
    .sort((a, b) => (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt))[0];
  if (!held) return null;
  return {
    technicianName: held.technicianName,
    reason: formatHoldReasonNote(held),
    finishedAt: held.finishedAt ?? held.startedAt,
  };
}

export function listMyInProgressDevices(technicianId: string): TechnicianQueueItem[] {
  repairOrphanedMaintenanceDevices();
  return listAllRequestDevices().filter(
    (item) =>
      normalizeLifecycleStatus(item.device.lifecycleStatus) === "in_maintenance" &&
      item.device.assignedTechnicianId === technicianId,
  );
}

export function findOpenWorkForDevice(deviceLocalId: string, technicianId: string) {
  return (
    listTechnicianWork().find(
      (item) =>
        item.deviceLocalId === deviceLocalId &&
        item.technicianId === technicianId &&
        item.status === "in_progress",
    ) ?? null
  );
}

export const MANAGER_DECISION_LABELS: Record<ManagerDeviceDecision, string> = {
  requeue_technician: "إعادة للصيانة",
  approve_return: "اعتماد الإرجاع للفرع",
  close_case: "إغلاق الحالة بدون إرجاع",
};

/** Supervisor sends a suspended device back into the technician queue. */
export function returnSuspendedDeviceToMaintenance(input: {
  user: Profile;
  requestId: string;
  deviceLocalId: string;
  note?: string;
}): { ok: true } | { ok: false; error: string } {
  return resolveManagerDecision({
    ...input,
    decision: "requeue_technician",
  });
}

export function resolveManagerDecision(input: {
  user: Profile;
  requestId: string;
  deviceLocalId: string;
  decision: ManagerDeviceDecision;
  note?: string;
}): { ok: true } | { ok: false; error: string } {
  const role = input.user.role;
  if (
    !["maintenance_manager", "system_admin", "manager", "maintenance_supervisor", "supervisor"].includes(
      role,
    )
  ) {
    return { ok: false, error: "قرار مدير/مشرف الصيانة مسموح لمدير أو مشرف الصيانة فقط." };
  }

  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === input.requestId && item.device.localId === input.deviceLocalId,
  );
  if (!match) return { ok: false, error: "الجهاز غير موجود." };
  if (match.device.lifecycleStatus !== "awaiting_manager_decision") {
    return { ok: false, error: "هذا الجهاز ليس في حالة معلق." };
  }

  if (input.decision === "requeue_technician") {
    const note = input.note?.trim();
    updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
      lifecycleStatus: "awaiting_maintenance",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      lockedAfterShip: false,
      extraDetails: [match.device.extraDetails, note ? `إعادة للصيانة: ${note}` : "إعادة للصيانة"]
        .filter(Boolean)
        .join(" | "),
    });
  } else if (input.decision === "approve_return") {
    updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
      lifecycleStatus: "ready_to_return",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      lockedAfterShip: false,
    });
  } else {
    updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
      lifecycleStatus: "closed",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      lockedAfterShip: true,
      extraDetails: [match.device.extraDetails, input.note?.trim() ? `قرار المدير: ${input.note.trim()}` : ""]
        .filter(Boolean)
        .join(" | "),
    });
  }

  return { ok: true };
}

export function markDeliveredToCustomer(input: {
  user: Profile;
  requestId: string;
  deviceLocalId: string;
}): { ok: true } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["branch", "branch_employee", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "تسليم العميل مسموح لموظف الفرع." };
  }

  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === input.requestId && item.device.localId === input.deviceLocalId,
  );
  if (!match) return { ok: false, error: "الجهاز غير موجود." };
  if (
    !["awaiting_customer", "received_at_destination", "received_damaged"].includes(
      match.device.lifecycleStatus ?? "",
    )
  ) {
    return { ok: false, error: "يجب استلام الجهاز في الفرع أولًا قبل التسليم للعميل." };
  }
  if (input.user.opsBranchId && match.request.opsBranchId !== input.user.opsBranchId) {
    return { ok: false, error: "هذا الجهاز لا يخص فرعك." };
  }

  updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
    lifecycleStatus: "delivered_to_customer",
    currentLocation: "customer",
    lockedAfterShip: true,
  });
  return { ok: true };
}

export function getTechnicianDashboardStats(technicianId: string) {
  repairStaleTechnicianAssignments();
  const awaiting = getSortedAwaitingDevices();
  const allDevices = listAllRequestDevices();
  const work = listTechnicianWork().filter((item) => item.technicianId === technicianId);

  const availableRequests = new Set(awaiting.map((item) => item.request.id)).size;
  const availableDevices = awaiting.length;
  const readyToReturn = allDevices.filter(
    (item) => item.device.lifecycleStatus === "ready_to_return",
  ).length;
  const awaitingManager = allDevices.filter(
    (item) => item.device.lifecycleStatus === "awaiting_manager_decision",
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const todayRequests = listMaintenanceRequests().filter((request) =>
    request.receivedAt.startsWith(today),
  );

  return {
    availableRequests,
    availableDevices,
    readyToSend: readyToReturn,
    excluded: awaitingManager,
    readyToReturn,
    awaitingManager,
    todayRequests,
    myInProgress: work.filter((item) => item.status === "in_progress").length,
  };
}

export function getDeviceWorkHistory(deviceCode: string) {
  return listTechnicianWork().filter((item) => item.deviceCode === deviceCode);
}
