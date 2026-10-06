import {
  listAllRequestDevices,
  listMaintenanceRequests,
  updateDeviceLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { listBranchOptions } from "@/lib/branches-store";
import { isDemoMode } from "@/lib/auth";
import { pushAppAuditEvents, pushAppShippingBatches } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  BranchReturnReceiveOutcome,
  Profile,
  ShippingBatch,
  ShippingBatchItem,
} from "@/types/domain";

const BATCHES_KEY = "arms_shipping_batches_v1";
const AUDIT_KEY = "arms_audit_events_v1";

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

function schedulePersistBatches(batches: ShippingBatch[]) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppShippingBatches(batches);
}

function schedulePersistAudit(audit: Array<Record<string, unknown>>) {
  if (!isSupabaseConfigured() || isDemoMode()) return;
  void pushAppAuditEvents(audit);
}

export function listShippingBatchesLocal(): ShippingBatch[] {
  return readJson<ShippingBatch[]>(BATCHES_KEY, []);
}

export function listAuditEventsLocal(): Array<Record<string, unknown>> {
  return readJson<Array<Record<string, unknown>>>(AUDIT_KEY, []);
}

export function replaceShippingState(input: {
  batches: ShippingBatch[];
  audit: Array<Record<string, unknown>>;
}) {
  if (typeof window === "undefined") return;
  writeJson(BATCHES_KEY, input.batches);
  writeJson(AUDIT_KEY, input.audit);
}

export function applyRemoteShippingState(input: {
  batches: ShippingBatch[];
  audit: Array<Record<string, unknown>>;
}) {
  replaceShippingState(input);
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
  const next = all.slice(0, 500);
  writeJson(AUDIT_KEY, next);
  schedulePersistAudit(next);
}

function readAllBatches() {
  return readJson<ShippingBatch[]>(BATCHES_KEY, []);
}

function writeBatches(batches: ShippingBatch[]) {
  writeJson(BATCHES_KEY, batches);
  schedulePersistBatches(batches);
}

function activeDeviceIdsOnOpenBatches(excludeBatchId?: string) {
  return new Set(
    readAllBatches()
      .filter(
        (batch) =>
          batch.id !== excludeBatchId &&
          batch.status !== "cancelled" &&
          batch.status !== "received",
      )
      .flatMap((batch) => batch.items)
      .filter((item) => item.status === "active")
      .map((item) => item.requestDeviceId),
  );
}

/** No longer auto-receives batches — kept as no-op so older callers stay safe. */
export function migrateExistingShippingToReceived() {
  // Intentionally empty: auto-receive violated the required workflow.
}

export function listShippingBatches(opsBranchId?: string | null) {
  const all = readAllBatches();
  if (!opsBranchId) return all;
  return all.filter((batch) => batch.opsBranchId === opsBranchId);
}

export function getShippingBatch(id: string) {
  return listShippingBatches().find((batch) => batch.id === id) ?? null;
}

/** Devices at branch eligible for outbound shipment (one branch only). */
export function listDevicesEligibleForShipment(opsBranchId: string): TechnicianQueueItem[] {
  const activeIds = activeDeviceIdsOnOpenBatches();

  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (activeIds.has(device.localId)) return false;
    const status = device.lifecycleStatus ?? "received_at_branch";
    return [
      "received_at_branch",
      "excluded_from_shipment",
      "ready_to_ship",
    ].includes(status);
  });
}

/** Devices ready to return to their origin branch. */
export function listDevicesEligibleForReturn(opsBranchId: string): TechnicianQueueItem[] {
  const activeIds = activeDeviceIdsOnOpenBatches();

  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (activeIds.has(device.localId)) return false;
    return device.lifecycleStatus === "ready_to_return";
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
      lifecycleStatus: "in_transit_to_service",
      currentLocation: "in_transit_to_service",
      lockedAfterShip: true,
    });
  }

  writeBatches([batch, ...readAllBatches()]);
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

/** Return shipment: devices of one branch only, destination = same origin branch. */
export function createReturnShippingBatch(input: {
  user: Profile;
  shipmentNumber: string;
  carrier: string;
  opsBranchId: string;
  destinationName: string;
  deviceLocalIds: string[];
  notes?: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["maintenance_manager", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "إنشاء بوليصة الإرجاع مسموح لمدير الصيانة فقط." };
  }
  if (!input.shipmentNumber.trim() || !input.carrier.trim()) {
    return { ok: false, error: "رقم البوليصة وشركة الشحن إلزاميان." };
  }
  if (!input.deviceLocalIds.length) {
    return { ok: false, error: "اختر جهازًا واحدًا على الأقل." };
  }

  const eligible = listDevicesEligibleForReturn(input.opsBranchId);
  const selected = eligible.filter((item) => input.deviceLocalIds.includes(item.device.localId));
  if (selected.length !== input.deviceLocalIds.length) {
    return { ok: false, error: "أحد الأجهزة غير جاهز للإرجاع أو لا يخص هذا الفرع." };
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
    batchNumber: `RB-${year}-${seq}`,
    shipmentNumber: input.shipmentNumber.trim(),
    carrier: input.carrier.trim(),
    direction: "return",
    sourceType: "service_center",
    sourceName: "مركز الصيانة",
    opsBranchId: input.opsBranchId,
    destinationType: "branch",
    destinationName: input.destinationName,
    status: "handed_to_carrier",
    createdBy: input.user.id,
    createdByName: input.user.fullName,
    createdAt: new Date().toISOString(),
    handedToCarrierAt: new Date().toISOString(),
    handedToCarrierBy: input.user.id,
    notes: input.notes?.trim() || undefined,
    items,
  };

  for (const item of selected) {
    updateDeviceLifecycle(item.request.id, item.device.localId, {
      lifecycleStatus: "in_return_transit",
      currentLocation: "in_return_transit",
      lockedAfterShip: true,
      assignedTechnicianId: null,
      assignedTechnicianName: null,
    });
  }

  writeBatches([batch, ...readAllBatches()]);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "create_return_shipping_batch",
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

  const all = readAllBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.direction !== "to_service") {
    return { ok: false, error: "الاستبعاد متاح لبوالص الإرسال إلى الصيانة فقط." };
  }
  if (batch.status === "handed_to_carrier" || batch.status === "received") {
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
      lockedAfterShip: false,
    });
  }

  writeBatches(all);
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

export function removeAllDevicesFromShippingBatch(input: {
  user: Profile;
  batchId: string;
  reason: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  if (!input.reason.trim()) return { ok: false, error: "سبب الاستبعاد إلزامي." };

  const batch = readAllBatches().find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };

  const activeItems = batch.items.filter((item) => item.status === "active");
  if (!activeItems.length) return { ok: false, error: "لا توجد أجهزة نشطة." };

  let last: ShippingBatch = batch;
  for (const item of activeItems) {
    const result = removeDeviceFromShippingBatch({
      user: input.user,
      batchId: input.batchId,
      itemId: item.id,
      reason: input.reason,
    });
    if (!result.ok) return result;
    last = result.batch;
  }
  return { ok: true, batch: last };
}

export function confirmHandedToCarrier(input: {
  user: Profile;
  batchId: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["branch", "branch_employee", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "تأكيد التسليم للشحن مسموح لموظف الفرع." };
  }

  const all = readAllBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.direction !== "to_service") {
    return { ok: false, error: "تأكيد التسليم يخص بوالص الإرسال إلى الصيانة." };
  }
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

  writeBatches(all);
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

/** Maintenance manager receives outbound waybill only after branch handoff. */
export function confirmReceivedAtService(input: {
  user: Profile;
  batchId: string;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["maintenance_manager", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "استلام البوليصة مسموح لمدير الصيانة فقط." };
  }

  const all = readAllBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.direction !== "to_service") {
    return { ok: false, error: "هذا الاستلام يخص بوالص الإرسال إلى الصيانة." };
  }
  if (batch.status === "received") {
    return { ok: false, error: "تم استلام هذه البوليصة مسبقًا." };
  }
  if (batch.status !== "handed_to_carrier") {
    return {
      ok: false,
      error: "لا يمكن الاستلام إلا بعد أن يؤكد الفرع التسليم لشركة الشحن.",
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
    const match = listAllRequestDevices().find(
      (row) =>
        row.device.localId === item.requestDeviceId ||
        row.device.deviceCode === item.deviceCode,
    );
    if (match) {
      updateDeviceLifecycle(match.request.id, match.device.localId, {
        lifecycleStatus: "awaiting_maintenance",
        currentLocation: "service_center",
        lockedAfterShip: false,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
      });
    }
  }

  writeBatches(all);
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

/** Branch receives return-shipment devices (all or some) with outcome. */
export function receiveReturnBatchDevices(input: {
  user: Profile;
  batchId: string;
  decisions: Array<{
    itemId: string;
    outcome: BranchReturnReceiveOutcome;
    reason?: string;
  }>;
}): { ok: true; batch: ShippingBatch } | { ok: false; error: string } {
  const role = input.user.role;
  if (!["branch", "branch_employee", "system_admin", "manager"].includes(role)) {
    return { ok: false, error: "استلام المرتجع مسموح لموظف الفرع." };
  }
  if (!input.decisions.length) {
    return { ok: false, error: "حدد نتيجة استلام لجهاز واحد على الأقل." };
  }

  const all = readAllBatches();
  const batch = all.find((item) => item.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة غير موجودة." };
  if (batch.direction !== "return") {
    return { ok: false, error: "هذه ليست بوليصة إرجاع." };
  }
  if (batch.status === "received") {
    return { ok: false, error: "تم إقفال استلام هذه البوليصة." };
  }
  if (input.user.opsBranchId && batch.opsBranchId !== input.user.opsBranchId) {
    return { ok: false, error: "هذه البوليصة لا تخص فرعك." };
  }

  for (const decision of input.decisions) {
    if (
      (decision.outcome === "damaged" || decision.outcome === "not_received") &&
      !decision.reason?.trim()
    ) {
      return { ok: false, error: "سبب التلف أو عدم الاستلام إلزامي." };
    }

    const item = batch.items.find((row) => row.id === decision.itemId);
    if (!item || item.status !== "active") {
      return { ok: false, error: "أحد الأجهزة غير موجود في البوليصة." };
    }
    if (item.branchReceiveOutcome) {
      return { ok: false, error: `تم تسجيل استلام ${item.deviceCode} مسبقًا.` };
    }

    item.branchReceiveOutcome = decision.outcome;
    item.branchReceiveReason = decision.reason?.trim() || null;
    item.branchReceivedAt = new Date().toISOString();
    item.branchReceivedBy = input.user.id;

    const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
    if (match) {
      if (decision.outcome === "intact") {
        updateDeviceLifecycle(match.request.id, match.device.localId, {
          lifecycleStatus: "awaiting_customer",
          currentLocation: "branch",
          lockedAfterShip: false,
        });
      } else if (decision.outcome === "damaged") {
        updateDeviceLifecycle(match.request.id, match.device.localId, {
          lifecycleStatus: "awaiting_customer",
          currentLocation: "branch",
          lockedAfterShip: false,
          extraDetails: [
            match.device.extraDetails,
            `مستلم تالفًا: ${decision.reason?.trim() || "بدون تفاصيل"}`,
          ]
            .filter(Boolean)
            .join(" | "),
        });
      } else if (decision.outcome === "not_received") {
        // Device never arrived — mark معلق at service center for re-return or close.
        updateDeviceLifecycle(match.request.id, match.device.localId, {
          lifecycleStatus: "awaiting_manager_decision",
          currentLocation: "service_center",
          lockedAfterShip: false,
          assignedTechnicianId: null,
          assignedTechnicianName: null,
          extraDetails: [
            match.device.extraDetails,
            `لم يُستلم في الفرع: ${decision.reason?.trim() || "بدون تفاصيل"}`,
          ]
            .filter(Boolean)
            .join(" | "),
        });
      }
    }
  }

  const pending = batch.items.filter(
    (item) => item.status === "active" && !item.branchReceiveOutcome,
  );
  if (pending.length === 0) {
    batch.status = "received";
    batch.receivedAt = new Date().toISOString();
    batch.receivedBy = input.user.id;
    batch.receivedByName = input.user.fullName;
  }

  writeBatches(all);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "receive_return_batch_devices",
    entityType: "shipping_batch",
    entityId: batch.id,
    after: { decisions: input.decisions, batchStatus: batch.status },
  });

  return { ok: true, batch };
}

export function listOpsBranches() {
  const managed = listBranchOptions();
  if (managed.length) {
    return managed.map((item) => ({ id: item.id, name: item.name }));
  }

  const fromRequests = listMaintenanceRequests().map((request) => ({
    id: request.opsBranchId,
    name: request.opsBranchName,
  }));
  const map = new Map(fromRequests.map((item) => [item.id, item]));
  // Cloud mode: never invent a demo Riyadh branch when lists are empty.
  if (isSupabaseConfigured() && !isDemoMode()) {
    return [...map.values()];
  }
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
  handed_to_carrier: "في الطريق",
  received: "مستلمة",
  cancelled: "ملغاة",
};

export const BRANCH_RETURN_OUTCOME_LABELS: Record<BranchReturnReceiveOutcome, string> = {
  intact: "سليم (كما تم الاستلام)",
  damaged: "تالف",
  not_received: "لم يتم الاستلام",
};
