/**
 * Delay / SLA-ish alerts derived from existing lifecycle + stage dates.
 */
import {
  deviceStatusLabel,
  listAllRequestDevices,
  normalizeLifecycleStatus,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import {
  daysBetween,
  getDeviceStageStartedAt,
  hoursBetween,
  latestWorkForDevice,
  TERMINAL_LIFECYCLE_STATUSES,
} from "@/lib/device-stage";
import { listPickupReceipts } from "@/lib/pickup-receipt-store";
import { listShippingBatches } from "@/lib/shipping-store";
import {
  COURIER_PENDING_SLA_HOURS,
  thresholdDaysForStage,
  thresholdHoursForStage,
} from "@/lib/sla-thresholds";
import { listTechnicianWork } from "@/lib/technician-store";
import type {
  AppRole,
  DeviceLifecycleStatus,
  DraftRequestDevice,
  PickupReceipt,
  Profile,
  ShippingBatch,
  ShipmentDirection,
} from "@/types/domain";
import {
  isBranchRole,
  isMaintenanceManagerRole,
  isPickupCourierRole,
  isSystemAdminRole,
  isTechnicianRole,
  normalizeRole,
} from "@/lib/auth";

/** Role-queue labels when no named assignee exists (never invent fake people). */
const STUCK_BRANCH_FALLBACK = "الفرع";
const STUCK_TECH_QUEUE = "طابور الفنيين";
const STUCK_TECH_UNNAMED = "فني (غير معيّن)";
const STUCK_MANAGER_QUEUE = "مدير/مشرف الصيانة";
const STUCK_COURIER_QUEUE = "مندوب الاستلام";
const STUCK_CARRIER_FALLBACK = "شركة الشحن";
const STUCK_UNKNOWN = "غير محدد";

const OPEN_PICKUP_FOR_STUCK = new Set([
  "draft",
  "pending_courier",
  "partially_rejected",
  "approved",
  "pending_supervisor",
]);

export type DelayAlertItem = {
  id: string;
  kind: "device" | "receipt";
  title: string;
  subtitle: string;
  statusLabel: string;
  /** Who the workflow is currently waiting on (Arabic label / known name). */
  stuckWith: string;
  stageStartedAt: string;
  daysInStage: number;
  thresholdDays: number;
  daysOverdue: number;
  priority: "urgent" | "normal";
  href: string;
  opsBranchId?: string;
  deviceLocalId?: string;
  requestId?: string;
  lifecycleStatus?: DeviceLifecycleStatus;
};

function branchStuckLabel(opsBranchName?: string | null): string {
  const name = opsBranchName?.trim();
  return name || STUCK_BRANCH_FALLBACK;
}

function technicianStuckLabel(
  assignedTechnicianName?: string | null,
  assignedTechnicianId?: string | null,
  { queueWhenEmpty = false }: { queueWhenEmpty?: boolean } = {},
): string {
  const name = assignedTechnicianName?.trim();
  if (name) return name;
  if (String(assignedTechnicianId ?? "").trim()) return STUCK_TECH_UNNAMED;
  return queueWhenEmpty ? STUCK_TECH_QUEUE : STUCK_TECH_UNNAMED;
}

function findOpenPickupForDevice(
  receipts: PickupReceipt[],
  deviceLocalId: string,
  direction?: PickupReceipt["direction"],
): PickupReceipt | undefined {
  return receipts.find((receipt) => {
    if (direction && receipt.direction !== direction) return false;
    if (!OPEN_PICKUP_FOR_STUCK.has(receipt.status)) return false;
    return receipt.lines.some(
      (line) => line.deviceLocalId === deviceLocalId && line.status !== "rejected",
    );
  });
}

function findActiveTransitBatch(
  batches: ShippingBatch[],
  device: DraftRequestDevice,
  direction: ShipmentDirection,
): ShippingBatch | undefined {
  return batches
    .filter(
      (batch) =>
        batch.direction === direction &&
        ["ready", "draft", "handed_to_carrier"].includes(batch.status) &&
        batch.items.some(
          (item) =>
            item.status === "active" &&
            (item.requestDeviceId === device.localId ||
              item.deviceCode === device.deviceCode),
        ),
    )
    .sort((a, b) =>
      (b.handedToCarrierAt ?? b.createdAt).localeCompare(
        a.handedToCarrierAt ?? a.createdAt,
      ),
    )[0];
}

function transitStuckLabel(input: {
  courierName?: string | null;
  carrierName?: string | null;
  fallback: string;
}): string {
  const courier = input.courierName?.trim();
  if (courier) return courier;
  const carrier = input.carrierName?.trim();
  if (carrier) return carrier;
  return input.fallback;
}

/**
 * Derive «متوقف عند» from lifecycle stage + known assignment fields.
 * Uses real names when present; otherwise role-queue labels — never invents people.
 */
export function resolveDelayStuckWith(input: {
  kind: "device" | "receipt";
  lifecycleStatus?: DeviceLifecycleStatus | null;
  opsBranchName?: string | null;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  courierName?: string | null;
  carrierName?: string | null;
}): string {
  if (input.kind === "receipt") {
    return input.courierName?.trim() || STUCK_COURIER_QUEUE;
  }

  const status = normalizeLifecycleStatus(input.lifecycleStatus);
  switch (status) {
    case "received_at_branch":
    case "ready_to_send":
    case "excluded_from_shipment":
    case "excluded":
    case "awaiting_customer":
    case "awaiting_branch_handover":
      return branchStuckLabel(input.opsBranchName);

    case "in_maintenance_at_branch":
      return technicianStuckLabel(
        input.assignedTechnicianName,
        input.assignedTechnicianId,
        { queueWhenEmpty: false },
      );

    case "awaiting_maintenance":
    case "at_service_center":
    case "received_at_warehouse":
      return technicianStuckLabel(
        input.assignedTechnicianName,
        input.assignedTechnicianId,
        { queueWhenEmpty: true },
      );

    case "in_maintenance":
    case "under_maintenance":
      return technicianStuckLabel(
        input.assignedTechnicianName,
        input.assignedTechnicianId,
        { queueWhenEmpty: false },
      );

    case "awaiting_manager_decision":
    case "maintenance_failed":
    case "ready_to_return":
      return STUCK_MANAGER_QUEUE;

    case "in_transit_to_service":
      return transitStuckLabel({
        courierName: input.courierName,
        carrierName: input.carrierName,
        fallback: STUCK_COURIER_QUEUE,
      });

    case "in_return_transit":
      return transitStuckLabel({
        courierName: input.courierName,
        carrierName: input.carrierName,
        fallback: branchStuckLabel(input.opsBranchName),
      });

    default:
      return (
        input.assignedTechnicianName?.trim() ||
        branchStuckLabel(input.opsBranchName) ||
        STUCK_UNKNOWN
      );
  }
}

function stuckWithForDeviceItem(
  item: TechnicianQueueItem,
  batches: ShippingBatch[],
  receipts: PickupReceipt[],
): string {
  const status = normalizeLifecycleStatus(item.device.lifecycleStatus);

  if (status === "in_transit_to_service") {
    const pickup = findOpenPickupForDevice(
      receipts,
      item.device.localId,
      "branch_to_center",
    );
    const batch = findActiveTransitBatch(batches, item.device, "to_service");
    return transitStuckLabel({
      courierName: pickup?.assignedCourierName,
      carrierName: batch?.carrier?.trim() || (batch ? STUCK_CARRIER_FALLBACK : null),
      fallback: STUCK_COURIER_QUEUE,
    });
  }

  if (status === "in_return_transit") {
    const pickup = findOpenPickupForDevice(
      receipts,
      item.device.localId,
      "center_to_branch",
    );
    const batch = findActiveTransitBatch(batches, item.device, "return");
    return transitStuckLabel({
      courierName: pickup?.assignedCourierName,
      carrierName: batch?.carrier?.trim() || (batch ? STUCK_CARRIER_FALLBACK : null),
      fallback: branchStuckLabel(item.request.opsBranchName),
    });
  }

  return resolveDelayStuckWith({
    kind: "device",
    lifecycleStatus: status,
    opsBranchName: item.request.opsBranchName,
    assignedTechnicianId: item.device.assignedTechnicianId,
    assignedTechnicianName: item.device.assignedTechnicianName,
  });
}

function deviceDetailHref(deviceLocalId: string) {
  return `/devices/detail/?id=${encodeURIComponent(deviceLocalId)}`;
}

function requestDetailHref(requestId: string) {
  return `/service-requests/detail/?id=${encodeURIComponent(requestId)}`;
}

function evaluateDevice(
  item: TechnicianQueueItem,
  batches: ShippingBatch[],
  receipts: PickupReceipt[],
  workAll: ReturnType<typeof listTechnicianWork>,
): DelayAlertItem | null {
  const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
  if (TERMINAL_LIFECYCLE_STATUSES.has(status)) return null;

  const thresholdHours = thresholdHoursForStage(status, item.request.priority);
  if (thresholdHours == null) return null;

  const work = latestWorkForDevice(workAll, item.request.id, item.device.localId);
  const stageStartedAt = getDeviceStageStartedAt({
    request: item.request,
    device: item.device,
    batches,
    work,
  });
  const hoursInStage = hoursBetween(stageStartedAt);
  // Overdue when ≥ threshold hours since last stage entry (default 24h; urgent shorter).
  if (hoursInStage < thresholdHours) return null;

  const thresholdDays = thresholdDaysForStage(status, item.request.priority) ?? thresholdHours / 24;
  const daysInStage = daysBetween(stageStartedAt);
  const daysOverdue = Math.max(0, Math.floor((hoursInStage - thresholdHours) / 24));
  const priority = item.request.priority === "urgent" ? "urgent" : "normal";
  return {
    id: `device:${item.device.localId}`,
    kind: "device",
    title: item.device.deviceCode,
    subtitle: `${item.request.requestNumber} · ${item.request.contactName} · ${item.request.opsBranchName}`,
    statusLabel: deviceStatusLabel(status, "technician"),
    stuckWith: stuckWithForDeviceItem(item, batches, receipts),
    stageStartedAt,
    daysInStage,
    thresholdDays,
    daysOverdue,
    priority,
    href: deviceDetailHref(item.device.localId),
    opsBranchId: item.request.opsBranchId,
    deviceLocalId: item.device.localId,
    requestId: item.request.id,
    lifecycleStatus: status,
  };
}

/** All currently overdue devices (optional branch scope). Used by dashboard + delay reports. */
export function listAllDeviceDelayAlerts(opsBranchId?: string | null): DelayAlertItem[] {
  const items = listAllRequestDevices().filter((row) =>
    opsBranchId ? row.request.opsBranchId === opsBranchId : true,
  );
  const batches = listShippingBatches();
  const receipts = listPickupReceipts();
  const workAll = listTechnicianWork();
  const alerts: DelayAlertItem[] = [];
  for (const item of items) {
    const alert = evaluateDevice(item, batches, receipts, workAll);
    if (alert) alerts.push(alert);
  }
  return alerts.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    return b.daysOverdue - a.daysOverdue;
  });
}

function listCourierReceiptDelayAlerts(courierId?: string | null): DelayAlertItem[] {
  const receipts = listPickupReceipts(
    courierId
      ? { courierId, statuses: ["pending_courier"] }
      : { statuses: ["pending_courier"] },
  );

  const alerts: DelayAlertItem[] = [];
  const thresholdDays = COURIER_PENDING_SLA_HOURS / 24;
  for (const receipt of receipts) {
    const started = receipt.submittedAt || receipt.createdAt;
    const hoursInStage = hoursBetween(started);
    if (hoursInStage < COURIER_PENDING_SLA_HOURS) continue;
    const daysInStage = daysBetween(started);
    alerts.push({
      id: `receipt:${receipt.id}`,
      kind: "receipt",
      title: receipt.receiptNumber,
      subtitle: `${receipt.opsBranchName} · ${receipt.lines.length} جهاز`,
      statusLabel: "بانتظار مراجعة المندوب",
      stuckWith: resolveDelayStuckWith({
        kind: "receipt",
        courierName: receipt.assignedCourierName,
      }),
      stageStartedAt: started,
      daysInStage,
      thresholdDays,
      daysOverdue: Math.max(
        0,
        Math.floor((hoursInStage - COURIER_PENDING_SLA_HOURS) / 24),
      ),
      priority: "normal",
      href: "/courier/receipts",
      opsBranchId: receipt.opsBranchId,
    });
  }
  return alerts.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Branch-relevant overdue stages (things the branch can act on). */
const BRANCH_OVERDUE_STATUSES = new Set<DeviceLifecycleStatus>([
  "received_at_branch",
  "ready_to_send",
  "excluded_from_shipment",
  "in_return_transit",
  "awaiting_customer",
  "maintenance_failed",
  "in_maintenance_at_branch",
]);

/** Technician-relevant overdue stages. */
const TECH_OVERDUE_STATUSES = new Set<DeviceLifecycleStatus>([
  "awaiting_maintenance",
  "in_maintenance",
  "in_maintenance_at_branch",
]);

/**
 * Role-aware overdue list for dashboard strip / my-tasks.
 */
export function listDelayAlertsForUser(user: Profile): DelayAlertItem[] {
  const role = normalizeRole(user.role) as AppRole;

  if (isPickupCourierRole(role)) {
    return listCourierReceiptDelayAlerts(user.id);
  }

  if (isBranchRole(role)) {
    return listAllDeviceDelayAlerts(user.opsBranchId).filter(
      (a) => a.lifecycleStatus && BRANCH_OVERDUE_STATUSES.has(a.lifecycleStatus),
    );
  }

  if (isTechnicianRole(role)) {
    const byId = new Map(
      listAllRequestDevices().map((row) => [row.device.localId, row] as const),
    );
    return listAllDeviceDelayAlerts().filter((a) => {
      if (!a.lifecycleStatus || !TECH_OVERDUE_STATUSES.has(a.lifecycleStatus)) {
        return false;
      }
      // Prefer devices assigned to this tech, or unassigned waiting queue.
      const match = a.deviceLocalId ? byId.get(a.deviceLocalId) : undefined;
      if (!match) return false;
      const assigned = String(match.device.assignedTechnicianId ?? "").trim();
      if (!assigned) return true;
      return assigned === user.id;
    });
  }

  if (
    isMaintenanceManagerRole(role) ||
    isSystemAdminRole(role) ||
    role === "maintenance_supervisor" ||
    role === "supervisor" ||
    role === "manager"
  ) {
    return listAllDeviceDelayAlerts();
  }

  return listAllDeviceDelayAlerts();
}

export function countDelayAlertsForUser(user: Profile): number {
  return listDelayAlertsForUser(user).length;
}

export type DelayAlertsSummary = {
  total: number;
  urgent: number;
  preview: DelayAlertItem[];
};

export function getDelayAlertsSummary(
  user: Profile,
  previewLimit = 5,
): DelayAlertsSummary {
  const all = listDelayAlertsForUser(user);
  return {
    total: all.length,
    urgent: all.filter((a) => a.priority === "urgent").length,
    preview: all.slice(0, previewLimit),
  };
}
