import {
  getDeviceAssignmentPath,
  getMaintenanceRequestById,
  listAllRequestDevices,
  listMaintenanceRequests,
  listMaintenanceRequestsLocal,
  normalizeLifecycleStatus,
  replaceMaintenanceRequest,
  updateDeviceLifecycle,
  updateDevicesLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { isDemoMode, normalizeRole } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications-store";
import {
  addReplacedDevice,
  adjustReplacedDeviceQuantity,
  listReplacedDevices,
} from "@/lib/replaced-devices-store";
import { consumeSpareParts } from "@/lib/spare-inventory-store";
import { pushAppTechnicianWork } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { HOLD_REASON_LABELS } from "@/lib/technician-catalog";
import type {
  DraftRequestDevice,
  MaintenanceRequestRecord,
  ManagerDeviceDecision,
  Profile,
  RequestLinkEvent,
  TechnicianWorkRecord,
} from "@/types/domain";

/** Options when manager decides «استبدال» */
export type ReplacementDecisionInput = {
  /** Consume one unit from replaced-devices stock */
  stockItemId?: string;
  /** Register (or describe) a replacement device not picked from existing stock */
  register?: {
    deviceTypeName: string;
    modelName?: string;
    serialOrCode?: string;
    notes?: string;
  };
};

const WORK_KEY = "arms_technician_work_v1";

const CLAIM_RACE_MESSAGE =
  "الجهاز غير متاح يرجى اختيار جهاز آخر";

/** In-memory cache — re-parsing work JSON (often with photos) on every queue froze the tab. */
let workMemoryCache: TechnicianWorkRecord[] | null = null;

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
  if (key === WORK_KEY) {
    workMemoryCache = value as TechnicianWorkRecord[];
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function schedulePersist(work: TechnicianWorkRecord[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppTechnicianWork(work);
}

export function listTechnicianWorkLocal(): TechnicianWorkRecord[] {
  if (workMemoryCache) return workMemoryCache;
  workMemoryCache = readJson<TechnicianWorkRecord[]>(WORK_KEY, []);
  return workMemoryCache;
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

function isMobileRole(role: Profile["role"]) {
  return normalizeRole(role) === "mobile_technician";
}

function isServiceCenterTechRole(role: Profile["role"]) {
  return normalizeRole(role) === "technician";
}

/**
 * Free devices stuck in maintenance with no assignee after hold/complete left a bad status.
 * Never clears an existing assignedTechnicianId — missing local work is sync lag, not an orphan,
 * and wiping it would push a stale unlock to Supabase for other technicians.
 */
function latestWorkForDevice(
  work: TechnicianWorkRecord[],
  requestId: string,
  deviceLocalId: string,
) {
  return work
    .filter((record) => record.requestId === requestId && record.deviceLocalId === deviceLocalId)
    .sort((a, b) => (b.finishedAt ?? b.startedAt ?? "").localeCompare(a.finishedAt ?? a.startedAt ?? ""))[0];
}

function isSuccessfulOutcome(outcome: TechnicianWorkRecord["outcome"] | null | undefined) {
  return outcome === "repaired" || outcome === "no_repair_needed";
}

function devicePatchChanges(
  device: DraftRequestDevice,
  patch: Partial<DraftRequestDevice>,
): boolean {
  for (const key of Object.keys(patch) as Array<keyof DraftRequestDevice>) {
    const next = patch[key];
    const current = device[key];
    if ((current ?? null) !== (next ?? null)) return true;
  }
  return false;
}

function queueDevicePatch(
  updates: Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Partial<DraftRequestDevice>;
  }>,
  item: TechnicianQueueItem,
  patch: Partial<DraftRequestDevice>,
) {
  if (!devicePatchChanges(item.device, patch)) return;
  updates.push({
    requestId: item.request.id,
    deviceLocalId: item.device.localId,
    patch,
  });
}

/**
 * Free devices stuck in maintenance with no assignee after hold/complete left a bad status.
 * Also upgrades successful completed work still stuck at awaiting/in_maintenance → ready_to_return.
 * Never clears an existing assignedTechnicianId — missing local work is sync lag, not an orphan,
 * and wiping it would push a stale unlock to Supabase for other technicians.
 *
 * Critical: never write no-op patches. Rewriting the same status notified subscribers on every
 * listOps* call and froze the tab (Page Unresponsive / Out of Memory).
 */
function repairOrphanedMaintenanceDevices() {
  const work = listTechnicianWork();
  const updates: Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Partial<DraftRequestDevice>;
  }> = [];

  for (const item of listAllRequestDevices()) {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    const path = getDeviceAssignmentPath(item.request, item.device);
    const latest = latestWorkForDevice(work, item.request.id, item.device.localId);
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();

    // Successful finish still showing a pre-return SC status → جاهز للإرجاع
    if (
      !assigned &&
      latest?.status === "completed" &&
      isSuccessfulOutcome(latest.outcome) &&
      ["awaiting_maintenance", "in_maintenance", "in_maintenance_at_branch"].includes(status)
    ) {
      if (path === "mobile_technician" || status === "in_maintenance_at_branch") {
        queueDevicePatch(updates, item, {
          lifecycleStatus: "awaiting_customer",
          currentLocation: "branch",
          assignedTechnicianId: null,
          assignedTechnicianName: null,
          maintenanceFinishedAt: latest.finishedAt ?? item.device.maintenanceFinishedAt ?? null,
        });
      } else {
        queueDevicePatch(updates, item, {
          lifecycleStatus: "ready_to_return",
          currentLocation: "service_center",
          assignedTechnicianId: null,
          assignedTechnicianName: null,
          maintenanceFinishedAt: latest.finishedAt ?? item.device.maintenanceFinishedAt ?? null,
        });
      }
      continue;
    }

    // Failed / held finish → supervisor hold
    if (
      !assigned &&
      latest &&
      (latest.status === "held" ||
        (latest.status === "completed" && !isSuccessfulOutcome(latest.outcome))) &&
      ["awaiting_maintenance", "in_maintenance", "in_maintenance_at_branch"].includes(status)
    ) {
      queueDevicePatch(updates, item, {
        lifecycleStatus:
          path === "mobile_technician" || status === "in_maintenance_at_branch"
            ? latest.status === "completed" && latest.outcome === "not_repairable"
              ? "maintenance_failed"
              : "awaiting_manager_decision"
            : "awaiting_manager_decision",
        currentLocation:
          path === "mobile_technician" || status === "in_maintenance_at_branch"
            ? "branch"
            : "service_center",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceFinishedAt: latest.finishedAt ?? item.device.maintenanceFinishedAt ?? null,
      });
      continue;
    }

    if (status !== "in_maintenance" && status !== "in_maintenance_at_branch") continue;

    // Assigned device belongs to that technician until they finish/hold — do not unlock.
    if (assigned) continue;

    const hasOpen = work.some(
      (record) =>
        record.deviceLocalId === item.device.localId &&
        record.requestId === item.request.id &&
        record.status === "in_progress",
    );
    if (hasOpen) continue;

    const held = latest?.status === "held" ? latest : undefined;

    // Mobile path: only move when held → manager decision. Never rewrite same status
    // (that notify loop froze the browser).
    if (path === "mobile_technician" || status === "in_maintenance_at_branch") {
      if (!held) continue;
      queueDevicePatch(updates, item, {
        lifecycleStatus: "awaiting_manager_decision",
        currentLocation: "branch",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceStartedAt: item.device.maintenanceStartedAt ?? null,
        maintenanceFinishedAt: item.device.maintenanceFinishedAt ?? null,
      });
      continue;
    }

    // Service-center orphan: unlock stuck in_maintenance back to the claim queue.
    queueDevicePatch(updates, item, {
      lifecycleStatus: held ? "awaiting_manager_decision" : "awaiting_maintenance",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      maintenanceStartedAt: null,
    });
  }

  if (updates.length) updateDevicesLifecycle(updates);
}

/** One repair pass per in-memory requests snapshot — listOps* calls this often. */
let orphanRepairDoneForRequestsRef: MaintenanceRequestRecord[] | null | undefined;

/** Run status repairs when listing devices outside the technician queue. */
export function ensureDeviceLifecycleRepairs() {
  const requests = listMaintenanceRequestsLocal({ skipSeed: true });
  if (orphanRepairDoneForRequestsRef === requests) return;
  orphanRepairDoneForRequestsRef = requests;
  repairOrphanedMaintenanceDevices();
}

/** Apply urgent-only rule: if any urgent exists in the set, keep only urgent. */
function applyUrgentOnlyFilter(items: TechnicianQueueItem[]): TechnicianQueueItem[] {
  const hasUrgent = items.some((item) => item.request.priority === "urgent");
  const filtered = hasUrgent
    ? items.filter((item) => item.request.priority === "urgent")
    : items;
  return [...filtered].sort((a, b) => {
    const aUrgent = a.request.priority === "urgent" ? 0 : 1;
    const bUrgent = b.request.priority === "urgent" ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return b.request.receivedAt.localeCompare(a.request.receivedAt);
  });
}

function isClaimedByOther(item: TechnicianQueueItem, technicianId: string) {
  const assigned = String(item.device.assignedTechnicianId ?? "").trim();
  if (!assigned) return false;
  return assigned !== technicianId;
}

/** True when another technician already owns this device (assignment and/or open work). */
function isOwnedByOtherTechnician(
  item: TechnicianQueueItem,
  technicianId: string,
): boolean {
  if (isClaimedByOther(item, technicianId)) return true;
  return listTechnicianWork().some(
    (work) =>
      work.deviceLocalId === item.device.localId &&
      work.requestId === item.request.id &&
      work.status === "in_progress" &&
      work.technicianId !== technicianId,
  );
}

/**
 * Waiting devices for a technician (before urgent-only filter):
 * - service-center tech: awaiting_maintenance at SC only (never mobile path)
 * - mobile tech: in_maintenance_at_branch for their branch only
 * - claimed-by-other / own in-progress devices hidden from waiting
 */
function listAwaitingForTechnicianRaw(technician: Profile): TechnicianQueueItem[] {
  repairOrphanedMaintenanceDevices();

  const role = normalizeRole(technician.role);
  return listAllRequestDevices().filter((item) => {
    if (isOwnedByOtherTechnician(item, technician.id)) return false;

    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    const path = getDeviceAssignmentPath(item.request, item.device);

    if (role === "mobile_technician") {
      if (status !== "in_maintenance_at_branch") return false;
      if (path !== "mobile_technician") return false;
      if (technician.opsBranchId && item.request.opsBranchId !== technician.opsBranchId) {
        return false;
      }
      const assigned = String(item.device.assignedTechnicianId ?? "").trim();
      if (assigned && assigned !== technician.id) return false;
      // Claimed by me → «استئناف العمل», not waiting queue.
      if (assigned === technician.id) return false;
      return true;
    }

    if (role === "technician") {
      if (path === "mobile_technician") return false;
      if (status === "in_maintenance_at_branch" || status === "maintenance_failed") return false;
      // Service-center active maintenance is never in the waiting queue.
      if (status === "in_maintenance") return false;

      if (status !== "awaiting_maintenance") {
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
      // Assigned to me without finishing → show under in-progress, not queue.
      if (assigned && assigned !== technician.id) return false;
      if (assigned === technician.id) return false;
      return true;
    }

    return false;
  });
}

/** Counts for work-page stat cards (total awaiting ignores urgent-only display filter). */
export function getTechnicianWorkPageStats(technician: Profile) {
  const awaitingRaw = listAwaitingForTechnicianRaw(technician);
  const myWork = listTechnicianWork().filter((item) => item.technicianId === technician.id);
  return {
    awaitingTotal: awaitingRaw.length,
    awaitingUrgent: awaitingRaw.filter((item) => item.request.priority === "urgent").length,
    myInProgress: myWork.filter((item) => item.status === "in_progress").length,
    myCompleted: myWork.filter((item) => item.status === "completed").length,
  };
}

/**
 * Eligible queue for a technician (urgent-only when any urgent exists).
 */
export function getEligibleQueueForTechnician(technician: Profile): TechnicianQueueItem[] {
  return applyUrgentOnlyFilter(listAwaitingForTechnicianRaw(technician));
}

/** @deprecated prefer getEligibleQueueForTechnician — kept for older callers */
export function getSortedAwaitingDevices(technician?: Profile): TechnicianQueueItem[] {
  if (technician) return getEligibleQueueForTechnician(technician);
  repairOrphanedMaintenanceDevices();
  const awaiting = listAllRequestDevices().filter((item) => {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "awaiting_maintenance") return false;
    if (getDeviceAssignmentPath(item.request, item.device) === "mobile_technician") return false;
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    // Hide anything already claimed; do not wipe remote assignments from this filter.
    return !assigned;
  });
  return applyUrgentOnlyFilter(awaiting);
}

export function startDeviceWork(
  item: TechnicianQueueItem,
  technician: Profile,
): { ok: true; record: TechnicianWorkRecord } | { ok: false; error: string } {
  const fresh = listAllRequestDevices().find(
    (row) =>
      row.request.id === item.request.id && row.device.localId === item.device.localId,
  );
  if (!fresh) return { ok: false, error: "الجهاز غير موجود." };

  const status = normalizeLifecycleStatus(fresh.device.lifecycleStatus);
  const path = getDeviceAssignmentPath(fresh.request, fresh.device);
  const mobile = isMobileRole(technician.role);

  if (mobile) {
    if (status !== "in_maintenance_at_branch" || path !== "mobile_technician") {
      return { ok: false, error: "هذا الجهاز غير متاح للفني المتنقل." };
    }
    if (technician.opsBranchId && fresh.request.opsBranchId !== technician.opsBranchId) {
      return { ok: false, error: "هذا الجهاز لا يخص فرعك." };
    }
  } else if (isServiceCenterTechRole(technician.role)) {
    if (path === "mobile_technician" || status === "in_maintenance_at_branch") {
      return { ok: false, error: "أجهزة الفني المتنقل غير ظاهرة لفنّيي مركز الصيانة." };
    }
    if (status !== "awaiting_maintenance" && status !== "in_maintenance") {
      return { ok: false, error: "الجهاز ليس بانتظار الصيانة." };
    }
  }

  if (isOwnedByOtherTechnician(fresh, technician.id)) {
    return { ok: false, error: CLAIM_RACE_MESSAGE };
  }

  // Service-center device already under maintenance without being ours.
  if (
    !mobile &&
    status === "in_maintenance" &&
    String(fresh.device.assignedTechnicianId ?? "").trim() !== technician.id
  ) {
    return { ok: false, error: CLAIM_RACE_MESSAGE };
  }

  const existingOpen = findOpenWorkForDevice(fresh.device.localId, technician.id);
  if (existingOpen) {
    // Resume only if this device is still assigned to the current technician.
    const assigned = String(fresh.device.assignedTechnicianId ?? "").trim();
    if (assigned && assigned !== technician.id) {
      return { ok: false, error: CLAIM_RACE_MESSAGE };
    }
    return { ok: true, record: existingOpen };
  }

  const startedAt = new Date().toISOString();
  const nextStatus = mobile ? "in_maintenance_at_branch" : "in_maintenance";
  const nextLocation = mobile ? "branch" : "service_center";

  updateDeviceLifecycle(fresh.request.id, fresh.device.localId, {
    lifecycleStatus: nextStatus,
    currentLocation: nextLocation,
    assignedTechnicianId: technician.id,
    assignedTechnicianName: technician.fullName,
    maintenanceStartedAt: startedAt,
    maintenanceFinishedAt: null,
  });

  // Re-check after write (local optimistic lock against concurrent tabs/sync).
  const after = listAllRequestDevices().find(
    (row) =>
      row.request.id === fresh.request.id && row.device.localId === fresh.device.localId,
  );
  if (
    after &&
    after.device.assignedTechnicianId &&
    after.device.assignedTechnicianId !== technician.id
  ) {
    return { ok: false, error: CLAIM_RACE_MESSAGE };
  }

  const record: TechnicianWorkRecord = {
    id: crypto.randomUUID(),
    requestId: fresh.request.id,
    requestNumber: fresh.request.requestNumber,
    deviceLocalId: fresh.device.localId,
    deviceCode: fresh.device.deviceCode,
    technicianId: technician.id,
    technicianName: technician.fullName,
    startedAt,
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
  return { ok: true, record };
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

  const finishedAt = new Date().toISOString();
  const finished: TechnicianWorkRecord = {
    ...record,
    status: "completed",
    finishedAt,
  };
  saveTechnicianWork(finished);

  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === record.requestId && item.device.localId === record.deviceLocalId,
  );
  const path = match ? getDeviceAssignmentPath(match.request, match.device) : "service_center";
  const mobile = path === "mobile_technician";
  const success =
    record.outcome === "repaired" || record.outcome === "no_repair_needed";

  if (mobile) {
    if (success) {
      updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
        lifecycleStatus: "awaiting_customer",
        currentLocation: "branch",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceFinishedAt: finishedAt,
      });
    } else {
      updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
        lifecycleStatus: "maintenance_failed",
        currentLocation: "branch",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceFinishedAt: finishedAt,
      });
    }
  } else {
    updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
      lifecycleStatus: success ? "ready_to_return" : "awaiting_manager_decision",
      currentLocation: "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      maintenanceFinishedAt: finishedAt,
    });
  }
  return { ok: true, record: finished };
}

function formatHoldReasonNote(record: TechnicianWorkRecord) {
  if (!record.holdReason) return "تعليق الصيانة بدون سبب مسجّل";
  const label = HOLD_REASON_LABELS[record.holdReason] ?? record.holdReason;
  const extra =
    record.holdReason === "other" && record.holdOtherNote?.trim()
      ? ` — ${record.holdOtherNote.trim()}`
      : "";
  return `تعليق الصيانة: ${label}${extra}`;
}

/** Explicit «تعذر الصيانة» for mobile technicians. */
export function markMaintenanceFailed(
  record: TechnicianWorkRecord,
  note?: string,
): TechnicianWorkRecord {
  const finishedAt = new Date().toISOString();
  const failed: TechnicianWorkRecord = {
    ...record,
    status: "completed",
    finishedAt,
    outcome: record.outcome ?? "not_repairable",
  };

  const all = listTechnicianWork().map((item) => {
    if (
      item.deviceLocalId === record.deviceLocalId &&
      item.requestId === record.requestId &&
      item.status === "in_progress"
    ) {
      return { ...item, ...failed, id: item.id === record.id ? failed.id : item.id };
    }
    if (item.id === record.id) return failed;
    return item;
  });
  if (!all.some((item) => item.id === record.id)) all.unshift(failed);
  writeJson(WORK_KEY, all);
  schedulePersist(all);

  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === record.requestId && item.device.localId === record.deviceLocalId,
  );
  updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
    lifecycleStatus: "maintenance_failed",
    currentLocation: "branch",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    maintenanceFinishedAt: finishedAt,
    extraDetails: [match?.device.extraDetails, note?.trim() ? `تعذر الصيانة: ${note.trim()}` : "تعذر الصيانة"]
      .filter(Boolean)
      .join(" | "),
  });
  return failed;
}

/** After failure: hand device back to branch employee so they can ship to SC. */
export function returnFailedDeviceToBranchEmployee(input: {
  user: Profile;
  requestId: string;
  deviceLocalId: string;
}): { ok: true } | { ok: false; error: string } {
  const match = listAllRequestDevices().find(
    (item) =>
      item.request.id === input.requestId && item.device.localId === input.deviceLocalId,
  );
  if (!match) return { ok: false, error: "الجهاز غير موجود." };
  if (normalizeLifecycleStatus(match.device.lifecycleStatus) !== "maintenance_failed") {
    return { ok: false, error: "الجهاز ليس في حالة تعذر الصيانة." };
  }
  if (
    isMobileRole(input.user.role) &&
    input.user.opsBranchId &&
    match.request.opsBranchId !== input.user.opsBranchId
  ) {
    return { ok: false, error: "هذا الجهاز لا يخص فرعك." };
  }

  updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
    lifecycleStatus: "received_at_branch",
    currentLocation: "branch",
    assignmentPath: "service_center",
    lockedAfterShip: false,
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    extraDetails: [match.device.extraDetails, "أُعيد لموظف الفرع للشحن لمركز الصيانة"]
      .filter(Boolean)
      .join(" | "),
  });
  return { ok: true };
}

/** Technician returns a device to the supervisor; frees the technician for other ready devices. */
export function holdTechnicianWork(record: TechnicianWorkRecord) {
  const finishedAt = new Date().toISOString();
  const held: TechnicianWorkRecord = {
    ...record,
    status: "held",
    finishedAt,
  };

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
  const path = match ? getDeviceAssignmentPath(match.request, match.device) : "service_center";
  const reasonNote = formatHoldReasonNote(held);
  updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
    lifecycleStatus: "awaiting_manager_decision",
    currentLocation: path === "mobile_technician" ? "branch" : "service_center",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    lockedAfterShip: false,
    maintenanceFinishedAt: finishedAt,
    extraDetails: [match?.device.extraDetails, reasonNote].filter(Boolean).join(" | "),
  });

  // Notify maintenance managers when the hold is specifically for replacement.
  if (held.holdReason === "needs_replacement" && typeof window !== "undefined") {
    const code = held.deviceCode || match?.device.deviceCode || "—";
    const reqNo = held.requestNumber || match?.request.requestNumber || "—";
    createSystemNotification({
      title: "تعليق صيانة — يحتاج استبدال",
      body: `الجهاز ${code} في الطلب ${reqNo} عُلّق بانتظار قرار الاستبدال من مدير الصيانة.`,
      audienceType: "role",
      audienceRole: "maintenance_manager",
    });
    createSystemNotification({
      title: "تعليق صيانة — يحتاج استبدال",
      body: `الجهاز ${code} في الطلب ${reqNo} عُلّق بانتظار قرار الاستبدال من مدير الصيانة.`,
      audienceType: "role",
      audienceRole: "system_admin",
    });
  }

  return held;
}

export function listAwaitingManagerDecisionDevices(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(
    (item) => item.device.lifecycleStatus === "awaiting_manager_decision",
  );
}

/** Devices with تعذر الصيانة — visible to mobile tech, branch, managers. */
export function listMaintenanceFailedDevices(opsBranchId?: string | null): TechnicianQueueItem[] {
  return listAllRequestDevices().filter((item) => {
    if (normalizeLifecycleStatus(item.device.lifecycleStatus) !== "maintenance_failed") {
      return false;
    }
    if (opsBranchId && item.request.opsBranchId !== opsBranchId) return false;
    return true;
  });
}

/** Branch / manager visibility: mobile-path devices currently at branch. */
export function listMobilePathDevicesAtBranch(opsBranchId?: string | null): TechnicianQueueItem[] {
  return listAllRequestDevices().filter((item) => {
    if (getDeviceAssignmentPath(item.request, item.device) !== "mobile_technician") return false;
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (
      !["in_maintenance_at_branch", "maintenance_failed", "awaiting_manager_decision"].includes(
        status,
      )
    ) {
      return false;
    }
    if (opsBranchId && item.request.opsBranchId !== opsBranchId) return false;
    return true;
  });
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
  const myId = String(technicianId ?? "").trim();
  if (!myId) return [];
  return listAllRequestDevices().filter((item) => {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "in_maintenance" && status !== "in_maintenance_at_branch") return false;
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    // Strict ownership: never show another technician's in-progress device under «استئناف العمل».
    return assigned === myId;
  });
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
  approve_replacement: "استبدال",
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

function uniqueReplacementDeviceCode(
  preferred: string | undefined,
  originalCode: string,
  existingCodes: Set<string>,
): string {
  const base =
    (preferred || "").trim() ||
    `REP-${originalCode}`.replace(/\s+/g, "-").slice(0, 40);
  if (!existingCodes.has(base)) return base;
  let n = 2;
  while (existingCodes.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Manager approves device replacement: link original ↔ replacement on the same
 * request, optionally consume from replaced-devices stock, update statuses + timeline.
 */
function applyApproveReplacement(input: {
  user: Profile;
  request: MaintenanceRequestRecord;
  original: DraftRequestDevice;
  note?: string;
  replacement?: ReplacementDecisionInput;
}): { ok: true } | { ok: false; error: string } {
  const stockItemId = input.replacement?.stockItemId?.trim();
  const register = input.replacement?.register;
  if (!stockItemId && !register?.deviceTypeName?.trim()) {
    return {
      ok: false,
      error: "لاعتماد الاستبدال: اختر جهازًا من مخزون المستبدلة أو سجّل بيانات جهاز الاستبدال.",
    };
  }

  let deviceTypeName = "";
  let modelName = "";
  let serialOrCode = "";
  let consumedStockId: string | null = null;

  if (stockItemId) {
    const stock = listReplacedDevices().find((row) => row.id === stockItemId);
    if (!stock) return { ok: false, error: "عنصر المخزون المحدد غير موجود." };
    if (stock.quantity < 1) {
      return { ok: false, error: `الكمية غير كافية في المخزون (المتاح: ${stock.quantity}).` };
    }
    const consumed = adjustReplacedDeviceQuantity({ id: stockItemId, delta: -1 });
    if (!consumed.ok) return consumed;
    consumedStockId = stockItemId;
    deviceTypeName = stock.deviceTypeName;
    modelName = stock.modelName || input.original.modelName || "";
    serialOrCode = stock.serialOrCode || "";
  } else if (register) {
    deviceTypeName = register.deviceTypeName.trim();
    modelName = register.modelName?.trim() || input.original.modelName || "";
    serialOrCode = register.serialOrCode?.trim() || "";
    // Keep stock page useful: register the unit then consume it for this case.
    const added = addReplacedDevice({
      user: input.user,
      deviceTypeName,
      modelName: modelName || undefined,
      serialOrCode: serialOrCode || undefined,
      quantity: 1,
      notes: register.notes?.trim() || input.note?.trim() || "تسجيل لاستبدال معتمد",
    });
    if (!added.ok) return added;
    const consumed = adjustReplacedDeviceQuantity({ id: added.item.id, delta: -1 });
    if (!consumed.ok) return consumed;
    consumedStockId = added.item.id;
  }

  const path = getDeviceAssignmentPath(input.request, input.original);
  const now = new Date().toISOString();
  const existingCodes = new Set(
    listAllRequestDevices().map((item) => item.device.deviceCode),
  );
  const replacementLocalId = crypto.randomUUID();
  const replacementCode = uniqueReplacementDeviceCode(
    serialOrCode,
    input.original.deviceCode,
    existingCodes,
  );

  const replacementDevice: DraftRequestDevice = {
    localId: replacementLocalId,
    deviceCode: replacementCode,
    deviceTypeId: input.original.deviceTypeId,
    deviceTypeName: deviceTypeName || input.original.deviceTypeName,
    brandId: input.original.brandId,
    brandName: input.original.brandName,
    modelId: input.original.modelId,
    modelName: modelName || input.original.modelName,
    serialNumber: serialOrCode || replacementCode,
    fault: "جهاز استبدال معتمد من مدير الصيانة",
    externalCondition: "intact",
    accessoryIds: [],
    accessoryNames: [],
    extraDetails: [
      `استبدال عن ${input.original.deviceCode}`,
      input.note?.trim() ? `ملاحظة: ${input.note.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    devicePhotoNames: [],
    color: input.original.color,
    receiptNumber: `REP-${input.request.requestNumber}-${Date.now().toString(36)}`,
    receiptPhotoName: "",
    assignmentPath: path,
    lifecycleStatus: path === "mobile_technician" ? "awaiting_customer" : "ready_to_return",
    currentLocation: path === "mobile_technician" ? "branch" : "service_center",
    lockedAfterShip: false,
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    replacementOfLocalId: input.original.localId,
    replacementOfDeviceCode: input.original.deviceCode,
    replacementStockItemId: consumedStockId,
    replacementDecidedAt: now,
    replacementDecidedByName: input.user.fullName,
  };

  const linkEvent: RequestLinkEvent = {
    id: crypto.randomUUID(),
    at: now,
    kind: "device_replaced",
    note: input.note?.trim() || undefined,
    actorId: input.user.id,
    actorName: input.user.fullName,
    originalDeviceLocalId: input.original.localId,
    originalDeviceCode: input.original.deviceCode,
    replacementDeviceLocalId: replacementLocalId,
    replacementDeviceCode: replacementCode,
  };

  const updatedDevices = input.request.devices.map((device) => {
    if (device.localId !== input.original.localId) return device;
    return {
      ...device,
      lifecycleStatus: "replaced" as const,
      currentLocation: path === "mobile_technician" ? "branch" : "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      lockedAfterShip: true,
      replacedByLocalId: replacementLocalId,
      replacedByDeviceCode: replacementCode,
      replacementDecidedAt: now,
      replacementDecidedByName: input.user.fullName,
      replacementStockItemId: consumedStockId,
      extraDetails: [
        device.extraDetails,
        `تم الاستبدال بالجهاز ${replacementCode}`,
        input.note?.trim() ? `ملاحظة المدير: ${input.note.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    };
  });

  replaceMaintenanceRequest({
    ...input.request,
    devices: [...updatedDevices, replacementDevice],
    linkEvents: [...(input.request.linkEvents ?? []), linkEvent],
  });

  return { ok: true };
}

export function resolveManagerDecision(input: {
  user: Profile;
  requestId: string;
  deviceLocalId: string;
  decision: ManagerDeviceDecision;
  note?: string;
  replacement?: ReplacementDecisionInput;
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

  const path = getDeviceAssignmentPath(match.request, match.device);

  if (input.decision === "requeue_technician") {
    const note = input.note?.trim();
    if (path === "mobile_technician") {
      updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
        lifecycleStatus: "in_maintenance_at_branch",
        currentLocation: "branch",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        lockedAfterShip: false,
        maintenanceStartedAt: null,
        maintenanceFinishedAt: null,
        extraDetails: [match.device.extraDetails, note ? `إعادة للصيانة: ${note}` : "إعادة للصيانة"]
          .filter(Boolean)
          .join(" | "),
      });
    } else {
      updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
        lifecycleStatus: "awaiting_maintenance",
        currentLocation: "service_center",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        lockedAfterShip: false,
        maintenanceStartedAt: null,
        maintenanceFinishedAt: null,
        extraDetails: [match.device.extraDetails, note ? `إعادة للصيانة: ${note}` : "إعادة للصيانة"]
          .filter(Boolean)
          .join(" | "),
      });
    }
  } else if (input.decision === "approve_return") {
    updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
      lifecycleStatus: path === "mobile_technician" ? "awaiting_customer" : "ready_to_return",
      currentLocation: path === "mobile_technician" ? "branch" : "service_center",
      assignedTechnicianId: null,
      assignedTechnicianName: null,
      lockedAfterShip: false,
    });
  } else if (input.decision === "approve_replacement") {
    const request = getMaintenanceRequestById(input.requestId);
    if (!request) return { ok: false, error: "الطلب غير موجود." };
    const original = request.devices.find((d) => d.localId === input.deviceLocalId);
    if (!original) return { ok: false, error: "الجهاز غير موجود." };
    return applyApproveReplacement({
      user: input.user,
      request,
      original,
      note: input.note,
      replacement: input.replacement,
    });
  } else {
    updateDeviceLifecycle(input.requestId, input.deviceLocalId, {
      lifecycleStatus: "closed",
      currentLocation: path === "mobile_technician" ? "branch" : "service_center",
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

  // When delivering a replacement device, close the tracked original on the same request.
  const originalLocalId = match.device.replacementOfLocalId?.trim();
  if (originalLocalId) {
    const original = match.request.devices.find((d) => d.localId === originalLocalId);
    if (original && normalizeLifecycleStatus(original.lifecycleStatus) === "replaced") {
      updateDeviceLifecycle(input.requestId, originalLocalId, {
        lifecycleStatus: "closed",
        lockedAfterShip: true,
        extraDetails: [
          original.extraDetails,
          `أُغلق بعد تسليم جهاز الاستبدال ${match.device.deviceCode} للعميل`,
        ]
          .filter(Boolean)
          .join(" | "),
      });
    }
  }

  return { ok: true };
}

export function getTechnicianDashboardStats(technicianId: string, technician?: Profile) {
  const profile =
    technician ??
    ({
      id: technicianId,
      fullName: "",
      role: "technician",
      email: "",
    } as Profile);
  const awaiting = technician
    ? getEligibleQueueForTechnician(technician)
    : getSortedAwaitingDevices();
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
    profileRole: profile.role,
  };
}

export function getDeviceWorkHistory(deviceCodeOrLocalId: string) {
  const q = deviceCodeOrLocalId.trim().toLowerCase();
  if (!q) return [];
  return listTechnicianWork().filter(
    (item) =>
      item.deviceCode.toLowerCase() === q ||
      item.deviceLocalId.toLowerCase() === q,
  );
}

export { CLAIM_RACE_MESSAGE };
