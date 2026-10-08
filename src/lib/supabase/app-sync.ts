/**
 * Direct sync to normalized public.app_* tables (source of truth when Supabase is configured).
 * localStorage remains an offline cache only — no arms_client_store.
 */
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAuthLikeSupabaseError, setArmsSyncStatus } from "@/lib/supabase/sync-status";
import type { DeviceCatalogState } from "@/lib/catalog-store";
import type { SpareInventoryState } from "@/lib/spare-inventory-store";
import type {
  DraftRequestDevice,
  ManagedUser,
  MaintenanceRequestRecord,
  OpsBranchRecord,
  PickupReceipt,
  ShippingBatch,
  ShippingBatchItem,
  SpareInventoryBalance,
  SpareReceiveReceipt,
  SpareStockMovement,
  TechnicianWorkRecord,
  WaybillRecord,
} from "@/types/domain";

type SyncResult = { ok: true } | { ok: false; error: string };

function reportError(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (isAuthLikeSupabaseError(error) || /invalid api key/i.test(message)) {
    setArmsSyncStatus({ state: "auth_error", message: `${label}: ${message}` });
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function deleteAll(table: string) {
  const supabase = createClient();
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) throw error;
}

async function deleteRowsByIds(table: string, ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createClient();
  for (const id of ids) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  }
}

/**
 * Strip columns missing from remote schema (e.g. is_archived before migration 018)
 * and retry insert/upsert. Returns the rows that succeeded (possibly stripped).
 */
async function writeRowsWithSchemaCompat(
  table: string,
  rows: Record<string, unknown>[],
  mode: "insert" | "upsert",
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createClient();
  let current = rows.map((row) => ({ ...row }));

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } =
      mode === "upsert"
        ? await supabase.from(table).upsert(current, { onConflict: "id" })
        : await supabase.from(table).insert(current);
    if (!error) return;

    const message = error.message ?? "";
    const missingCol = /Could not find the '([^']+)' column/i.exec(message)?.[1];
    if (missingCol && /PGRST204|42703|schema cache/i.test(message)) {
      current = current.map((row) => {
        const next = { ...row };
        delete next[missingCol];
        return next;
      });
      continue;
    }

    // Legacy: older DBs without a payload column on some tables.
    if (/payload|PGRST204|42703|schema cache/i.test(message) && current.some((row) => "payload" in row)) {
      current = current.map((row) => {
        const next = { ...row };
        delete next.payload;
        return next;
      });
      continue;
    }

    throw error;
  }

  throw new Error(`${mode}Rows(${table}): exceeded schema-compat retries`);
}

/** Insert rows; strip unknown columns (e.g. is_archived pre-018) and retry. */
async function insertRows(table: string, rows: Record<string, unknown>[]) {
  await writeRowsWithSchemaCompat(table, rows, "insert");
}

/** Upsert by id; strip unknown columns and retry. Safer than delete-all + insert. */
async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  await writeRowsWithSchemaCompat(table, rows, "upsert");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function payloadOf<T>(row: { payload?: unknown } | null | undefined, fallback: () => T): T {
  const raw = row?.payload;
  if (raw && typeof raw === "object") return raw as T;
  return fallback();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function parsePermissionsColumn(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

function userToRow(user: ManagedUser) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    ops_branch_id: user.opsBranchId,
    ops_branch_name: user.opsBranchName,
    password_plain: user.password,
    is_active: user.isActive !== false,
    is_archived: Boolean(user.isArchived),
    gender: user.gender === "male" || user.gender === "female" ? user.gender : null,
    photo_data_url: user.photoDataUrl?.trim() || null,
    photo_name: user.photoDataUrl?.trim() ? user.photoName?.trim() || null : null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    synced_at: nowIso(),
  };
}

function rowToUser(row: Record<string, unknown>): ManagedUser {
  const photoDataUrl =
    typeof row.photo_data_url === "string" && row.photo_data_url.trim()
      ? row.photo_data_url.trim()
      : null;
  const genderRaw = typeof row.gender === "string" ? row.gender.trim() : "";
  return {
    id: String(row.id ?? ""),
    fullName: String(row.full_name ?? ""),
    username: String(row.username ?? ""),
    email: String(row.email ?? ""),
    mobile: String(row.mobile ?? ""),
    role: (row.role as ManagedUser["role"]) ?? "branch",
    permissions: parsePermissionsColumn(row.permissions),
    opsBranchId: (row.ops_branch_id as string | null) ?? null,
    opsBranchName: (row.ops_branch_name as string | null) ?? null,
    password: String(row.password_plain ?? ""),
    isActive: row.is_active !== false,
    isArchived: Boolean(row.is_archived),
    gender: genderRaw === "male" || genderRaw === "female" ? genderRaw : null,
    photoDataUrl,
    photoName:
      photoDataUrl && typeof row.photo_name === "string" && row.photo_name.trim()
        ? row.photo_name.trim()
        : null,
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export async function pullAppUsers(): Promise<ManagedUser[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_users").select("*");
  if (error) {
    reportError("app_users", error);
    throw error;
  }
  return (data ?? []).map((row) => rowToUser(row as Record<string, unknown>));
}

export async function pushAppUsers(
  users: ManagedUser[],
  options?: { pruneOrphans?: boolean },
): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    // Read remote first so we never wipe on empty/failed replace.
    const remote = await pullAppUsers();

    // CRITICAL: never push an empty array over a non-empty remote (wipes all logins).
    if (users.length === 0) {
      if (remote.length > 0) {
        const msg = "Refusing to push empty users over non-empty remote.";
        console.warn("[arms] pushAppUsers:", msg);
        return { ok: false, error: msg };
      }
      return { ok: true };
    }

    // Upsert first (schema-compat strips is_archived etc. if migration 018 not applied).
    // Never delete-all before write. Prune orphans only when explicitly safe.
    await upsertRows("app_users", users.map(userToRow));

    const pruneOrphans = options?.pruneOrphans === true;
    if (!pruneOrphans) {
      return { ok: true };
    }

    const keepIds = new Set(users.map((user) => user.id).filter(Boolean));
    const orphanIds = remote
      .map((user) => user.id)
      .filter((id) => id && !keepIds.has(id));

    if (orphanIds.length === 0) {
      return { ok: true };
    }

    // Guard: never shrink remote via orphan delete when payload is smaller/subset.
    // Incomplete local cache must never erase cloud accounts.
    if (users.length < remote.length) {
      console.warn(
        "[arms] pushAppUsers: refusing orphan prune — payload smaller than remote",
        { local: users.length, remote: remote.length, orphans: orphanIds.length },
      );
      return { ok: true };
    }

    // Guard: bootstrap-only payload must never prune a multi-user remote
    // (login shortcut used to push [admin] before hydrate finished).
    const bootstrapOnly =
      keepIds.size === 1 && (keepIds.has("admin-local") || users[0]?.username === "admin");
    if (bootstrapOnly && remote.length > 1) {
      console.warn(
        "[arms] pushAppUsers: refusing to delete remote users via bootstrap-only payload",
        { keep: [...keepIds], orphans: orphanIds.length, remote: remote.length },
      );
      return { ok: true };
    }

    await deleteRowsByIds("app_users", orphanIds);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppUsers", error);
    reportError("app_users", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

function branchToRow(branch: OpsBranchRecord) {
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    code: branch.code,
    is_service_center: Boolean(branch.isServiceCenter),
    is_active: branch.isActive !== false,
    created_at: branch.createdAt,
    updated_at: branch.updatedAt,
    synced_at: nowIso(),
  };
}

function rowToBranch(row: Record<string, unknown>): OpsBranchRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    city: String(row.city ?? ""),
    code: String(row.code ?? ""),
    isServiceCenter: Boolean(row.is_service_center),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export async function pullAppBranches(): Promise<OpsBranchRecord[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_ops_branches").select("*");
  if (error) {
    reportError("app_ops_branches", error);
    throw error;
  }
  return (data ?? []).map((row) => rowToBranch(row as Record<string, unknown>));
}

export async function pushAppBranches(branches: OpsBranchRecord[]): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_ops_branches");
    await insertRows("app_ops_branches", branches.map(branchToRow));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppBranches", error);
    reportError("app_ops_branches", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Maintenance requests + devices
// ---------------------------------------------------------------------------

function deviceToRow(request: MaintenanceRequestRecord, device: DraftRequestDevice) {
  const id = `${request.id}::${device.localId || device.deviceCode}`;
  return {
    id,
    request_id: request.id,
    request_number: request.requestNumber,
    local_id: device.localId,
    device_code: device.deviceCode,
    device_type_name: device.deviceTypeName,
    brand_name: device.brandName,
    model_name: device.modelName,
    serial_number: device.serialNumber,
    fault: device.fault,
    external_condition: device.externalCondition,
    color: device.color ?? null,
    lifecycle_status: device.lifecycleStatus ?? null,
    current_location: device.currentLocation ?? null,
    assigned_technician_id: device.assignedTechnicianId ?? null,
    assigned_technician_name: device.assignedTechnicianName ?? null,
    locked_after_ship: Boolean(device.lockedAfterShip),
    accessory_names: (device.accessoryNames ?? []).join(", "),
    extra_details: device.extraDetails ?? null,
    qr_token: device.qrToken || device.localId || null,
    qr_printed_at: device.qrPrintedAt ?? null,
    payload: device,
    synced_at: nowIso(),
  };
}

function requestToRow(request: MaintenanceRequestRecord) {
  return {
    id: request.id,
    request_number: request.requestNumber,
    received_at: request.receivedAt,
    ops_branch_id: request.opsBranchId,
    ops_branch_name: request.opsBranchName,
    branch_staff_id: request.branchStaffId,
    branch_staff_name: request.branchStaffName,
    priority: request.priority,
    customer_mobile: request.customerMobile,
    contact_name: request.contactName,
    purchase_invoice: request.purchaseInvoice,
    general_notes: request.generalNotes,
    device_count: request.devices?.length ?? 0,
    payload: request,
    synced_at: nowIso(),
  };
}

function rowToDevice(row: Record<string, unknown>): DraftRequestDevice {
  const fromPayload = payloadOf(row, () => ({
    localId: String(row.local_id ?? ""),
    deviceCode: String(row.device_code ?? ""),
    deviceTypeId: "",
    deviceTypeName: String(row.device_type_name ?? ""),
    brandId: "",
    brandName: String(row.brand_name ?? ""),
    modelId: "",
    modelName: String(row.model_name ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    fault: String(row.fault ?? ""),
    externalCondition: (row.external_condition as DraftRequestDevice["externalCondition"]) ?? "intact",
    accessoryIds: [],
    accessoryNames: String(row.accessory_names ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    extraDetails: String(row.extra_details ?? ""),
    devicePhotoNames: [],
    color: row.color ? String(row.color) : undefined,
    currentLocation: row.current_location ? String(row.current_location) : undefined,
    lockedAfterShip: Boolean(row.locked_after_ship),
    lifecycleStatus: row.lifecycle_status as DraftRequestDevice["lifecycleStatus"],
    assignedTechnicianId: (row.assigned_technician_id as string | null) ?? null,
    assignedTechnicianName: (row.assigned_technician_name as string | null) ?? null,
    qrToken: row.qr_token ? String(row.qr_token) : undefined,
    qrPrintedAt: (row.qr_printed_at as string | null) ?? null,
    receiptNumber: "",
    receiptPhotoName: "",
  }));
  // Normalized columns win for claim/ownership so concurrent technicians see the same lock.
  return {
    ...fromPayload,
    localId: String(row.local_id ?? fromPayload.localId ?? ""),
    deviceCode: String(row.device_code ?? fromPayload.deviceCode ?? ""),
    lifecycleStatus:
      (row.lifecycle_status as DraftRequestDevice["lifecycleStatus"]) ??
      fromPayload.lifecycleStatus,
    currentLocation: row.current_location
      ? String(row.current_location)
      : fromPayload.currentLocation,
    assignedTechnicianId:
      (row.assigned_technician_id as string | null | undefined) !== undefined
        ? ((row.assigned_technician_id as string | null) ?? null)
        : (fromPayload.assignedTechnicianId ?? null),
    assignedTechnicianName:
      (row.assigned_technician_name as string | null | undefined) !== undefined
        ? ((row.assigned_technician_name as string | null) ?? null)
        : (fromPayload.assignedTechnicianName ?? null),
    lockedAfterShip: Boolean(row.locked_after_ship),
    qrToken: row.qr_token
      ? String(row.qr_token)
      : fromPayload.qrToken || String(row.local_id ?? fromPayload.localId ?? "") || undefined,
    qrPrintedAt:
      row.qr_printed_at !== undefined && row.qr_printed_at !== null
        ? String(row.qr_printed_at)
        : (fromPayload.qrPrintedAt ?? null),
  };
}

export async function pullAppMaintenanceRequests(): Promise<MaintenanceRequestRecord[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const [reqRes, devRes] = await Promise.all([
    supabase.from("app_maintenance_requests").select("*"),
    supabase.from("app_request_devices").select("*"),
  ]);
  if (reqRes.error) {
    reportError("app_maintenance_requests", reqRes.error);
    throw reqRes.error;
  }
  if (devRes.error) {
    reportError("app_request_devices", devRes.error);
    throw devRes.error;
  }

  const devicesByRequest = new Map<string, DraftRequestDevice[]>();
  for (const row of devRes.data ?? []) {
    const rec = row as Record<string, unknown>;
    const requestId = String(rec.request_id ?? "");
    const list = devicesByRequest.get(requestId) ?? [];
    list.push(rowToDevice(rec));
    devicesByRequest.set(requestId, list);
  }

  return (reqRes.data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const requestId = String(rec.id ?? "");
    const columnDevices = devicesByRequest.get(requestId) ?? [];
    const fromPayload = asRecord(rec.payload) as MaintenanceRequestRecord | null;
    if (fromPayload?.id && Array.isArray(fromPayload.devices)) {
      // Prefer normalized device columns for claim ownership fields so a stale
      // request payload cannot re-open a device another technician already claimed.
      if (columnDevices.length === 0) return fromPayload;
      const byLocalId = new Map(
        columnDevices.map((device) => [device.localId, device] as const),
      );
      return {
        ...fromPayload,
        devices: fromPayload.devices.map((device) => {
          const fromColumn = byLocalId.get(device.localId);
          if (!fromColumn) return device;
          return {
            ...device,
            lifecycleStatus: fromColumn.lifecycleStatus ?? device.lifecycleStatus,
            currentLocation: fromColumn.currentLocation ?? device.currentLocation,
            assignedTechnicianId:
              fromColumn.assignedTechnicianId ?? device.assignedTechnicianId ?? null,
            assignedTechnicianName:
              fromColumn.assignedTechnicianName ?? device.assignedTechnicianName ?? null,
            maintenanceStartedAt:
              fromColumn.maintenanceStartedAt ?? device.maintenanceStartedAt ?? null,
            maintenanceFinishedAt:
              fromColumn.maintenanceFinishedAt ?? device.maintenanceFinishedAt ?? null,
            qrToken: fromColumn.qrToken || device.qrToken || device.localId,
            qrPrintedAt: fromColumn.qrPrintedAt ?? device.qrPrintedAt ?? null,
          };
        }),
      };
    }
    return {
      id: requestId,
      requestNumber: String(rec.request_number ?? ""),
      receivedAt: String(rec.received_at ?? nowIso()),
      opsBranchId: String(rec.ops_branch_id ?? ""),
      opsBranchName: String(rec.ops_branch_name ?? ""),
      branchStaffId: String(rec.branch_staff_id ?? ""),
      branchStaffName: String(rec.branch_staff_name ?? ""),
      priority: (rec.priority as MaintenanceRequestRecord["priority"]) ?? "normal",
      customerMobile: String(rec.customer_mobile ?? ""),
      contactName: String(rec.contact_name ?? ""),
      purchaseInvoice: String(rec.purchase_invoice ?? ""),
      generalNotes: String(rec.general_notes ?? ""),
      devices: columnDevices,
    };
  });
}

/**
 * Full replace of requests+devices. Concurrent callers must not race:
 * delete-all-then-insert means an older in-flight push can wipe a newer one.
 * Coalesce to the latest snapshot and serialize execution.
 */
let maintenanceRequestsPushTail: Promise<void> = Promise.resolve();
let maintenanceRequestsPushPending: MaintenanceRequestRecord[] | null = null;

async function writeMaintenanceRequestsSnapshot(
  requests: MaintenanceRequestRecord[],
): Promise<SyncResult> {
  try {
    await deleteAll("app_request_devices");
    await deleteAll("app_maintenance_requests");
    await insertRows("app_maintenance_requests", requests.map(requestToRow));
    const deviceRows = requests.flatMap((request) =>
      (request.devices ?? []).map((device) => deviceToRow(request, device)),
    );
    await insertRows("app_request_devices", deviceRows);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppMaintenanceRequests", error);
    reportError("app_maintenance_requests", error);
    return { ok: false, error: message };
  }
}

export async function pushAppMaintenanceRequests(
  requests: MaintenanceRequestRecord[],
): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }

  maintenanceRequestsPushPending = requests;

  const previous = maintenanceRequestsPushTail;
  let release!: () => void;
  maintenanceRequestsPushTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    let last: SyncResult = { ok: true };
    while (maintenanceRequestsPushPending) {
      const snapshot = maintenanceRequestsPushPending;
      maintenanceRequestsPushPending = null;
      last = await writeMaintenanceRequestsSnapshot(snapshot);
    }
    return last;
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function pullAppCatalog(): Promise<DeviceCatalogState> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { deviceTypes: [], brands: [], models: [] };
  }
  const supabase = createClient();
  const [typesRes, brandsRes, modelsRes] = await Promise.all([
    supabase.from("app_catalog_device_types").select("*"),
    supabase.from("app_catalog_brands").select("*"),
    supabase.from("app_catalog_models").select("*"),
  ]);
  if (typesRes.error) throw typesRes.error;
  if (brandsRes.error) throw brandsRes.error;
  if (modelsRes.error) throw modelsRes.error;

  return {
    deviceTypes: (typesRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return { id: String(r.id ?? ""), name: String(r.name ?? "") };
    }),
    brands: (brandsRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return { id: String(r.id ?? ""), name: String(r.name ?? "") };
    }),
    models: (modelsRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return payloadOf(r, () => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        deviceTypeId: String(r.device_type_id ?? ""),
        brandId: String(r.brand_id ?? ""),
        accessories: [],
        spareParts: [],
      }));
    }),
  };
}

export async function pushAppCatalog(catalog: DeviceCatalogState): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_catalog_models");
    await deleteAll("app_catalog_brands");
    await deleteAll("app_catalog_device_types");
    const syncedAt = nowIso();
    await insertRows(
      "app_catalog_device_types",
      catalog.deviceTypes.map((item) => ({
        id: item.id,
        name: item.name,
        synced_at: syncedAt,
      })),
    );
    await insertRows(
      "app_catalog_brands",
      catalog.brands.map((item) => ({
        id: item.id,
        name: item.name,
        synced_at: syncedAt,
      })),
    );
    await insertRows(
      "app_catalog_models",
      catalog.models.map((model) => ({
        id: model.id,
        name: model.name,
        device_type_id: model.deviceTypeId,
        brand_id: model.brandId,
        has_image: Boolean(model.imageDataUrl),
        accessory_count: model.accessories?.length ?? 0,
        spare_part_count: model.spareParts?.length ?? 0,
        payload: model,
        synced_at: syncedAt,
      })),
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppCatalog", error);
    reportError("app_catalog", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Shipping + audit
// ---------------------------------------------------------------------------

function shippingItemToRow(batch: ShippingBatch, item: ShippingBatchItem) {
  return {
    id: item.id,
    batch_id: batch.id,
    batch_number: batch.batchNumber,
    device_code: item.deviceCode,
    model_name: item.modelName,
    color: item.color,
    status: item.status,
    branch_receive_outcome: item.branchReceiveOutcome ?? null,
    payload: item,
    synced_at: nowIso(),
  };
}

function shippingBatchToRow(batch: ShippingBatch) {
  return {
    id: batch.id,
    batch_number: batch.batchNumber,
    shipment_number: batch.shipmentNumber,
    carrier: batch.carrier,
    direction: batch.direction,
    source_name: batch.sourceName,
    destination_name: batch.destinationName,
    ops_branch_id: batch.opsBranchId,
    status: batch.status,
    created_by_name: batch.createdByName,
    created_at: batch.createdAt,
    handed_to_carrier_at: batch.handedToCarrierAt ?? null,
    received_at: batch.receivedAt ?? null,
    item_count: batch.items?.length ?? 0,
    notes: batch.notes ?? null,
    payload: batch,
    synced_at: nowIso(),
  };
}

export async function pullAppShippingBatches(): Promise<ShippingBatch[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const [batchRes, itemRes] = await Promise.all([
    supabase.from("app_shipping_batches").select("*"),
    supabase.from("app_shipping_items").select("*"),
  ]);
  if (batchRes.error) throw batchRes.error;
  if (itemRes.error) throw itemRes.error;

  const itemsByBatch = new Map<string, ShippingBatchItem[]>();
  for (const row of itemRes.data ?? []) {
    const rec = row as Record<string, unknown>;
    const batchId = String(rec.batch_id ?? "");
    const item = payloadOf<ShippingBatchItem>(rec, () => ({
      id: String(rec.id ?? ""),
      requestDeviceId: "",
      deviceCode: String(rec.device_code ?? ""),
      modelName: String(rec.model_name ?? ""),
      color: String(rec.color ?? ""),
      status: (rec.status as ShippingBatchItem["status"]) ?? "active",
      branchReceiveOutcome:
        (rec.branch_receive_outcome as ShippingBatchItem["branchReceiveOutcome"]) ?? null,
    }));
    const list = itemsByBatch.get(batchId) ?? [];
    list.push(item);
    itemsByBatch.set(batchId, list);
  }

  return (batchRes.data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const fromPayload = asRecord(rec.payload) as ShippingBatch | null;
    if (fromPayload?.id && Array.isArray(fromPayload.items)) {
      return fromPayload;
    }
    return {
      id: String(rec.id ?? ""),
      batchNumber: String(rec.batch_number ?? ""),
      shipmentNumber: String(rec.shipment_number ?? ""),
      carrier: String(rec.carrier ?? ""),
      direction: (rec.direction as ShippingBatch["direction"]) ?? "to_service",
      sourceType: "branch",
      sourceName: String(rec.source_name ?? ""),
      opsBranchId: String(rec.ops_branch_id ?? ""),
      destinationType: "service_center",
      destinationName: String(rec.destination_name ?? ""),
      status: (rec.status as ShippingBatch["status"]) ?? "draft",
      createdBy: "",
      createdByName: String(rec.created_by_name ?? ""),
      createdAt: String(rec.created_at ?? nowIso()),
      handedToCarrierAt: (rec.handed_to_carrier_at as string | null) ?? null,
      receivedAt: (rec.received_at as string | null) ?? null,
      notes: rec.notes ? String(rec.notes) : undefined,
      items: itemsByBatch.get(String(rec.id ?? "")) ?? [],
    };
  });
}

export async function pushAppShippingBatches(batches: ShippingBatch[]): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_shipping_items");
    await deleteAll("app_shipping_batches");
    await insertRows("app_shipping_batches", batches.map(shippingBatchToRow));
    const itemRows = batches.flatMap((batch) =>
      (batch.items ?? []).map((item) => shippingItemToRow(batch, item)),
    );
    await insertRows("app_shipping_items", itemRows);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppShippingBatches", error);
    reportError("app_shipping_batches", error);
    return { ok: false, error: message };
  }
}

export async function pullAppAuditEvents(): Promise<Array<Record<string, unknown>>> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_audit_events").select("*");
  if (error) {
    reportError("app_audit_events", error);
    throw error;
  }
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const details = asRecord(rec.details);
    if (details) return details;
    return {
      id: String(rec.id ?? ""),
      type: rec.event_type,
      actorName: rec.actor_name,
      summary: rec.summary,
      createdAt: rec.created_at,
    };
  });
}

export async function pushAppAuditEvents(
  events: Array<Record<string, unknown>>,
): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_audit_events");
    await insertRows(
      "app_audit_events",
      events.map((event, index) => ({
        id: String(event.id ?? event.eventId ?? `audit-${index}`),
        event_type: String(event.type ?? event.eventType ?? event.action ?? ""),
        actor_name: String(event.actorName ?? event.createdByName ?? event.userName ?? ""),
        summary: String(event.summary ?? event.message ?? event.description ?? event.action ?? ""),
        created_at:
          (event.createdAt as string | undefined) ?? (event.at as string | undefined) ?? null,
        details: event,
        synced_at: nowIso(),
      })),
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppAuditEvents", error);
    reportError("app_audit_events", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Technician work
// ---------------------------------------------------------------------------

export async function pullAppTechnicianWork(): Promise<TechnicianWorkRecord[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_technician_work").select("*");
  if (error) {
    reportError("app_technician_work", error);
    throw error;
  }
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    return payloadOf<TechnicianWorkRecord>(rec, () => ({
      id: String(rec.id ?? ""),
      requestId: String(rec.request_id ?? ""),
      requestNumber: String(rec.request_number ?? ""),
      deviceLocalId: String(rec.device_local_id ?? ""),
      deviceCode: String(rec.device_code ?? ""),
      technicianId: String(rec.technician_id ?? ""),
      technicianName: String(rec.technician_name ?? ""),
      startedAt: String(rec.started_at ?? nowIso()),
      finishedAt: rec.finished_at ? String(rec.finished_at) : undefined,
      status: (rec.status as TechnicianWorkRecord["status"]) ?? "in_progress",
      externalCheck: rec.external_check as TechnicianWorkRecord["externalCheck"],
      deviceState: rec.device_state as TechnicianWorkRecord["deviceState"],
      outcome: rec.outcome as TechnicianWorkRecord["outcome"],
      holdReason: rec.hold_reason as TechnicianWorkRecord["holdReason"],
      faultCause: rec.fault_cause ? String(rec.fault_cause) : undefined,
      actionTaken: rec.action_taken ? String(rec.action_taken) : undefined,
      tests: {
        power: (rec.test_power as boolean | null) ?? null,
        pump: (rec.test_pump as boolean | null) ?? null,
        light: (rec.test_light as boolean | null) ?? null,
        sound: (rec.test_sound as boolean | null) ?? null,
        programming: (rec.test_programming as boolean | null) ?? null,
      },
    }));
  });
}

export async function pushAppTechnicianWork(work: TechnicianWorkRecord[]): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_technician_work");
    await insertRows(
      "app_technician_work",
      work.map((item) => ({
        id: item.id,
        request_id: item.requestId,
        request_number: item.requestNumber,
        device_local_id: item.deviceLocalId,
        device_code: item.deviceCode,
        technician_id: item.technicianId,
        technician_name: item.technicianName,
        started_at: item.startedAt,
        finished_at: item.finishedAt ?? null,
        status: item.status,
        external_check: item.externalCheck ?? null,
        device_state: item.deviceState ?? null,
        outcome: item.outcome ?? null,
        hold_reason: item.holdReason ?? null,
        fault_cause: item.faultCause ?? null,
        action_taken: item.actionTaken ?? null,
        test_power: item.tests?.power ?? null,
        test_pump: item.tests?.pump ?? null,
        test_light: item.tests?.light ?? null,
        test_sound: item.tests?.sound ?? null,
        test_programming: item.tests?.programming ?? null,
        spare_parts_summary: (item.sparePartsUsed ?? [])
          .map((p) => `${p.partName}×${p.qty}`)
          .join(", "),
        payload: item,
        synced_at: nowIso(),
      })),
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppTechnicianWork", error);
    reportError("app_technician_work", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Spare inventory
// ---------------------------------------------------------------------------

export async function pullAppSpareInventory(): Promise<SpareInventoryState> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { balances: [], receipts: [], movements: [] };
  }
  const supabase = createClient();
  const [balRes, recRes, movRes] = await Promise.all([
    supabase.from("app_spare_balances").select("*"),
    supabase.from("app_spare_receipts").select("*"),
    supabase.from("app_spare_movements").select("*"),
  ]);
  if (balRes.error) throw balRes.error;
  // receipts/movements tables appear in migration 017 — tolerate missing until applied
  const receiptsMissing =
    recRes.error &&
    /relation .* does not exist|PGRST205|42P01/i.test(recRes.error.message ?? "");
  const movementsMissing =
    movRes.error &&
    /relation .* does not exist|PGRST205|42P01/i.test(movRes.error.message ?? "");
  if (recRes.error && !receiptsMissing) throw recRes.error;
  if (movRes.error && !movementsMissing) throw movRes.error;

  const balances: SpareInventoryBalance[] = (balRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return payloadOf<SpareInventoryBalance>(r, () => ({
      id: String(r.id ?? ""),
      modelId: String(r.model_id ?? ""),
      modelName: String(r.model_name ?? ""),
      partId: String(r.part_id ?? ""),
      partName: String(r.part_name ?? ""),
      color: r.color ? String(r.color) : undefined,
      quantity: Number(r.quantity ?? 0),
      updatedAt: String(r.updated_at ?? nowIso()),
    }));
  });

  const receipts: SpareReceiveReceipt[] = receiptsMissing
    ? []
    : (recRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return payloadOf<SpareReceiveReceipt>(r, () => ({
          id: String(r.id ?? ""),
          receiptNumber: String(r.receipt_number ?? ""),
          receiptDate: String(r.receipt_date ?? ""),
          supplier: String(r.supplier ?? ""),
          receiptPhotoName: "",
          receiptPhotoDataUrl: "",
          lines: [],
          receivedById: "",
          receivedByName: "",
          createdAt: String(r.synced_at ?? nowIso()),
        }));
      });

  const movements: SpareStockMovement[] = movementsMissing
    ? []
    : (movRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return payloadOf<SpareStockMovement>(r, () => ({
          id: String(r.id ?? ""),
          type: (r.type as SpareStockMovement["type"]) ?? "receive",
          balanceId: "",
          modelId: "",
          modelName: "",
          partId: "",
          partName: "",
          quantity: 0,
          actorId: "",
          actorName: "",
          createdAt: String(r.synced_at ?? nowIso()),
        }));
      });

  return { balances, receipts, movements };
}

export async function pushAppSpareInventory(state: SpareInventoryState): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_spare_balances");
    const syncedAt = nowIso();
    await insertRows(
      "app_spare_balances",
      state.balances.map((b) => ({
        id: b.id,
        model_id: b.modelId,
        model_name: b.modelName,
        part_id: b.partId,
        part_name: b.partName,
        color: b.color ?? null,
        quantity: b.quantity,
        updated_at: b.updatedAt,
        payload: b,
        synced_at: syncedAt,
      })),
    );

    // Optional tables (017) — ignore if not created yet
    try {
      await deleteAll("app_spare_receipts");
      await insertRows(
        "app_spare_receipts",
        state.receipts.map((r) => ({
          id: r.id,
          receipt_number: r.receiptNumber,
          receipt_date: r.receiptDate,
          supplier: r.supplier,
          payload: r,
          synced_at: syncedAt,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/relation .* does not exist|PGRST205|42P01/i.test(message)) throw error;
    }

    try {
      await deleteAll("app_spare_movements");
      await insertRows(
        "app_spare_movements",
        state.movements.map((m) => ({
          id: m.id,
          type: m.type,
          payload: m,
          synced_at: syncedAt,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/relation .* does not exist|PGRST205|42P01/i.test(message)) throw error;
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppSpareInventory", error);
    reportError("app_spare", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Waybills
// ---------------------------------------------------------------------------

export async function pullAppWaybills(): Promise<WaybillRecord[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_waybills").select("*");
  if (error) {
    reportError("app_waybills", error);
    throw error;
  }
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    return payloadOf<WaybillRecord>(rec, () => ({
      id: String(rec.id ?? ""),
      waybillNumber: String(rec.waybill_number ?? ""),
      courierCompany: String(rec.courier_company ?? ""),
      opsBranchId: String(rec.ops_branch_id ?? ""),
      deviceCodes: String(rec.device_codes ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      removedDeviceCodes: [],
    }));
  });
}

export async function pushAppWaybills(waybills: WaybillRecord[]): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_waybills");
    await insertRows(
      "app_waybills",
      waybills.map((w) => ({
        id: w.id,
        waybill_number: w.waybillNumber,
        courier_company: w.courierCompany,
        ops_branch_id: w.opsBranchId,
        device_codes: (w.deviceCodes ?? []).join(", "),
        payload: w,
        synced_at: nowIso(),
      })),
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppWaybills", error);
    reportError("app_waybills", error);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Pickup receipts (نموذج استلام مندوب)
// ---------------------------------------------------------------------------

function pickupReceiptToRow(receipt: PickupReceipt) {
  return {
    id: receipt.id,
    receipt_number: receipt.receiptNumber,
    direction: receipt.direction,
    ops_branch_id: receipt.opsBranchId,
    ops_branch_name: receipt.opsBranchName,
    created_by: receipt.createdBy,
    created_by_name: receipt.createdByName,
    assigned_courier_id: receipt.assignedCourierId,
    assigned_courier_name: receipt.assignedCourierName,
    status: receipt.status,
    created_at: receipt.createdAt,
    submitted_at: receipt.submittedAt ?? null,
    courier_reviewed_at: receipt.courierReviewedAt ?? null,
    line_count: receipt.lines?.length ?? 0,
    notes: receipt.notes ?? null,
    payload: receipt,
    synced_at: nowIso(),
  };
}

export async function pullAppPickupReceipts(): Promise<PickupReceipt[]> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("app_pickup_receipts").select("*");
  if (error) {
    // Table may not exist until migration 021 — treat as empty.
    if (/does not exist|PGRST|42P01|schema cache/i.test(error.message ?? "")) {
      reportError("app_pickup_receipts", error);
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const fromPayload = asRecord(rec.payload) as PickupReceipt | null;
    if (fromPayload?.id && Array.isArray(fromPayload.lines)) {
      return fromPayload;
    }
    return {
      id: String(rec.id ?? ""),
      receiptNumber: String(rec.receipt_number ?? ""),
      direction: (rec.direction as PickupReceipt["direction"]) ?? "branch_to_center",
      opsBranchId: String(rec.ops_branch_id ?? ""),
      opsBranchName: String(rec.ops_branch_name ?? ""),
      createdBy: String(rec.created_by ?? ""),
      createdByName: String(rec.created_by_name ?? ""),
      assignedCourierId: String(rec.assigned_courier_id ?? ""),
      assignedCourierName: String(rec.assigned_courier_name ?? ""),
      status: (rec.status as PickupReceipt["status"]) ?? "draft",
      createdAt: String(rec.created_at ?? nowIso()),
      submittedAt: (rec.submitted_at as string | null) ?? null,
      courierReviewedAt: (rec.courier_reviewed_at as string | null) ?? null,
      notes: rec.notes ? String(rec.notes) : undefined,
      lines: [],
    };
  });
}

export async function pushAppPickupReceipts(receipts: PickupReceipt[]): Promise<SyncResult> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return { ok: false, error: "Supabase is not configured." };
  }
  try {
    await deleteAll("app_pickup_receipts");
    await insertRows("app_pickup_receipts", receipts.map(pickupReceiptToRow));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[arms] pushAppPickupReceipts", error);
    reportError("app_pickup_receipts", error);
    return { ok: false, error: message };
  }
}
