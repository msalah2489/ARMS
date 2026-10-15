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

/** Place labels (where the device sits in the workflow). */
const PLACE_BRANCH = "الفرع";
const PLACE_SERVICE_CENTER = "مركز الصيانة";
const PLACE_COURIER = "مندوب الاستلام";
const PLACE_CARRIER = "شركة الشحن";
const PLACE_UNKNOWN = "غير محدد";

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
  /**
   * Arabic «متوقف عند» body: place + what is awaited
   * (e.g. «مركز الصيانة وبانتظار أحد الفنيين للبدء في الصيانة»).
   */
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

/** «الفرع» or «الفرع (الحرم)» when a branch name is known. */
function branchPlace(opsBranchName?: string | null): string {
  const name = opsBranchName?.trim();
  return name ? `${PLACE_BRANCH} (${name})` : PLACE_BRANCH;
}

/** Compose «place وبانتظار action», optionally naming a person in the place. */
function stuckPhrase(
  place: string,
  waitingFor: string,
  namedPerson?: string | null,
): string {
  const person = namedPerson?.trim();
  const where = person ? `${place} · ${person}` : place;
  return `${where} وبانتظار ${waitingFor}`;
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

/** Real technician display name only — never invents people. */
function techDisplayName(assignedTechnicianName?: string | null): string | null {
  return assignedTechnicianName?.trim() || null;
}

function hasTechnicianAssignee(
  assignedTechnicianName?: string | null,
  assignedTechnicianId?: string | null,
): boolean {
  return Boolean(
    assignedTechnicianName?.trim() || String(assignedTechnicianId ?? "").trim(),
  );
}

/**
 * Transit: place = مندوب / شركة شحن (+ name), waiting for arrival.
 */
function transitStuckPhrase(input: {
  courierName?: string | null;
  carrierName?: string | null;
  waitingFor: string;
  /** Used when neither courier nor carrier is known. */
  fallbackPlace: string;
}): string {
  const courier = input.courierName?.trim();
  if (courier) return stuckPhrase(PLACE_COURIER, input.waitingFor, courier);
  const carrier = input.carrierName?.trim();
  if (carrier) {
    const place =
      carrier === PLACE_CARRIER ? PLACE_CARRIER : `${PLACE_CARRIER} (${carrier})`;
    return stuckPhrase(place, input.waitingFor);
  }
  return stuckPhrase(input.fallbackPlace, input.waitingFor);
}

/**
 * Derive «متوقف عند» from lifecycle stage + known assignment fields.
 * Each label states where the device sits and what action is awaited.
 * Uses real names when present; never invents people.
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
    return stuckPhrase(
      PLACE_COURIER,
      "مراجعة سند الاستلام",
      input.courierName,
    );
  }

  const branch = branchPlace(input.opsBranchName);
  const techName = techDisplayName(input.assignedTechnicianName);
  const techAssigned = hasTechnicianAssignee(
    input.assignedTechnicianName,
    input.assignedTechnicianId,
  );
  const status = normalizeLifecycleStatus(input.lifecycleStatus);

  switch (status) {
    case "received_at_branch":
      return stuckPhrase(
        branch,
        "التعيين لفني متنقل أو الإرسال للصيانة",
      );

    case "ready_to_send":
    case "ready_to_ship":
      return stuckPhrase(branch, "الإرسال لمركز الصيانة");

    case "excluded_from_shipment":
    case "excluded":
      return stuckPhrase(branch, "إعادة الإدراج في الشحنة أو قرار الفرع");

    case "awaiting_customer":
      return stuckPhrase(branch, "تسليم الجهاز للعميل");

    case "awaiting_branch_handover":
      return stuckPhrase(branch, "تسليم الجهاز من الفرع");

    case "in_maintenance_at_branch":
      return stuckPhrase(
        branch,
        techAssigned
          ? "استكمال الصيانة الميدانية"
          : "تعيين فني متنقل أو استكمال العمل",
        techName,
      );

    case "awaiting_maintenance":
    case "at_service_center":
    case "received_at_warehouse":
      return stuckPhrase(
        PLACE_SERVICE_CENTER,
        techAssigned
          ? "بدء الفني في الصيانة"
          : "أحد الفنيين للبدء في الصيانة",
        techName,
      );

    case "in_maintenance":
    case "under_maintenance":
      // Prefer «مركز الصيانة · جاري الصيانة» when no named tech yet.
      if (techName) {
        return stuckPhrase(PLACE_SERVICE_CENTER, "استكمال العمل", techName);
      }
      return stuckPhrase(
        `${PLACE_SERVICE_CENTER} · جاري الصيانة`,
        "تعيين فني أو استكمال العمل",
      );

    case "awaiting_manager_decision":
      return stuckPhrase(
        PLACE_SERVICE_CENTER,
        "قرار مدير/مشرف الصيانة",
      );

    case "maintenance_failed":
      return stuckPhrase(
        branch,
        "قرار مدير/مشرف الصيانة بشأن تعذّر الإصلاح",
      );

    case "ready_to_return":
      return stuckPhrase(
        PLACE_SERVICE_CENTER,
        "تجهيز الإرجاع للفرع",
      );

    case "in_transit_to_service":
    case "handed_to_carrier":
    case "in_shipping":
      return transitStuckPhrase({
        courierName: input.courierName,
        carrierName: input.carrierName,
        waitingFor: "الوصول إلى مركز الصيانة",
        fallbackPlace: PLACE_COURIER,
      });

    case "in_return_transit":
    case "returning_from_service":
      return transitStuckPhrase({
        courierName: input.courierName,
        carrierName: input.carrierName,
        waitingFor: "الوصول إلى الفرع",
        fallbackPlace: branch,
      });

    default:
      if (techName) {
        return stuckPhrase(PLACE_SERVICE_CENTER, "استكمال العمل", techName);
      }
      return stuckPhrase(
        branch !== PLACE_BRANCH ? branch : PLACE_UNKNOWN,
        "اتخاذ الإجراء التالي",
      );
  }
}

function stuckWithForDeviceItem(
  item: TechnicianQueueItem,
  batches: ShippingBatch[],
  receipts: PickupReceipt[],
): string {
  const status = normalizeLifecycleStatus(item.device.lifecycleStatus);

  if (
    status === "in_transit_to_service" ||
    status === "handed_to_carrier" ||
    status === "in_shipping"
  ) {
    const pickup = findOpenPickupForDevice(
      receipts,
      item.device.localId,
      "branch_to_center",
    );
    const batch = findActiveTransitBatch(batches, item.device, "to_service");
    return transitStuckPhrase({
      courierName: pickup?.assignedCourierName,
      carrierName: batch?.carrier?.trim() || (batch ? PLACE_CARRIER : null),
      waitingFor: "الوصول إلى مركز الصيانة",
      fallbackPlace: PLACE_COURIER,
    });
  }

  if (status === "in_return_transit" || status === "returning_from_service") {
    const pickup = findOpenPickupForDevice(
      receipts,
      item.device.localId,
      "center_to_branch",
    );
    const batch = findActiveTransitBatch(batches, item.device, "return");
    return transitStuckPhrase({
      courierName: pickup?.assignedCourierName,
      carrierName: batch?.carrier?.trim() || (batch ? PLACE_CARRIER : null),
      waitingFor: "الوصول إلى الفرع",
      fallbackPlace: branchPlace(item.request.opsBranchName),
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
