/**
 * Dashboard home-screen work queues (branch / manager / technician).
 * Counts and lists only — does not mutate shipping or claim state machines.
 */
import {
  getDeviceAssignmentPath,
  listAllRequestDevices,
  normalizeLifecycleStatus,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import {
  listApprovedReturnReceiptsForBranch,
  listPickupReceipts,
} from "@/lib/pickup-receipt-store";
import {
  listBranchesReadyToShip,
  listDevicesEligibleForShipment,
  listShippingBatches,
} from "@/lib/shipping-store";
import { totalReplacedDevicesQuantity } from "@/lib/replaced-devices-store";
import {
  DEFAULT_MINIMUM_QUANTITY,
  listInventoryBalances,
} from "@/lib/spare-inventory-store";
import {
  classifyWorkResult,
  workResultLabel,
} from "@/lib/technician-reports";
import { HOLD_REASON_LABELS, OUTCOME_LABELS } from "@/lib/technician-catalog";
import {
  getEligibleQueueForTechnician,
  listTechnicianWork,
} from "@/lib/technician-store";
import type { Profile, TechnicianWorkRecord } from "@/types/domain";

// ---------------------------------------------------------------------------
// Branch — send-to-service sublabels
// ---------------------------------------------------------------------------

export type SendToServiceSublabel =
  | "awaiting_waybill"
  | "awaiting_carrier"
  | "awaiting_courier";

export type BranchSendToServiceItem = TechnicianQueueItem & {
  sendSublabel: SendToServiceSublabel;
};

export type BranchDailyWorkQueues = {
  customersAtBranch: TechnicianQueueItem[];
  sendToService: BranchSendToServiceItem[];
  incomingFromService: TechnicianQueueItem[];
  handToMobile: TechnicianQueueItem[];
  handToCustomer: TechnicianQueueItem[];
};

export type BranchDailyWorkCounts = {
  customersAtBranch: number;
  sendToService: number;
  incomingFromService: number;
  handToMobile: number;
  handToCustomer: number;
};

const OPEN_PICKUP_STATUSES = new Set([
  "draft",
  "pending_courier",
  "partially_rejected",
  "approved",
  "pending_supervisor",
]);

function findQueueItemByDeviceId(
  deviceLocalId: string,
  deviceCode?: string,
): TechnicianQueueItem | null {
  const all = listAllRequestDevices();
  const byId = all.find((row) => row.device.localId === deviceLocalId);
  if (byId) return byId;
  if (!deviceCode) return null;
  const key = deviceCode.trim().toUpperCase();
  return (
    all.find((row) => row.device.deviceCode.trim().toUpperCase() === key) ?? null
  );
}

function maintenanceNotStarted(item: TechnicianQueueItem): boolean {
  const assigned = String(item.device.assignedTechnicianId ?? "").trim();
  if (assigned) return false;
  if (item.device.maintenanceStartedAt) return false;
  const inProgress = listTechnicianWork().some(
    (work) =>
      work.deviceLocalId === item.device.localId &&
      work.requestId === item.request.id &&
      work.status === "in_progress",
  );
  return !inProgress;
}

/** Card 5 — تسليم إلى العميل */
export function listHandToCustomer(opsBranchId: string): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(
    (item) =>
      item.request.opsBranchId === opsBranchId &&
      normalizeLifecycleStatus(item.device.lifecycleStatus) === "awaiting_customer",
  );
}

/**
 * Card 4 — تسليم إلى الفنى المتنقل
 * Mobile path (or in_maintenance_at_branch) and maintenance not started.
 */
export function listHandToMobile(opsBranchId: string): TechnicianQueueItem[] {
  return listAllRequestDevices().filter((item) => {
    if (item.request.opsBranchId !== opsBranchId) return false;
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    const path = getDeviceAssignmentPath(item.request, item.device);
    const mobilePath =
      path === "mobile_technician" || status === "in_maintenance_at_branch";
    if (!mobilePath) return false;
    // Already failed / held / awaiting customer / in transit — not this card.
    if (
      [
        "awaiting_customer",
        "maintenance_failed",
        "awaiting_manager_decision",
        "in_transit_to_service",
        "in_return_transit",
        "delivered_to_customer",
        "ready_to_return",
        "awaiting_maintenance",
        "in_maintenance",
      ].includes(status)
    ) {
      return false;
    }
    return maintenanceNotStarted(item);
  });
}

/**
 * Card 3 — استلام الصيانة الواردة (return side only).
 * in_return_transit + approved return pickup lines for the branch.
 */
export function listIncomingFromService(opsBranchId: string): TechnicianQueueItem[] {
  const byId = new Map<string, TechnicianQueueItem>();

  for (const item of listAllRequestDevices()) {
    if (item.request.opsBranchId !== opsBranchId) continue;
    if (normalizeLifecycleStatus(item.device.lifecycleStatus) !== "in_return_transit") {
      continue;
    }
    byId.set(item.device.localId, item);
  }

  for (const receipt of listApprovedReturnReceiptsForBranch(opsBranchId)) {
    for (const line of receipt.lines) {
      if (line.status !== "approved" && line.status !== "included") continue;
      const match = findQueueItemByDeviceId(line.deviceLocalId);
      if (!match) continue;
      if (match.request.opsBranchId !== opsBranchId) continue;
      // Mobile success lands as awaiting_customer → card 5, not here.
      if (
        normalizeLifecycleStatus(match.device.lifecycleStatus) === "awaiting_customer"
      ) {
        continue;
      }
      byId.set(match.device.localId, match);
    }
  }

  return [...byId.values()];
}

/**
 * Card 2 — إرسال إلى الصيانة (with per-device sublabel; no double-count).
 * (a) eligible, no open waybill → awaiting_waybill
 * (b) on to_service ready|draft → awaiting_carrier
 * (c) open branch_to_center pickup → awaiting_courier
 */
export function listSendToService(opsBranchId: string): BranchSendToServiceItem[] {
  const byId = new Map<string, BranchSendToServiceItem>();

  for (const item of listDevicesEligibleForShipment(opsBranchId)) {
    byId.set(item.device.localId, { ...item, sendSublabel: "awaiting_waybill" });
  }

  for (const batch of listShippingBatches(opsBranchId)) {
    if (batch.direction !== "to_service") continue;
    if (!["ready", "draft"].includes(batch.status)) continue;
    for (const batchItem of batch.items.filter((row) => row.status === "active")) {
      const match =
        findQueueItemByDeviceId(batchItem.requestDeviceId, batchItem.deviceCode) ??
        null;
      if (!match || match.request.opsBranchId !== opsBranchId) continue;
      // Prefer carrier sublabel over waybill when already on a bill.
      byId.set(match.device.localId, { ...match, sendSublabel: "awaiting_carrier" });
    }
  }

  for (const receipt of listPickupReceipts({
    opsBranchId,
    direction: "branch_to_center",
  })) {
    if (!OPEN_PICKUP_STATUSES.has(receipt.status)) continue;
    // Fully delivered / cancelled / rejected terminals already excluded by status set.
    for (const line of receipt.lines) {
      if (line.status === "rejected") continue;
      const match = findQueueItemByDeviceId(line.deviceLocalId);
      if (!match || match.request.opsBranchId !== opsBranchId) continue;
      // Do not override carrier if already on a ready/draft waybill.
      const existing = byId.get(match.device.localId);
      if (existing?.sendSublabel === "awaiting_carrier") continue;
      byId.set(match.device.localId, { ...match, sendSublabel: "awaiting_courier" });
    }
  }

  return [...byId.values()];
}

/**
 * Card 1 — أجهزة عملاء بالفرع (exclusive of cards 2, 4, 5).
 * Typically received / excluded / failed at branch, not yet shipment-eligible.
 */
export function listCustomersAtBranch(opsBranchId: string): TechnicianQueueItem[] {
  const sendIds = new Set(listSendToService(opsBranchId).map((i) => i.device.localId));
  const mobileIds = new Set(listHandToMobile(opsBranchId).map((i) => i.device.localId));
  const customerIds = new Set(
    listHandToCustomer(opsBranchId).map((i) => i.device.localId),
  );

  return listAllRequestDevices().filter((item) => {
    if (item.request.opsBranchId !== opsBranchId) return false;
    const id = item.device.localId;
    if (sendIds.has(id) || mobileIds.has(id) || customerIds.has(id)) return false;

    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    return (
      status === "received_at_branch" ||
      status === "excluded_from_shipment" ||
      status === "maintenance_failed"
    );
  });
}

export function getBranchDailyWorkQueues(opsBranchId: string): BranchDailyWorkQueues {
  return {
    customersAtBranch: listCustomersAtBranch(opsBranchId),
    sendToService: listSendToService(opsBranchId),
    incomingFromService: listIncomingFromService(opsBranchId),
    handToMobile: listHandToMobile(opsBranchId),
    handToCustomer: listHandToCustomer(opsBranchId),
  };
}

export function getBranchDailyWorkCounts(opsBranchId: string): BranchDailyWorkCounts {
  const q = getBranchDailyWorkQueues(opsBranchId);
  return {
    customersAtBranch: q.customersAtBranch.length,
    sendToService: q.sendToService.length,
    incomingFromService: q.incomingFromService.length,
    handToMobile: q.handToMobile.length,
    handToCustomer: q.handToCustomer.length,
  };
}

// ---------------------------------------------------------------------------
// Maintenance manager
// ---------------------------------------------------------------------------

export type ManagerWorkQueueItem = TechnicianQueueItem & {
  decisionReason?: string;
  priority?: "urgent" | "normal";
  maintenancePhase?: "waiting" | "in_progress";
};

export type ManagerDailyWorkCounts = {
  branchesNeedMaintenance: number;
  needMaintenanceDecision: number;
  lowStockParts: number;
  replacedDevicesStock: number;
  readyToReturnToBranches: number;
  deliveringToBranches: number;
  needReceiveAtService: number;
  inMaintenance: number;
};

export function countLowStockParts(): number {
  return listInventoryBalances().filter((item) => {
    const min =
      typeof item.minimumQuantity === "number" && Number.isFinite(item.minimumQuantity)
        ? item.minimumQuantity
        : DEFAULT_MINIMUM_QUANTITY;
    return item.quantity <= min;
  }).length;
}

export function listBranchesNeedMaintenance(): TechnicianQueueItem[] {
  const readyIds = new Set(listBranchesReadyToShip().map((row) => row.branchId));
  if (readyIds.size === 0) return [];
  const byId = new Map<string, TechnicianQueueItem>();
  for (const branchId of readyIds) {
    for (const item of listDevicesEligibleForShipment(branchId)) {
      byId.set(item.device.localId, item);
    }
  }
  return [...byId.values()];
}

/** Latest work-record note for manager decision lists. */
export function getLatestDecisionReason(
  requestId: string,
  deviceLocalId: string,
): string | undefined {
  const work = listTechnicianWork();
  let latest: TechnicianWorkRecord | undefined;
  for (const record of work) {
    if (record.requestId !== requestId) continue;
    if (record.deviceLocalId !== deviceLocalId) continue;
    if (record.status !== "held" && record.status !== "completed") continue;
    if (!latest) {
      latest = record;
      continue;
    }
    const a = latest.finishedAt ?? latest.startedAt;
    const b = record.finishedAt ?? record.startedAt;
    if (b.localeCompare(a) > 0) latest = record;
  }
  if (!latest) return undefined;
  return formatDecisionReason(latest);
}

/** One pass over work records → latest decision reason per device (for list screens). */
function buildLatestDecisionReasonMap(): Map<string, string> {
  const latestByKey = new Map<string, TechnicianWorkRecord>();
  for (const record of listTechnicianWork()) {
    if (record.status !== "held" && record.status !== "completed") continue;
    const key = `${record.requestId}::${record.deviceLocalId}`;
    const prev = latestByKey.get(key);
    if (!prev) {
      latestByKey.set(key, record);
      continue;
    }
    const a = prev.finishedAt ?? prev.startedAt;
    const b = record.finishedAt ?? record.startedAt;
    if (b.localeCompare(a) > 0) latestByKey.set(key, record);
  }
  const reasons = new Map<string, string>();
  for (const [key, record] of latestByKey) {
    const reason = formatDecisionReason(record);
    if (reason) reasons.set(key, reason);
  }
  return reasons;
}

function formatDecisionReason(record: TechnicianWorkRecord): string | undefined {
  const parts: string[] = [];
  if (record.status === "held" && record.holdReason) {
    const label = HOLD_REASON_LABELS[record.holdReason] ?? record.holdReason;
    parts.push(label);
    if (record.holdReason === "other" && record.holdOtherNote?.trim()) {
      parts.push(record.holdOtherNote.trim());
    }
  } else if (record.outcome) {
    parts.push(OUTCOME_LABELS[record.outcome] ?? record.outcome);
  }
  if (record.faultCause?.trim()) parts.push(record.faultCause.trim());
  return parts.length ? parts.join(" — ") : undefined;
}

export function listNeedMaintenanceDecision(): ManagerWorkQueueItem[] {
  const reasons = buildLatestDecisionReasonMap();
  return listAllRequestDevices()
    .filter((item) => {
      const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
      return status === "awaiting_manager_decision" || status === "maintenance_failed";
    })
    .map((item) => ({
      ...item,
      decisionReason: reasons.get(`${item.request.id}::${item.device.localId}`),
    }));
}

export function listReadyToReturnToBranches(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(
    (item) =>
      normalizeLifecycleStatus(item.device.lifecycleStatus) === "ready_to_return",
  );
}

export function listDeliveringToBranches(): TechnicianQueueItem[] {
  const byId = new Map<string, TechnicianQueueItem>();

  for (const item of listAllRequestDevices()) {
    if (normalizeLifecycleStatus(item.device.lifecycleStatus) === "in_return_transit") {
      byId.set(item.device.localId, item);
    }
  }

  for (const batch of listShippingBatches()) {
    if (batch.direction !== "return") continue;
    if (!["ready", "draft", "handed_to_carrier"].includes(batch.status)) continue;
    for (const batchItem of batch.items.filter((row) => row.status === "active")) {
      const match = findQueueItemByDeviceId(
        batchItem.requestDeviceId,
        batchItem.deviceCode,
      );
      if (match) byId.set(match.device.localId, match);
    }
  }

  return [...byId.values()];
}

export function listNeedReceiveAtService(): TechnicianQueueItem[] {
  const byId = new Map<string, TechnicianQueueItem>();

  for (const item of listAllRequestDevices()) {
    if (
      normalizeLifecycleStatus(item.device.lifecycleStatus) === "in_transit_to_service"
    ) {
      byId.set(item.device.localId, item);
    }
  }

  for (const batch of listShippingBatches()) {
    if (batch.direction !== "to_service") continue;
    if (batch.status !== "handed_to_carrier") continue;
    for (const batchItem of batch.items.filter((row) => row.status === "active")) {
      const match = findQueueItemByDeviceId(
        batchItem.requestDeviceId,
        batchItem.deviceCode,
      );
      if (match) byId.set(match.device.localId, match);
    }
  }

  return [...byId.values()];
}

/** Service-center path: awaiting_maintenance | in_maintenance */
export function listInMaintenance(): ManagerWorkQueueItem[] {
  return listAllRequestDevices()
    .filter((item) => {
      const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
      if (status !== "awaiting_maintenance" && status !== "in_maintenance") {
        return false;
      }
      return getDeviceAssignmentPath(item.request, item.device) === "service_center";
    })
    .map((item) => {
      const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
      return {
        ...item,
        priority: item.request.priority === "urgent" ? "urgent" : "normal",
        maintenancePhase: status === "in_maintenance" ? "in_progress" : "waiting",
      };
    });
}

export function getManagerDailyWorkCounts(): ManagerDailyWorkCounts {
  // Cheap counters only — never build full queue lists or decision-reason maps here.
  // Building those on every hydrate notify previously exhausted tab memory (Out of Memory).
  let needMaintenanceDecision = 0;
  let readyToReturnToBranches = 0;
  let deliveringStatus = 0;
  let needReceiveStatus = 0;
  let inMaintenance = 0;

  for (const item of listAllRequestDevices()) {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status === "awaiting_manager_decision" || status === "maintenance_failed") {
      needMaintenanceDecision += 1;
    }
    if (status === "ready_to_return") readyToReturnToBranches += 1;
    if (status === "in_return_transit") deliveringStatus += 1;
    if (status === "in_transit_to_service") needReceiveStatus += 1;
    if (
      (status === "awaiting_maintenance" || status === "in_maintenance") &&
      getDeviceAssignmentPath(item.request, item.device) === "service_center"
    ) {
      inMaintenance += 1;
    }
  }

  const deliveringIds = new Set<string>();
  const receiveIds = new Set<string>();
  for (const batch of listShippingBatches()) {
    if (batch.direction === "return" && ["ready", "draft", "handed_to_carrier"].includes(batch.status)) {
      for (const row of batch.items) {
        if (row.status === "active") deliveringIds.add(row.requestDeviceId);
      }
    }
    if (batch.direction === "to_service" && batch.status === "handed_to_carrier") {
      for (const row of batch.items) {
        if (row.status === "active") receiveIds.add(row.requestDeviceId);
      }
    }
  }

  return {
    branchesNeedMaintenance: listBranchesReadyToShip().reduce(
      (sum, row) => sum + row.readyCount,
      0,
    ),
    needMaintenanceDecision,
    lowStockParts: countLowStockParts(),
    replacedDevicesStock: totalReplacedDevicesQuantity(),
    readyToReturnToBranches,
    deliveringToBranches: Math.max(deliveringStatus, deliveringIds.size),
    needReceiveAtService: Math.max(needReceiveStatus, receiveIds.size),
    inMaintenance,
  };
}

// ---------------------------------------------------------------------------
// Technician
// ---------------------------------------------------------------------------

export type TechnicianHomeQueues = {
  waitingQueue: TechnicianQueueItem[];
  myRepairedDevices: Array<
    TechnicianWorkRecord & {
      resultKind: "success" | "failure";
      resultLabel: string;
    }
  >;
};

export function getTechnicianHomeQueues(technician: Profile): TechnicianHomeQueues {
  const waitingQueue = getEligibleQueueForTechnician(technician);
  const myRepairedDevices = listTechnicianWork()
    .filter(
      (record) =>
        record.technicianId === technician.id &&
        (record.status === "completed" || record.status === "held"),
    )
    .sort((a, b) =>
      (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt),
    )
    .map((record) => ({
      ...record,
      resultKind: classifyWorkResult(record),
      resultLabel: workResultLabel(record),
    }));

  return { waitingQueue, myRepairedDevices };
}
