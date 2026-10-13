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
  latestWorkForDevice,
  TERMINAL_LIFECYCLE_STATUSES,
} from "@/lib/device-stage";
import { listPickupReceipts } from "@/lib/pickup-receipt-store";
import { listShippingBatches } from "@/lib/shipping-store";
import { COURIER_PENDING_SLA_DAYS, thresholdDaysForStage } from "@/lib/sla-thresholds";
import { listTechnicianWork } from "@/lib/technician-store";
import type { AppRole, DeviceLifecycleStatus, Profile } from "@/types/domain";
import {
  isBranchRole,
  isMaintenanceManagerRole,
  isPickupCourierRole,
  isSystemAdminRole,
  isTechnicianRole,
  normalizeRole,
} from "@/lib/auth";

export type DelayAlertItem = {
  id: string;
  kind: "device" | "receipt";
  title: string;
  subtitle: string;
  statusLabel: string;
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

function deviceDetailHref(deviceLocalId: string) {
  return `/devices/detail/?id=${encodeURIComponent(deviceLocalId)}`;
}

function requestDetailHref(requestId: string) {
  return `/service-requests/detail/?id=${encodeURIComponent(requestId)}`;
}

function evaluateDevice(
  item: TechnicianQueueItem,
  batches: ReturnType<typeof listShippingBatches>,
  workAll: ReturnType<typeof listTechnicianWork>,
): DelayAlertItem | null {
  const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
  if (TERMINAL_LIFECYCLE_STATUSES.has(status)) return null;

  const threshold = thresholdDaysForStage(status, item.request.priority);
  if (threshold == null) return null;

  const work = latestWorkForDevice(workAll, item.request.id, item.device.localId);
  const stageStartedAt = getDeviceStageStartedAt({
    request: item.request,
    device: item.device,
    batches,
    work,
  });
  const daysInStage = daysBetween(stageStartedAt);
  if (daysInStage < threshold) return null;

  const priority = item.request.priority === "urgent" ? "urgent" : "normal";
  return {
    id: `device:${item.device.localId}`,
    kind: "device",
    title: item.device.deviceCode,
    subtitle: `${item.request.requestNumber} · ${item.request.contactName} · ${item.request.opsBranchName}`,
    statusLabel: deviceStatusLabel(status, "technician"),
    stageStartedAt,
    daysInStage,
    thresholdDays: threshold,
    daysOverdue: daysInStage - threshold,
    priority,
    href: deviceDetailHref(item.device.localId),
    opsBranchId: item.request.opsBranchId,
    deviceLocalId: item.device.localId,
    requestId: item.request.id,
    lifecycleStatus: status,
  };
}

function listAllDeviceDelayAlerts(opsBranchId?: string | null): DelayAlertItem[] {
  const items = listAllRequestDevices().filter((row) =>
    opsBranchId ? row.request.opsBranchId === opsBranchId : true,
  );
  const batches = listShippingBatches();
  const workAll = listTechnicianWork();
  const alerts: DelayAlertItem[] = [];
  for (const item of items) {
    const alert = evaluateDevice(item, batches, workAll);
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
  for (const receipt of receipts) {
    const started = receipt.submittedAt || receipt.createdAt;
    const daysInStage = daysBetween(started);
    if (daysInStage < COURIER_PENDING_SLA_DAYS) continue;
    alerts.push({
      id: `receipt:${receipt.id}`,
      kind: "receipt",
      title: receipt.receiptNumber,
      subtitle: `${receipt.opsBranchName} · ${receipt.lines.length} جهاز`,
      statusLabel: "بانتظار مراجعة المندوب",
      stageStartedAt: started,
      daysInStage,
      thresholdDays: COURIER_PENDING_SLA_DAYS,
      daysOverdue: daysInStage - COURIER_PENDING_SLA_DAYS,
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
