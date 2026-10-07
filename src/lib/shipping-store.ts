import {
  listAllRequestDevices,
  listMaintenanceRequests,
  locationForLifecycleStatus,
  normalizeLifecycleStatus,
  updateDeviceLifecycle,
  updateDevicesLifecycle,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { listBranchOptions } from "@/lib/branches-store";
import { isDemoMode } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { pushAppAuditEvents, pushAppShippingBatches } from "@/lib/supabase/app-sync";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  BranchReturnReceiveOutcome,
  DeviceLifecycleStatus,
  DraftRequestDevice,
  Profile,
  ShipmentDirection,
  ShippingBatch,
  ShippingBatchItem,
  ShippingBatchStatus,
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

/** Normalize device codes so common OCR/typo variants (O↔0) still match. */
export function normalizeDeviceCodeKey(code: string | null | undefined) {
  return (code ?? "")
    .trim()
    .toUpperCase()
    .replace(/O/g, "0");
}

function openBatchActiveItems(excludeBatchId?: string) {
  return readAllBatches()
    .filter(
      (batch) =>
        batch.id !== excludeBatchId &&
        batch.status !== "cancelled" &&
        batch.status !== "received",
    )
    .flatMap((batch) =>
      batch.items
        .filter((item) => item.status === "active")
        .map((item) => ({ batch, item })),
    );
}

function activeDeviceIdsOnOpenBatches(excludeBatchId?: string) {
  return new Set(
    openBatchActiveItems(excludeBatchId).map(({ item }) => item.requestDeviceId),
  );
}

function activeDeviceCodeKeysOnOpenBatches(excludeBatchId?: string) {
  return new Set(
    openBatchActiveItems(excludeBatchId)
      .map(({ item }) => normalizeDeviceCodeKey(item.deviceCode))
      .filter(Boolean),
  );
}

function deviceOnOpenOutboundBatch(device: DraftRequestDevice, excludeBatchId?: string) {
  const activeIds = activeDeviceIdsOnOpenBatches(excludeBatchId);
  const activeCodes = activeDeviceCodeKeysOnOpenBatches(excludeBatchId);
  return (
    activeIds.has(device.localId) ||
    activeCodes.has(normalizeDeviceCodeKey(device.deviceCode))
  );
}

function findDeviceQueueItem(
  deviceLocalIdOrCode: string,
): TechnicianQueueItem | null {
  const raw = deviceLocalIdOrCode.trim();
  if (!raw) return null;
  const codeKey = normalizeDeviceCodeKey(raw);
  const all = listAllRequestDevices();
  return (
    all.find((row) => row.device.localId === raw) ??
    all.find((row) => row.device.deviceCode.trim().toUpperCase() === raw.toUpperCase()) ??
    all.find((row) => normalizeDeviceCodeKey(row.device.deviceCode) === codeKey) ??
    null
  );
}

function findOpenBatchForDevice(device: DraftRequestDevice) {
  const codeKey = normalizeDeviceCodeKey(device.deviceCode);
  return (
    openBatchActiveItems().find(
      ({ item }) =>
        item.requestDeviceId === device.localId ||
        normalizeDeviceCodeKey(item.deviceCode) === codeKey,
    ) ?? null
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
  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (deviceOnOpenOutboundBatch(device)) return false;
    const status = normalizeLifecycleStatus(device.lifecycleStatus);
    return (
      status === "received_at_branch" ||
      status === "excluded_from_shipment" ||
      status === "maintenance_failed"
    );
  });
}

/** Failed mobile-maintenance devices a mobile tech can ship directly to the service center. */
export function listDevicesEligibleForMobileDirectShip(
  opsBranchId: string,
): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (deviceOnOpenOutboundBatch(device)) return false;
    return normalizeLifecycleStatus(device.lifecycleStatus) === "maintenance_failed";
  });
}

/** Devices ready to return to their origin branch. */
export function listDevicesEligibleForReturn(opsBranchId: string): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(({ request, device }) => {
    if (request.opsBranchId !== opsBranchId) return false;
    if (device.lockedAfterShip) return false;
    if (deviceOnOpenOutboundBatch(device)) return false;
    return normalizeLifecycleStatus(device.lifecycleStatus) === "ready_to_return";
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
  const isManager = ["maintenance_manager", "system_admin", "manager"].includes(role);
  const isMobileTech = role === "mobile_technician";
  if (!isManager && !isMobileTech) {
    return {
      ok: false,
      error: "إنشاء البوليصة مسموح لمدير الصيانة أو الفني المتنقل (بعد تعذر الصيانة).",
    };
  }
  if (!input.shipmentNumber.trim() || !input.carrier.trim()) {
    return { ok: false, error: "رقم البوليصة وشركة الشحن إلزاميان." };
  }
  if (!input.deviceLocalIds.length) {
    return { ok: false, error: "اختر جهازًا واحدًا على الأقل." };
  }

  if (isMobileTech) {
    if (input.user.opsBranchId && input.opsBranchId !== input.user.opsBranchId) {
      return { ok: false, error: "يمكنك إنشاء بوليصة لفرعك فقط." };
    }
  }

  const eligible = isMobileTech
    ? listDevicesEligibleForMobileDirectShip(input.opsBranchId)
    : listDevicesEligibleForShipment(input.opsBranchId);
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

  const now = new Date().toISOString();
  // Mobile tech shipping after failure: treat as already handed to carrier.
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
    status: isMobileTech ? "handed_to_carrier" : "ready",
    createdBy: input.user.id,
    createdByName: input.user.fullName,
    createdAt: now,
    handedToCarrierAt: isMobileTech ? now : null,
    handedToCarrierBy: isMobileTech ? input.user.id : null,
    notes: input.notes?.trim() || undefined,
    items,
  };

  updateDevicesLifecycle(
    selected.map((item) => ({
      requestId: item.request.id,
      deviceLocalId: item.device.localId,
      patch: {
        lifecycleStatus: "in_transit_to_service" as const,
        currentLocation: "in_transit_to_service",
        lockedAfterShip: true,
        assignmentPath: "service_center" as const,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
      },
    })),
  );

  writeBatches([batch, ...readAllBatches()]);
  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "create_shipping_batch",
    entityType: "shipping_batch",
    entityId: batch.id,
    after: {
      shipmentNumber: batch.shipmentNumber,
      deviceCount: items.length,
      mobileDirectShip: isMobileTech,
    },
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

  updateDevicesLifecycle(
    selected.map((item) => ({
      requestId: item.request.id,
      deviceLocalId: item.device.localId,
      patch: {
        lifecycleStatus: "in_return_transit" as const,
        currentLocation: "in_return_transit",
        lockedAfterShip: true,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
      },
    })),
  );

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

  const activeItems = batch.items.filter((item) => item.status === "active");
  if (!activeItems.length) return { ok: false, error: "لا توجد أجهزة نشطة." };

  const now = new Date().toISOString();
  const reason = input.reason.trim();
  const lifecycleUpdates: Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Partial<DraftRequestDevice>;
  }> = [];

  for (const item of activeItems) {
    item.status = "removed";
    item.removedAt = now;
    item.removedBy = input.user.id;
    item.removalReason = reason;

    const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
    if (match) {
      lifecycleUpdates.push({
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
          lifecycleStatus: "excluded_from_shipment",
          currentLocation: "branch",
          lockedAfterShip: false,
        },
      });
    }

    writeAudit({
      actorId: input.user.id,
      actorName: input.user.fullName,
      action: "remove_device_from_batch",
      entityType: "shipping_batch_item",
      entityId: item.id,
      after: { reason },
    });
  }

  updateDevicesLifecycle(lifecycleUpdates);
  writeBatches(all);
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

  const handoffUpdates = activeItems.flatMap((item) => {
    const match = listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId);
    if (!match) return [];
    return [
      {
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
          lifecycleStatus: "in_transit_to_service" as const,
          currentLocation: "in_transit_to_service",
          lockedAfterShip: true,
        },
      },
    ];
  });
  updateDevicesLifecycle(handoffUpdates);

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

  const receiveUpdates = activeItems.flatMap((item) => {
    const match = listAllRequestDevices().find(
      (row) =>
        row.device.localId === item.requestDeviceId ||
        row.device.deviceCode === item.deviceCode,
    );
    if (!match) return [];
    return [
      {
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
          lifecycleStatus: "awaiting_maintenance" as const,
          currentLocation: "service_center",
          lockedAfterShip: false,
          assignedTechnicianId: null,
          assignedTechnicianName: null,
        },
      },
    ];
  });
  updateDevicesLifecycle(receiveUpdates);

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

  const lifecycleUpdates: Array<{
    requestId: string;
    deviceLocalId: string;
    patch: Partial<DraftRequestDevice>;
  }> = [];

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
    if (!match) continue;

    if (decision.outcome === "intact") {
      lifecycleUpdates.push({
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
          lifecycleStatus: "awaiting_customer",
          currentLocation: "branch",
          lockedAfterShip: false,
        },
      });
    } else if (decision.outcome === "damaged") {
      lifecycleUpdates.push({
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
          lifecycleStatus: "awaiting_customer",
          currentLocation: "branch",
          lockedAfterShip: false,
          extraDetails: [
            match.device.extraDetails,
            `مستلم تالفًا: ${decision.reason?.trim() || "بدون تفاصيل"}`,
          ]
            .filter(Boolean)
            .join(" | "),
        },
      });
    } else if (decision.outcome === "not_received") {
      // Device never arrived — mark معلق at service center for re-return or close.
      lifecycleUpdates.push({
        requestId: match.request.id,
        deviceLocalId: match.device.localId,
        patch: {
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
        },
      });
    }
  }

  updateDevicesLifecycle(lifecycleUpdates);

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

export type BranchReadyToShipSummary = {
  branchId: string;
  branchName: string;
  readyCount: number;
};

/** Branches that currently have devices eligible for outbound shipment to service. */
export function listBranchesReadyToShip(): BranchReadyToShipSummary[] {
  return listOpsBranches()
    .map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      readyCount: listDevicesEligibleForShipment(branch.id).length,
    }))
    .filter((item) => item.readyCount > 0)
    .sort(
      (a, b) =>
        b.readyCount - a.readyCount ||
        a.branchName.localeCompare(b.branchName, "ar"),
    );
}

/** All ops branches with ready-to-ship counts, ready branches first. */
export function listOpsBranchesWithReadyCounts(): Array<{
  id: string;
  name: string;
  readyCount: number;
}> {
  const readyMap = new Map(
    listBranchesReadyToShip().map((item) => [item.branchId, item.readyCount]),
  );
  return listOpsBranches()
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      readyCount: readyMap.get(branch.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.readyCount - a.readyCount || a.name.localeCompare(b.name, "ar"),
    );
}

export type CarrierOpenBatchesSummary = {
  carrier: string;
  total: number;
  toService: number;
  returning: number;
};

function isOpenShippingBatch(batch: ShippingBatch) {
  return batch.status !== "cancelled" && batch.status !== "received";
}

/** Carriers that currently have open (active) waybills in either direction. */
export function listCarriersWithOpenBatches(): CarrierOpenBatchesSummary[] {
  const map = new Map<string, CarrierOpenBatchesSummary>();

  for (const batch of listShippingBatches().filter(isOpenShippingBatch)) {
    const carrier = batch.carrier.trim() || "—";
    const current = map.get(carrier) ?? {
      carrier,
      total: 0,
      toService: 0,
      returning: 0,
    };
    current.total += 1;
    if (batch.direction === "return") {
      current.returning += 1;
    } else {
      // to_service and legacy inbound both count as branch → service
      current.toService += 1;
    }
    map.set(carrier, current);
  }

  return [...map.values()].sort(
    (a, b) => b.total - a.total || a.carrier.localeCompare(b.carrier, "ar"),
  );
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

/** Shipping-related lifecycle statuses a repair admin may set manually. */
export const REPAIRABLE_SHIPPING_STATUSES = [
  "received_at_branch",
  "in_transit_to_service",
  "excluded_from_shipment",
  "ready_to_return",
  "in_return_transit",
] as const;

export type RepairableShippingStatus = (typeof REPAIRABLE_SHIPPING_STATUSES)[number];

/** Statuses that imply the device should be linked to an open waybill. */
export function repairStatusNeedsBatch(status: RepairableShippingStatus | "" | undefined) {
  return status === "in_transit_to_service" || status === "in_return_transit";
}

function expectedStatusForBatch(batch: ShippingBatch): RepairableShippingStatus {
  return batch.direction === "return" ? "in_return_transit" : "in_transit_to_service";
}

function batchMatchesRepairStatus(batch: ShippingBatch, status: RepairableShippingStatus) {
  if (status === "in_return_transit") return batch.direction === "return";
  if (status === "in_transit_to_service") return batch.direction !== "return";
  return true;
}

export type RepairBatchOption = {
  id: string;
  shipmentNumber: string;
  carrier: string;
  direction: ShipmentDirection;
  status: ShippingBatchStatus;
  opsBranchId: string;
  branchName: string;
  containsDevice: boolean;
  activeItemCount: number;
  label: string;
};

/**
 * Open waybills suitable for manual shipping repair on one device.
 * Prefers batches that already contain the device, then same ops branch.
 */
export function listRepairBatchOptions(input: {
  deviceLocalIdOrCode: string;
  /** When set to a transit status, only matching-direction batches are returned. */
  forStatus?: RepairableShippingStatus | "";
}): RepairBatchOption[] {
  const match = findDeviceQueueItem(input.deviceLocalIdOrCode);
  if (!match) return [];

  const codeKey = normalizeDeviceCodeKey(match.device.deviceCode);
  const branchMap = new Map(listOpsBranches().map((b) => [b.id, b.name]));
  const forStatus = input.forStatus || undefined;
  const filterDirection = forStatus && repairStatusNeedsBatch(forStatus) ? forStatus : null;

  const options: RepairBatchOption[] = [];
  for (const batch of readAllBatches().filter(isOpenShippingBatch)) {
    if (filterDirection && !batchMatchesRepairStatus(batch, filterDirection)) continue;

    const containsDevice = batch.items.some(
      (item) =>
        item.status === "active" &&
        (item.requestDeviceId === match.device.localId ||
          normalizeDeviceCodeKey(item.deviceCode) === codeKey),
    );
    const sameBranch = batch.opsBranchId === match.request.opsBranchId;
    // Prefer same-branch batches; still allow others that already contain the device.
    if (!sameBranch && !containsDevice) continue;

    const branchName =
      branchMap.get(batch.opsBranchId) ?? match.request.opsBranchName ?? batch.sourceName;
    const dirLabel = batch.direction === "return" ? "إرجاع" : "إرسال";
    const statusLabel = SHIPPING_BATCH_STATUS_LABELS[batch.status] ?? batch.status;
    const activeItemCount = batch.items.filter((item) => item.status === "active").length;
    const onDevice = containsDevice ? " · تحتوي الجهاز" : "";

    options.push({
      id: batch.id,
      shipmentNumber: batch.shipmentNumber,
      carrier: batch.carrier,
      direction: batch.direction,
      status: batch.status,
      opsBranchId: batch.opsBranchId,
      branchName,
      containsDevice,
      activeItemCount,
      label: `${batch.shipmentNumber} · ${dirLabel} · ${statusLabel} · ${batch.carrier} · ${branchName}${onDevice}`,
    });
  }

  return options.sort((a, b) => {
    if (a.containsDevice !== b.containsDevice) return a.containsDevice ? -1 : 1;
    if (a.opsBranchId === match.request.opsBranchId && b.opsBranchId !== match.request.opsBranchId)
      return -1;
    if (b.opsBranchId === match.request.opsBranchId && a.opsBranchId !== match.request.opsBranchId)
      return 1;
    return a.shipmentNumber.localeCompare(b.shipmentNumber, "ar");
  });
}

/**
 * Link device as an active item on the selected open waybill (repair path only).
 * Detaches from any other open waybill first. Does not change lifecycle status.
 */
function ensureDeviceActiveOnRepairBatch(input: {
  user: Profile;
  batchId: string;
  device: DraftRequestDevice;
}):
  | { ok: true; batch: ShippingBatch; added: boolean; reactivated: boolean; detachedShipmentNumbers: string[] }
  | { ok: false; error: string } {
  const all = readAllBatches();
  const batch = all.find((row) => row.id === input.batchId);
  if (!batch) return { ok: false, error: "البوليصة المختارة غير موجودة." };
  if (!isOpenShippingBatch(batch)) {
    return { ok: false, error: "لا يمكن الربط ببوليصة مُستلمة أو ملغاة." };
  }

  const codeKey = normalizeDeviceCodeKey(input.device.deviceCode);
  const now = new Date().toISOString();
  const detachedShipmentNumbers: string[] = [];

  for (const other of all) {
    if (other.id === batch.id) continue;
    if (!isOpenShippingBatch(other)) continue;
    for (const item of other.items) {
      if (item.status !== "active") continue;
      const same =
        item.requestDeviceId === input.device.localId ||
        normalizeDeviceCodeKey(item.deviceCode) === codeKey;
      if (!same) continue;
      item.status = "removed";
      item.removedAt = now;
      item.removedBy = input.user.id;
      item.removalReason = "إصلاح حالة الشحن — نقل إلى بوليصة أخرى";
      detachedShipmentNumbers.push(other.shipmentNumber);
    }
  }

  const existing = batch.items.find(
    (item) =>
      item.requestDeviceId === input.device.localId ||
      normalizeDeviceCodeKey(item.deviceCode) === codeKey,
  );

  let added = false;
  let reactivated = false;
  if (existing) {
    if (existing.status !== "active") {
      existing.status = "active";
      existing.removedAt = null;
      existing.removedBy = null;
      existing.removalReason = null;
      reactivated = true;
    }
  } else {
    batch.items.push({
      id: crypto.randomUUID(),
      requestDeviceId: input.device.localId,
      deviceCode: input.device.deviceCode,
      modelName: input.device.modelName,
      color: input.device.color ?? "",
      status: "active",
    });
    added = true;
  }

  writeBatches(all);
  return { ok: true, batch, added, reactivated, detachedShipmentNumbers };
}

export type ShippingStatusInconsistency = {
  requestId: string;
  deviceLocalId: string;
  deviceCode: string;
  opsBranchName: string;
  issue: string;
  currentStatus: string;
  currentLocked: boolean;
  suggestedStatus: DeviceLifecycleStatus;
  suggestedLocked: boolean;
  batchId?: string;
  batchShipmentNumber?: string;
};

/** True if user may run shipping status repair tools. */
export function canRepairShippingStatus(user: Profile | null | undefined) {
  if (!user) return false;
  if (hasPermission(user, "repair_shipping_status")) return true;
  return ["system_admin", "manager", "maintenance_manager"].includes(user.role);
}

function patchForShippingStatus(
  status: RepairableShippingStatus,
): Partial<DraftRequestDevice> {
  const locked =
    status === "in_transit_to_service" || status === "in_return_transit";
  return {
    lifecycleStatus: status,
    currentLocation: locationForLifecycleStatus(status),
    lockedAfterShip: locked,
  };
}

/** Scan requests + open waybills for status/lock mismatches after sync races. */
export function listShippingStatusInconsistencies(): ShippingStatusInconsistency[] {
  const issues: ShippingStatusInconsistency[] = [];
  const seen = new Set<string>();

  for (const { batch, item } of openBatchActiveItems()) {
    const match =
      listAllRequestDevices().find((row) => row.device.localId === item.requestDeviceId) ??
      listAllRequestDevices().find(
        (row) =>
          normalizeDeviceCodeKey(row.device.deviceCode) ===
          normalizeDeviceCodeKey(item.deviceCode),
      );
    if (!match) continue;

    const status = normalizeLifecycleStatus(match.device.lifecycleStatus);
    const expectedStatus: DeviceLifecycleStatus =
      batch.direction === "return" ? "in_return_transit" : "in_transit_to_service";
    const locked = Boolean(match.device.lockedAfterShip);
    const statusWrong = status !== expectedStatus;
    const lockWrong = !locked;
    if (!statusWrong && !lockWrong) continue;

    const key = `${match.device.localId}::batch`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      requestId: match.request.id,
      deviceLocalId: match.device.localId,
      deviceCode: match.device.deviceCode,
      opsBranchName: match.request.opsBranchName,
      issue:
        batch.direction === "return"
          ? "الجهاز على بوليصة إرجاع نشطة لكن حالته غير متوافقة"
          : "الجهاز على بوليصة إرسال نشطة لكن حالته غير متوافقة",
      currentStatus: status,
      currentLocked: locked,
      suggestedStatus: expectedStatus,
      suggestedLocked: true,
      batchId: batch.id,
      batchShipmentNumber: batch.shipmentNumber,
    });
  }

  for (const { request, device } of listAllRequestDevices()) {
    const status = normalizeLifecycleStatus(device.lifecycleStatus);
    const locked = Boolean(device.lockedAfterShip);
    const onOpen = Boolean(findOpenBatchForDevice(device));
    const key = `${device.localId}::orphan`;
    if (seen.has(`${device.localId}::batch`)) continue;

    if (!onOpen && locked) {
      if (seen.has(key)) continue;
      seen.add(key);
      const suggestedStatus: DeviceLifecycleStatus =
        status === "in_transit_to_service"
          ? "received_at_branch"
          : status === "in_return_transit"
            ? "ready_to_return"
            : status;
      issues.push({
        requestId: request.id,
        deviceLocalId: device.localId,
        deviceCode: device.deviceCode,
        opsBranchName: request.opsBranchName,
        issue: "قفل الشحن مفعّل دون بوليصة نشطة — يمنع الإدراج في بوليصة جديدة",
        currentStatus: status,
        currentLocked: locked,
        suggestedStatus,
        suggestedLocked: false,
      });
      continue;
    }

    if (!onOpen && status === "in_transit_to_service") {
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        requestId: request.id,
        deviceLocalId: device.localId,
        deviceCode: device.deviceCode,
        opsBranchName: request.opsBranchName,
        issue: "حالة «جاري الشحن» دون بوليصة نشطة",
        currentStatus: status,
        currentLocked: locked,
        suggestedStatus: "received_at_branch",
        suggestedLocked: false,
      });
      continue;
    }

    if (!onOpen && status === "in_return_transit") {
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        requestId: request.id,
        deviceLocalId: device.localId,
        deviceCode: device.deviceCode,
        opsBranchName: request.opsBranchName,
        issue: "حالة «في الطريق للفرع» دون بوليصة إرجاع نشطة",
        currentStatus: status,
        currentLocked: locked,
        suggestedStatus: "ready_to_return",
        suggestedLocked: false,
      });
    }
  }

  return issues.sort((a, b) => a.deviceCode.localeCompare(b.deviceCode, "ar"));
}

/** Fix all detected shipping/lifecycle inconsistencies. Requires repair permission. */
export function repairInconsistentShippingStatuses(input: {
  user: Profile;
}): { ok: true; fixed: number; details: string[] } | { ok: false; error: string } {
  if (!canRepairShippingStatus(input.user)) {
    return { ok: false, error: "ليست لديك صلاحية إصلاح حالات الشحن." };
  }

  const issues = listShippingStatusInconsistencies();
  if (!issues.length) {
    return { ok: true, fixed: 0, details: ["لا توجد تناقضات حالياً."] };
  }

  const updates = issues.map((issue) => ({
    requestId: issue.requestId,
    deviceLocalId: issue.deviceLocalId,
    patch: {
      lifecycleStatus: issue.suggestedStatus,
      currentLocation: locationForLifecycleStatus(issue.suggestedStatus),
      lockedAfterShip: issue.suggestedLocked,
    } satisfies Partial<DraftRequestDevice>,
  }));

  updateDevicesLifecycle(updates);

  const details = issues.map(
    (issue) =>
      `${issue.deviceCode}: ${issue.currentStatus} → ${issue.suggestedStatus}` +
      (issue.batchShipmentNumber ? ` (بوليصة ${issue.batchShipmentNumber})` : ""),
  );

  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "repair_shipping_status_batch",
    entityType: "shipping_repair",
    entityId: crypto.randomUUID(),
    after: { fixed: issues.length, devices: details },
  });

  return { ok: true, fixed: issues.length, details };
}

/** Manually set a device shipping-related status (allowed subset only). */
export function repairDeviceShippingStatus(input: {
  user: Profile;
  deviceLocalIdOrCode: string;
  /** When omitted, auto-sync from open waybill or unlock for eligibility. */
  targetStatus?: RepairableShippingStatus;
  /**
   * Optional open waybill for transit targets.
   * When set: links the device as an active item on that waybill (if missing)
   * and sets status to match the waybill direction.
   */
  batchId?: string;
}):
  | { ok: true; deviceCode: string; before: string; after: string; note: string }
  | { ok: false; error: string } {
  if (!canRepairShippingStatus(input.user)) {
    return { ok: false, error: "ليست لديك صلاحية إصلاح حالات الشحن." };
  }

  const match = findDeviceQueueItem(input.deviceLocalIdOrCode);
  if (!match) {
    return { ok: false, error: "الجهاز غير موجود. تحقق من الكود (مثال: ARMS-…)." };
  }

  const before = normalizeLifecycleStatus(match.device.lifecycleStatus);
  const open = findOpenBatchForDevice(match.device);
  const selectedBatchId = input.batchId?.trim() || undefined;

  let target: RepairableShippingStatus;
  let note: string;
  let linkedBatch: ShippingBatch | null = null;
  let linkNote = "";

  if (selectedBatchId) {
    const batch = getShippingBatch(selectedBatchId);
    if (!batch || !isOpenShippingBatch(batch)) {
      return { ok: false, error: "البوليصة المختارة غير متاحة (مُستلمة أو ملغاة أو غير موجودة)." };
    }

    const batchStatus = expectedStatusForBatch(batch);
    if (input.targetStatus) {
      if (
        !(REPAIRABLE_SHIPPING_STATUSES as readonly string[]).includes(input.targetStatus)
      ) {
        return { ok: false, error: "الحالة المطلوبة غير مسموحة لإصلاح الشحن." };
      }
      if (
        repairStatusNeedsBatch(input.targetStatus) &&
        !batchMatchesRepairStatus(batch, input.targetStatus)
      ) {
        return {
          ok: false,
          error:
            batch.direction === "return"
              ? "البوليصة المختارة إرجاع — اختر حالة «في الطريق للفرع» أو بوليصة إرسال."
              : "البوليصة المختارة إرسال — اختر حالة «جاري الشحن» أو بوليصة إرجاع.",
        };
      }
      // Transit + batch → status always follows the waybill direction.
      target = repairStatusNeedsBatch(input.targetStatus) ? batchStatus : input.targetStatus;
    } else {
      target = batchStatus;
    }

    if (repairStatusNeedsBatch(target)) {
      const linked = ensureDeviceActiveOnRepairBatch({
        user: input.user,
        batchId: batch.id,
        device: match.device,
      });
      if (!linked.ok) return linked;
      linkedBatch = linked.batch;
      const parts: string[] = [];
      if (linked.added) parts.push("أُضيف الجهاز كعنصر نشط على البوليصة");
      else if (linked.reactivated) parts.push("أُعيد تفعيل الجهاز على البوليصة");
      else parts.push("الجهاز كان أصلاً على البوليصة");
      if (linked.detachedShipmentNumbers.length) {
        parts.push(
          `وأُزيل من بوليصة/بوالص: ${linked.detachedShipmentNumbers.join("، ")}`,
        );
      }
      linkNote = parts.join("؛ ");
      note = `مزامنة مع بوليصة ${linked.batch.shipmentNumber} (${SHIPPING_BATCH_STATUS_LABELS[linked.batch.status] ?? linked.batch.status}). ${linkNote}.`;
    } else {
      note = "تصحيح يدوي ضمن الحالات المسموحة للشحن.";
    }
  } else if (input.targetStatus) {
    if (
      !(REPAIRABLE_SHIPPING_STATUSES as readonly string[]).includes(input.targetStatus)
    ) {
      return { ok: false, error: "الحالة المطلوبة غير مسموحة لإصلاح الشحن." };
    }
    if (repairStatusNeedsBatch(input.targetStatus)) {
      if (open && batchMatchesRepairStatus(open.batch, input.targetStatus)) {
        target = input.targetStatus;
        note = `تصحيح يدوي مع البوليصة الحالية ${open.batch.shipmentNumber}.`;
      } else {
        return {
          ok: false,
          error:
            "لتعيين حالة إرسال/إرجاع عبر بوليصة اختر بوليصة مفتوحة من القائمة، أو استخدم الوضع التلقائي إن كان الجهاز على بوليصة نشطة.",
        };
      }
    } else {
      target = input.targetStatus;
      note = "تصحيح يدوي ضمن الحالات المسموحة للشحن.";
    }
  } else if (open) {
    target =
      open.batch.direction === "return" ? "in_return_transit" : "in_transit_to_service";
    note = `مزامنة مع بوليصة ${open.batch.shipmentNumber} (${open.batch.status}).`;
  } else if (
    before === "in_transit_to_service" ||
    (Boolean(match.device.lockedAfterShip) &&
      (before === "received_at_branch" ||
        before === "excluded_from_shipment" ||
        before === "maintenance_failed"))
  ) {
    target = "received_at_branch";
    note = "إزالة قفل الشحن وإعادة الجهاز لمؤهّل للإرسال.";
  } else if (
    before === "in_return_transit" ||
    (Boolean(match.device.lockedAfterShip) && before === "ready_to_return")
  ) {
    target = "ready_to_return";
    note = "إزالة قفل الشحن وإعادة الجهاز لمؤهّل للإرجاع.";
  } else {
    return {
      ok: false,
      error: `لا يوجد تناقض واضح لإصلاحه تلقائياً (الحالة الحالية: ${before}). اختر حالة يدوياً إن لزم.`,
    };
  }

  const patch = patchForShippingStatus(target);
  updateDeviceLifecycle(match.request.id, match.device.localId, patch);

  writeAudit({
    actorId: input.user.id,
    actorName: input.user.fullName,
    action: "repair_device_shipping_status",
    entityType: "request_device",
    entityId: match.device.localId,
    before: {
      lifecycleStatus: before,
      lockedAfterShip: match.device.lockedAfterShip,
    },
    after: {
      ...patch,
      note,
      batchId: linkedBatch?.id ?? selectedBatchId ?? open?.batch.id,
      shipmentNumber: linkedBatch?.shipmentNumber ?? open?.batch.shipmentNumber,
    },
  });

  return {
    ok: true,
    deviceCode: match.device.deviceCode,
    before,
    after: target,
    note,
  };
}
