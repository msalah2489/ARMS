import {
  listAllRequestDevices,
  listMaintenanceRequests,
  updateDeviceLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import type {
  Profile,
  ShippingBatch,
  ShippingBatchItem,
} from "@/types/domain";

const BATCHES_KEY = "arms_shipping_batches_v1";
const AUDIT_KEY = "arms_audit_events_v1";
const RECEIVE_MIGRATION_KEY = "arms_migrate_receive_v1";

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

function markDevicesAwaitingMaintenance(requestDeviceIds: string[]) {
  for (const deviceId of requestDeviceIds) {
    const match = listAllRequestDevices().find((row) => row.device.localId === deviceId);
    if (!match) continue;
    const status = match.device.lifecycleStatus ?? "";
    if (["awaiting_maintenance", "in_maintenance", "under_maintenance"].includes(status)) {
      continue;
    }
    updateDeviceLifecycle(match.request.id, match.device.localId, {
      lifecycleStatus: "awaiting_maintenance",
      currentLocation: "service_center",
      lockedAfterShip: true,
    });
  }
}

/**
 * One-time: apply receive status to previously saved waybills (ready / handed_to_carrier)
 * so devices become جاهز للصيانة for technicians and في الصيانة for branches.
 */
export function migrateExistingShippingToReceived() {
  if (typeof window === "undefined") return;
  if (readJson(RECEIVE_MIGRATION_KEY, false)) {
    // Keep received batches' devices in sync even after migration flag is set.
    const batches = readJson<ShippingBatch[]>(BATCHES_KEY, []);
    for (const batch of batches) {
      if (batch.status !== "received") continue;
      markDevicesAwaitingMaintenance(
        batch.items.filter((item) => item.status === "active").map((item) => item.requestDeviceId),
      );
    }
    return;
  }

  const all = readJson<ShippingBatch[]>(BATCHES_KEY, []);
  let changed = false;

  for (const batch of all) {
    if (!["ready", "handed_to_carrier", "received"].includes(batch.status)) continue;
    const activeIds = batch.items
      .filter((item) => item.status === "active")
      .map((item) => item.requestDeviceId);
    if (!activeIds.length) continue;

    if (batch.status === "ready" || batch.status === "handed_to_carrier") {
      batch.status = "received";
      batch.receivedAt = batch.receivedAt ?? new Date().toISOString();
      batch.receivedByName = batch.receivedByName ?? "ترحيل بيانات سابقة";
      changed = true;
    }

    markDevicesAwaitingMaintenance(activeIds);
  }

  if (changed) writeJson(BATCHES_KEY, all);
  writeJson(RECEIVE_MIGRATION_KEY, true);
  writeAudit({
    actorId: "system",
    actorName: "ترحيل",
    action: "migrate_existing_shipping_to_received",
    entityType: "shipping_batch",
    entityId: "all",
    after: { migrated: true },
  });
}

function writeAudit(input: {
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  const all = readJson<Array<Record<string, unknown>>>(AUDIT_KEY, []);
  all.unshift({
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  });
  writeJson(AUDIT_KEY, all.slice(0, 500));
}

export function listShippingBatches(opsBranchId?: string | null) {
  migrateExistingShippingToReceived();
  const all = readJson<ShippingBatch[]>(BATCHES_KEY, []);
  if (!opsBranchId) return all;
  return all.filter((batch) => batch.opsBranchId === opsBranchId);
}

export function getShippingBatch(id: string) {
  return listShippingBatches().find((batch) => batch.id === id) ?? null;
}

/** Devices at branch that are not locked and not on an active batch. */
export function listDevicesEligibleForShipment(opsBranchId: string): TechnicianQueueItem[] {
  const activeDeviceIds = new Set(
    listShippingBatches()
      .flatMap((batch) => batch.items)
      .filter((item) => item.status === "active")
      .map((item) => item.requestDeviceId),
  );

  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (activeDeviceIds.has(device.localId)) return false;
    const status = device.lifecycleStatus ?? "received_at_branch";
    return [
      "received_at_branch",
      "awaiting_branch_handover",
      "excluded_from_shipment",
      "excluded",
      "ready_to_ship",
    ].includes(status);
  });
}

export function createShippingBatch(input: {
  user: Profile;
  shipmentNumber: string;
  carrier: string;
  opsBranchId: string;
  sourceName: string;
  deviceLocalIds: string[];
  notes?: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["maintenance_manager", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "إنشاء البوليصة مسموح لمدير الصيانة فقط." };
  }
  if (!input.shipmentNumber.trim() || !input.carrier.trim()) {
    return { ok: false, error: "رقم البوليصة وشركة الشحن إلزاميان." };
  }
  if (!input.deviceLocalIds.length) {
    return { ok: false, error: "اختر جهازًا واحدًا على الأقل." };
  }

  const eligible = listDevicesEligibleForShipment(input.opsBranchId);
  const selected = eligible.filter((item) => input.deviceLocalIds.includes(item.device.localId));
  if (selected.length !== input.deviceLocalIds.length) {
    return { ok: false, error: "أحد الأجهزة غير متاح للشحن أو مرتبط ببوليصة نشطة." };
  }

  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900000 + 100000);
  const items: ShippingBatchItem[] = selected.map(({ device }) => ({
    id: crypto.randomUUID(),
    requestDeviceId: device.localId,
    deviceCode: device.deviceCode,
    modelName: device.modelName,
    color: device.color ?? "",
    status: "active",
  }));

  const batch: ShippingBatch = {
    id: crypto.randomUUID(),
    batchNumber: `SB-${year}-${seq}`,
    shipmentNumber: input.shipmentNumber.trim(),
    carrier: input.carrier.trim(),
    direction: "to_service",
    sourceType: "branch",
    sourceName: input.sourceName,
    opsBranchId: input.opsBranchId,
    destinationType: "service_center",
    destinationName: "مركز الصيانة",
    status: "ready",
    createdBy: input.user.id,
    createdByName: input.user.fullName,
    createdAt: new Date().toISOString(),
    notes: input.notes?.trim() || undefined,
    items,
  };

  for (const item of selected) {
    updateDeviceLifecycle(item.request.id, item.device.localId, {
      lifecycleStatus: "awaiting_branch_handover",
      currentLocation: "branch",
    });
  }

  const all = listShippingBatches();
  writeJson(BATCHES_KEY, [batch, ...all]);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "create_shipping_batch",
    entityType: "shipping_batch",
    entityId: batch.id,
    after: { shipmentNumber: batch.shipmentNumber, deviceCount: items.length },
  });

  return { ok: true, batch };
}

export function removeDeviceFromShippingBatch(input: {
  user: Profile;
  batchId: string;
  itemId: string;
  reason: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  if (!input.reason.trim()) return { ok: false, error: "سبب الاستبعاد إلزامي." };

  const role = input.user.role;
  if (!["branch", "branch_employee", "maintenance_manager", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "غير مصرح بالاستبعاد." };
  }

  const all = listShippingBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.status === "handed_to_carrier") {
    return { ok: false, error: "لا يمكن الاستبعاد بعد التسليم لشركة الشحن." };
  }

  const item = batch.items.find((row) => row.id === input.itemId);
  if (!item || item.status !== "active") return { ok: false, error: "الجهاز غير موجود في البوليصة." };

  item.status = "removed";
  item.removedAt = new Date().toISOString();
  item.removedBy = input.user.id;
  item.removalReason = input.reason.trim();

  const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
  if (match) {
    updateDeviceLifecycle(match.request.id, match.device.localId, {
      lifecycleStatus: "excluded_from_shipment",
      currentLocation: "branch",
    });
  }

  writeJson(BATCHES_KEY, all);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "remove_device_from_batch",
    entityType: "shipping_batch_item",
    entityId: item.id,
    after: { reason: input.reason },
  });

  return { ok: true, batch };
}

export function confirmHandedToCarrier(input: {
  user: Profile;
  batchId: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["branch", "branch_employee", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "تأكيد التسليم للشحن مسموح لموظف الفرع." };
  }

  const all = listShippingBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.status === "handed_to_carrier") {
    return { ok: false, error: "تم تأكيد التسليم مسبقًا." };
  }
  if (!["ready", "draft"].includes(batch.status)) {
    return { ok: false, error: "حالة البوليصة لا تسمح بالتسليم." };
  }

  const activeItems = batch.items.filter((item) => item.status === "active");
  if (!activeItems.length) {
    return { ok: false, error: "لا توجد أجهزة نشطة على البوليصة." };
  }

  batch.status = "handed_to_carrier";
  batch.handedToCarrierAt = new Date().toISOString();
  batch.handedToCarrierBy = input.user.id;

  for (const item of activeItems) {
    const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
    if (match) {
      updateDeviceLifecycle(match.request.id, match.device.localId, {
        lifecycleStatus: "in_transit_to_service",
        currentLocation: "in_transit_to_service",
        lockedAfterShip: true,
      });
    }
  }

  writeJson(BATCHES_KEY, all);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "confirm_handed_to_carrier",
    entityType: "shipping_batch",
    entityId: batch.id,
    after: { status: "handed_to_carrier" },
  });

  return { ok: true, batch };
}

/** Maintenance manager receives devices that arrived at the service center. */
export function confirmReceivedAtService(input: {
  user: Profile;
  batchId: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["maintenance_manager", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "استلام البوليصة مسموح لمدير الصيانة فقط." };
  }

  const all = listShippingBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.status === "received") {
    return { ok: false, error: "تم استلام هذه البوليصة مسبقًا." };
  }
  if (!["ready", "handed_to_carrier"].includes(batch.status)) {
    return {
      ok: false,
      error: "حالة البوليصة لا تسمح بالاستلام.",
    };
  }

  const activeItems = batch.items.filter((item) => item.status === "active");
  if (!activeItems.length) {
    return { ok: false, error: "لا توجد أجهزة نشطة على البوليصة." };
  }

  batch.status = "received";
  batch.receivedAt = new Date().toISOString();
  batch.receivedBy = input.user.id;
  batch.receivedByName = input.user.fullName;

  for (const item of activeItems) {
    const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
    if (match) {
      updateDeviceLifecycle(match.request.id, match.device.localId, {
        lifecycleStatus: "awaiting_maintenance",
        currentLocation: "service_center",
        lockedAfterShip: true,
      });
    }
  }

  writeJson(BATCHES_KEY, all);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "confirm_received_at_service",
    entityType: "shipping_batch",
    entityId: batch.id,
    after: { status: "received", deviceCount: activeItems.length },
  });

  return { ok: true, batch };
}

export function listOpsBranches() {
  const fromRequests = listMaintenanceRequests().map((request) => ({
    id: request.opsBranchId,
    name: request.opsBranchName,
  }));
  const map = new Map(fromRequests.map((item) => [item.id, item]));
  if (!map.has("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1")) {
    map.set("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      name: "فرع الرياض",
    });
  }
  return [...map.values()];
}

export const SHIPPING_BATCH_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  ready: "جاهزة للتسليم",
  handed_to_carrier: "تم التسليم للشحن",
  received: "مستلمة",
  cancelled: "ملغاة",
};
