import {
  getDeviceAssignmentPath,
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
  updateDeviceLifecycle,
  updateDevicesLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { isDemoMode, normalizeRole } from "@/lib/auth";
import { consumeSpareParts } from "@/lib/spare-inventory-store";
import { pushAppTechnicianWork } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { HOLD_REASON_LABELS } from "@/lib/technician-catalog";
import type {
  DraftRequestDevice,
  ManagerDeviceDecision,
  Profile,
  TechnicianWorkRecord,
} from "@/types/domain";

const WORK_KEY = "arms_technician_work_v1";

const CLAIM_RACE_MESSAGE =
  "الجهاز غير متاح يرجى اختيار جهاز آخر";

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

/**
 * Free devices stuck in maintenance with no assignee after hold/complete left a bad status.
 * Also upgrades successful completed work still stuck at awaiting/in_maintenance → ready_to_return.
 * Never clears an existing assignedTechnicianId — missing local work is sync lag, not an orphan,
 * and wiping it would push a stale unlock to Supabase for other technicians.
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
        updates.push({
          requestId: item.request.id,
          deviceLocalId: item.device.localId,
          patch: {
            lifecycleStatus: "awaiting_customer",
            currentLocation: "branch",
            assignedTechnicianId: null,
            assignedTechnicianName: null,
            maintenanceFinishedAt: latest.finishedAt ?? item.device.maintenanceFinishedAt ?? null,
          },
        });
      } else {
        updates.push({
          requestId: item.request.id,
          deviceLocalId: item.device.localId,
          patch: {
            lifecycleStatus: "ready_to_return",
            currentLocation: "service_center",
            assignedTechnicianId: null,
            assignedTechnicianName: null,
            maintenanceFinishedAt: latest.finishedAt ?? item.device.maintenanceFinishedAt ?? null,
          },
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
      updates.push({
        requestId: item.request.id,
        deviceLocalId: item.device.localId,
        patch: {
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
        },
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

    if (path === "mobile_technician" || status === "in_maintenance_at_branch") {
      updates.push({
        requestId: item.request.id,
        deviceLocalId: item.device.localId,
        patch: {
          lifecycleStatus: held ? "awaiting_manager_decision" : "in_maintenance_at_branch",
          currentLocation: "branch",
          assignedTechnicianId: null,
          assignedTechnicianName: null,
          maintenanceStartedAt: held ? item.device.maintenanceStartedAt ?? null : null,
          maintenanceFinishedAt: held ? item.device.maintenanceFinishedAt ?? null : null,
        },
      });
      continue;
    }

    updates.push({
      requestId: item.request.id,
      deviceLocalId: item.device.localId,
      patch: {
        lifecycleStatus: held ? "awaiting_manager_decision" : "awaiting_maintenance",
        currentLocation: "service_center",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        maintenanceStartedAt: null,
      },
    });
  }

  updateDevicesLifecycle(updates);
}

/** Run status repairs when listing devices outside the technician queue. */
export function ensureDeviceLifecycleRepairs() {
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
  if (!record.holdReason) return "إرجاع للمشرف بدون سبب مسجّل";
  const label = HOLD_REASON_LABELS[record.holdReason] ?? record.holdReason;
  const extra =
    record.holdReason === "other" && record.holdOtherNote?.trim()
      ? ` — ${record.holdOtherNote.trim()}`
      : "";
  return `إرجاع للمشرف: ${label}${extra}`;
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
