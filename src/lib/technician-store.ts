import {
  listAllRequestDevices,
  listAwaitingMaintenanceDevices,
  listMaintenanceRequests,
  updateDeviceLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { consumeSpareParts } from "@/lib/spare-inventory-store";
import type { Profile, TechnicianWorkRecord } from "@/types/domain";

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

export function listTechnicianWork() {
  return readJson<TechnicianWorkRecord[]>(WORK_KEY, []);
}

export function getSortedAwaitingDevices(): TechnicianQueueItem[] {
  const awaiting = listAwaitingMaintenanceDevices();
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

  writeJson(WORK_KEY, [record, ...listTechnicianWork()]);
  return record;
}

export function saveTechnicianWork(record: TechnicianWorkRecord) {
  const all = listTechnicianWork();
  const idx = all.findIndex((item) => item.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.unshift(record);
  writeJson(WORK_KEY, all);
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
    assignedTechnicianId: null,
    assignedTechnicianName: null,
  });
  return { ok: true, record: finished };
}

export function holdTechnicianWork(record: TechnicianWorkRecord) {
  const held: TechnicianWorkRecord = {
    ...record,
    status: "held",
    finishedAt: new Date().toISOString(),
  };
  saveTechnicianWork(held);
  updateDeviceLifecycle(record.requestId, record.deviceLocalId, {
    lifecycleStatus: "awaiting_manager_decision",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
  });
  return held;
}

export function getTechnicianDashboardStats(technicianId: string) {
  const awaiting = listAwaitingMaintenanceDevices();
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
