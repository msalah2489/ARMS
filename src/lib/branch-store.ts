import { generateRequestNumber } from "@/lib/branch-catalog";
import type {
  DeviceLifecycleStatus,
  DraftRequestDevice,
  MaintenanceRequestRecord,
  Profile,
  WaybillRecord,
} from "@/types/domain";

const REQUESTS_KEY = "arms_maintenance_requests_v1";
const WAYBILLS_KEY = "arms_waybills_v1";
const REQUESTS_SEED_FLAG = "arms_maintenance_requests_seeded_v1";

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

function sampleDevice(
  input: Partial<DraftRequestDevice> &
    Pick<DraftRequestDevice, "localId" | "deviceCode" | "serialNumber" | "receiptNumber" | "lifecycleStatus">,
): DraftRequestDevice {
  return {
    deviceTypeId: "type-pos",
    deviceTypeName: "جهاز نقاط بيع",
    brandId: "brand-sunmi",
    brandName: "Sunmi",
    modelId: "model-v2",
    modelName: "V2 Pro",
    fault: "لا يعمل الشاشة",
    externalCondition: "intact",
    accessoryIds: [],
    accessoryNames: [],
    extraDetails: "",
    devicePhotoNames: [],
    deviceImageDataUrl: undefined,
    receiptPhotoName: "",
    receiptPhotoDataUrl: undefined,
    color: "أسود",
    currentLocation: "branch",
    lockedAfterShip: false,
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    ...input,
  };
}

/** Demo workflow samples so shipping/return screens are usable immediately. */
function ensureSeededMaintenanceRequests() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(REQUESTS_SEED_FLAG) === "1") return;

  const existing = readJson<MaintenanceRequestRecord[]>(REQUESTS_KEY, []);
  if (existing.length > 0) {
    window.localStorage.setItem(REQUESTS_SEED_FLAG, "1");
    return;
  }

  const now = new Date().toISOString();
  const branchId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
  const seeded: MaintenanceRequestRecord[] = [
    {
      id: "req-seed-outbound",
      requestNumber: "MR-SEED-1001",
      receivedAt: now,
      opsBranchId: branchId,
      opsBranchName: "فرع الرياض",
      branchStaffId: "branch-local",
      branchStaffName: "نورة الفرع",
      priority: "normal",
      customerMobile: "0501111001",
      contactName: "عميل تجريبي ١",
      purchaseInvoice: "INV-1001",
      generalNotes: "بيانات تجريبية للإرسال إلى الصيانة",
      devices: [
        sampleDevice({
          localId: "dev-seed-ship-1",
          deviceCode: "DV-SEED-001",
          serialNumber: "SN-SEED-001",
          receiptNumber: "RCP-SEED-001",
          lifecycleStatus: "received_at_branch",
          currentLocation: "branch",
        }),
        sampleDevice({
          localId: "dev-seed-ship-2",
          deviceCode: "DV-SEED-002",
          serialNumber: "SN-SEED-002",
          receiptNumber: "RCP-SEED-002",
          lifecycleStatus: "received_at_branch",
          currentLocation: "branch",
          fault: "طابعة لا تستجيب",
        }),
      ],
    },
    {
      id: "req-seed-return",
      requestNumber: "MR-SEED-1002",
      receivedAt: now,
      opsBranchId: branchId,
      opsBranchName: "فرع الرياض",
      branchStaffId: "branch-local",
      branchStaffName: "نورة الفرع",
      priority: "urgent",
      customerMobile: "0501111002",
      contactName: "عميل تجريبي ٢",
      purchaseInvoice: "INV-1002",
      generalNotes: "أجهزة جاهزة للإرجاع إلى الفرع",
      devices: [
        sampleDevice({
          localId: "dev-seed-return-1",
          deviceCode: "DV-SEED-101",
          serialNumber: "SN-SEED-101",
          receiptNumber: "RCP-SEED-101",
          lifecycleStatus: "ready_to_return",
          currentLocation: "service_center",
          fault: "تم الإصلاح — جاهز للإرجاع",
          assignedTechnicianId: "tech-local",
          assignedTechnicianName: "كريم الفني",
        }),
        sampleDevice({
          localId: "dev-seed-return-2",
          deviceCode: "DV-SEED-102",
          serialNumber: "SN-SEED-102",
          receiptNumber: "RCP-SEED-102",
          lifecycleStatus: "ready_to_return",
          currentLocation: "service_center",
          fault: "لا يحتاج إصلاح — جاهز للإرجاع",
          assignedTechnicianId: "tech-local",
          assignedTechnicianName: "كريم الفني",
        }),
      ],
    },
    {
      id: "req-seed-tech",
      requestNumber: "MR-SEED-1003",
      receivedAt: now,
      opsBranchId: branchId,
      opsBranchName: "فرع الرياض",
      branchStaffId: "branch-local",
      branchStaffName: "نورة الفرع",
      priority: "normal",
      customerMobile: "0501111003",
      contactName: "عميل تجريبي ٣",
      purchaseInvoice: "INV-1003",
      generalNotes: "بانتظار الفني في مركز الصيانة",
      devices: [
        sampleDevice({
          localId: "dev-seed-tech-1",
          deviceCode: "DV-SEED-201",
          serialNumber: "SN-SEED-201",
          receiptNumber: "RCP-SEED-201",
          lifecycleStatus: "awaiting_maintenance",
          currentLocation: "service_center",
          fault: "بطء في التشغيل",
        }),
      ],
    },
  ];

  writeJson(REQUESTS_KEY, seeded);
  window.localStorage.setItem(REQUESTS_SEED_FLAG, "1");
}

export function listMaintenanceRequests(opsBranchId?: string | null) {
  ensureSeededMaintenanceRequests();
  repairLegacyDeviceStatuses();
  const all = readJson<MaintenanceRequestRecord[]>(REQUESTS_KEY, []);
  if (!opsBranchId) return all;
  return all.filter((item) => item.opsBranchId === opsBranchId);
}

export function getMaintenanceRequestById(id: string) {
  return listMaintenanceRequests().find((item) => item.id === id) ?? null;
}

export function saveMaintenanceRequest(input: {
  user: Profile;
  priority: "normal" | "urgent";
  customerMobile: string;
  contactName: string;
  purchaseInvoice: string;
  generalNotes: string;
  devices: DraftRequestDevice[];
  requestNumber?: string;
}) {
  const existingReceipts = new Set(
    listMaintenanceRequests()
      .flatMap((request) => request.devices)
      .map((device) => device.receiptNumber.trim()),
  );
  for (const device of input.devices) {
    const receipt = device.receiptNumber.trim();
    if (!receipt) {
      throw new Error("رقم سند الاستلام إلزامي لكل جهاز.");
    }
    if (existingReceipts.has(receipt)) {
      throw new Error(`رقم سند الاستلام «${receipt}» مستخدم مسبقًا لجهاز آخر.`);
    }
    existingReceipts.add(receipt);
  }

  const record: MaintenanceRequestRecord = {
    id: crypto.randomUUID(),
    requestNumber: input.requestNumber || generateRequestNumber(),
    receivedAt: new Date().toISOString(),
    opsBranchId: input.user.opsBranchId || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    opsBranchName: input.user.opsBranchName || "فرع الرياض",
    branchStaffId: input.user.id,
    branchStaffName: input.user.fullName,
    priority: input.priority,
    customerMobile: input.customerMobile,
    contactName: input.contactName,
    purchaseInvoice: input.purchaseInvoice,
    generalNotes: input.generalNotes,
    devices: input.devices.map((device) => ({
      ...device,
      lifecycleStatus: device.lifecycleStatus ?? "received_at_branch",
      currentLocation: device.currentLocation ?? "branch",
      lockedAfterShip: device.lockedAfterShip ?? false,
      assignedTechnicianId: device.assignedTechnicianId ?? null,
      assignedTechnicianName: device.assignedTechnicianName ?? null,
    })),
  };

  const all = listMaintenanceRequests();
  writeJson(REQUESTS_KEY, [record, ...all]);
  return record;
}

export function findCustomersByMobile(mobile: string) {
  return listMaintenanceRequests()
    .filter((item) => item.customerMobile === mobile)
    .map((item) => ({ contactName: item.contactName, mobile: item.customerMobile }));
}

export function findCustomersByName(name: string) {
  const q = name.trim().toLowerCase();
  return listMaintenanceRequests()
    .filter((item) => item.contactName.toLowerCase().includes(q))
    .map((item) => ({ contactName: item.contactName, mobile: item.customerMobile }));
}

export function listWaybills(opsBranchId?: string | null) {
  const seeded: WaybillRecord[] = [
    {
      id: "wb1",
      waybillNumber: "WB-45021",
      courierCompany: "SMSA",
      opsBranchId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      deviceCodes: [],
      removedDeviceCodes: [],
    },
  ];
  const stored = readJson<WaybillRecord[]>(WAYBILLS_KEY, []);
  const all = stored.length ? stored : seeded;
  if (!opsBranchId) return all;
  return all.filter((item) => item.opsBranchId === opsBranchId);
}

export function ensureWaybillsHaveDevices(opsBranchId: string) {
  const requests = listMaintenanceRequests(opsBranchId);
  const deviceCodes = requests.flatMap((req) => req.devices.map((d) => d.deviceCode));
  const waybills = listWaybills(opsBranchId);
  if (!waybills.length) {
    const created: WaybillRecord = {
      id: crypto.randomUUID(),
      waybillNumber: "WB-" + Math.floor(Math.random() * 90000 + 10000),
      courierCompany: "Aramex",
      opsBranchId,
      deviceCodes: deviceCodes.slice(0, 3),
      removedDeviceCodes: [],
    };
    writeJson(WAYBILLS_KEY, [created]);
    return [created];
  }
  if (!waybills[0].deviceCodes.length && deviceCodes.length) {
    waybills[0].deviceCodes = deviceCodes.slice(0, 3);
    writeJson(WAYBILLS_KEY, waybills);
  }
  return waybills;
}

export function removeDeviceFromWaybill(waybillId: string, deviceCode: string, note: string) {
  const all = listWaybills();
  const next = all.map((wb) => {
    if (wb.id !== waybillId) return wb;
    return {
      ...wb,
      deviceCodes: wb.deviceCodes.filter((code) => code !== deviceCode),
      removedDeviceCodes: [...wb.removedDeviceCodes, { deviceCode, note }],
    };
  });
  writeJson(WAYBILLS_KEY, next);
  return next;
}

export function findDeviceHistory(query: string) {
  const q = query.trim().toLowerCase();
  const matches = listMaintenanceRequests().flatMap((req) =>
    req.devices
      .filter(
        (device) =>
          device.deviceCode.toLowerCase() === q ||
          device.serialNumber.toLowerCase() === q ||
          device.deviceCode.toLowerCase().includes(q),
      )
      .map((device) => ({ request: req, device })),
  );
  return matches;
}

export function updateDeviceLifecycle(
  requestId: string,
  deviceLocalId: string,
  patch: Partial<DraftRequestDevice>,
) {
  const all = listMaintenanceRequests();
  const next = all.map((request) => {
    if (request.id !== requestId) return request;
    return {
      ...request,
      devices: request.devices.map((device) =>
        device.localId === deviceLocalId ? { ...device, ...patch } : device,
      ),
    };
  });
  writeJson(REQUESTS_KEY, next);
  return next;
}

export type TechnicianQueueItem = {
  request: MaintenanceRequestRecord;
  device: DraftRequestDevice;
};

export function listAllRequestDevices(): TechnicianQueueItem[] {
  return listMaintenanceRequests().flatMap((request) =>
    request.devices.map((device) => ({ request, device })),
  );
}

/** Devices already at the service center awaiting technician work. */
export function ensureTechnicianQueue(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter((item) => {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    return ["awaiting_maintenance", "in_maintenance"].includes(status);
  });
}

export function listAwaitingMaintenanceDevices(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter((item) => {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "awaiting_maintenance") return false;
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    return !assigned;
  });
}

/** Clear stale technician assignment when device is still marked ready for maintenance. */
export function repairStaleTechnicianAssignments() {
  for (const item of listAllRequestDevices()) {
    const status = normalizeLifecycleStatus(item.device.lifecycleStatus);
    if (status !== "awaiting_maintenance") continue;
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    if (!assigned) continue;
    updateDeviceLifecycle(item.request.id, item.device.localId, {
      assignedTechnicianId: null,
      assignedTechnicianName: null,
    });
  }
}

/** Canonical English keys → Arabic labels (7 primary + internal/legacy). */
export const DEVICE_STATUS_LABELS: Record<string, string> = {
  received_at_branch: "مستلم بالفرع",
  in_transit_to_service: "جاري الشحن",
  awaiting_maintenance: "بانتظار الصيانة",
  in_maintenance: "جاري الصيانة",
  in_return_transit: "فى الطريق الى الفرع",
  awaiting_customer: "بانتظار العميل",
  awaiting_manager_decision: "معلق",
  // Internal ops (between maintenance complete and return waybill)
  ready_to_return: "جاهز للإرجاع للفرع",
  ready_to_send: "جاهز للإرجاع للفرع",
  excluded_from_shipment: "مستبعد من البوليصة",
  delivered_to_customer: "تم التسليم للعميل",
  closed: "تم إغلاق الحالة",
  // Legacy → same wording as the 7 statuses
  awaiting_branch_handover: "جاري الشحن",
  handed_to_carrier: "جاري الشحن",
  in_shipping: "جاري الشحن",
  ready_to_ship: "مستلم بالفرع",
  received_at_warehouse: "بانتظار الصيانة",
  at_service_center: "بانتظار الصيانة",
  under_maintenance: "جاري الصيانة",
  returning_from_service: "فى الطريق الى الفرع",
  received_at_destination: "بانتظار العميل",
  received_damaged: "بانتظار العميل",
  excluded: "معلق",
};

/** English display labels for the primary lifecycle set. */
export const DEVICE_STATUS_LABELS_EN: Record<string, string> = {
  received_at_branch: "Received at branch",
  in_transit_to_service: "Shipping in progress",
  awaiting_maintenance: "Awaiting maintenance",
  in_maintenance: "In maintenance",
  in_return_transit: "On the way to branch",
  awaiting_customer: "Awaiting customer",
  awaiting_manager_decision: "On hold",
  ready_to_return: "Ready to return",
  ready_to_send: "Ready to return",
  excluded_from_shipment: "Excluded from shipment",
  delivered_to_customer: "Delivered to customer",
  closed: "Closed",
  awaiting_branch_handover: "Shipping in progress",
  handed_to_carrier: "Shipping in progress",
  in_shipping: "Shipping in progress",
  ready_to_ship: "Received at branch",
  received_at_warehouse: "Awaiting maintenance",
  at_service_center: "Awaiting maintenance",
  under_maintenance: "In maintenance",
  returning_from_service: "On the way to branch",
  received_at_destination: "Awaiting customer",
  received_damaged: "Awaiting customer",
  excluded: "On hold",
};

/** Machine location keys → Arabic. */
export const DEVICE_LOCATION_LABELS: Record<string, string> = {
  branch: "الفرع",
  in_transit_to_service: "في الطريق إلى الصيانة",
  service_center: "مركز الصيانة",
  in_return_transit: "في الطريق إلى الفرع",
  customer: "العميل",
};

/** Map legacy lifecycle keys to the canonical 7 (+ ready_to_return). */
export function normalizeLifecycleStatus(
  status: string | null | undefined,
): DeviceLifecycleStatus {
  const key = (status ?? "received_at_branch").trim();
  const map: Record<string, DeviceLifecycleStatus> = {
    received_at_branch: "received_at_branch",
    ready_to_ship: "received_at_branch",
    awaiting_branch_handover: "in_transit_to_service",
    handed_to_carrier: "in_transit_to_service",
    in_transit_to_service: "in_transit_to_service",
    in_shipping: "in_transit_to_service",
    received_at_warehouse: "awaiting_maintenance",
    at_service_center: "awaiting_maintenance",
    awaiting_maintenance: "awaiting_maintenance",
    in_maintenance: "in_maintenance",
    under_maintenance: "in_maintenance",
    ready_to_return: "ready_to_return",
    ready_to_send: "ready_to_return",
    awaiting_manager_decision: "awaiting_manager_decision",
    excluded: "awaiting_manager_decision",
    in_return_transit: "in_return_transit",
    returning_from_service: "in_return_transit",
    awaiting_customer: "awaiting_customer",
    received_at_destination: "awaiting_customer",
    received_damaged: "awaiting_customer",
    excluded_from_shipment: "excluded_from_shipment",
    delivered_to_customer: "delivered_to_customer",
    closed: "closed",
  };
  return map[key] ?? (key as DeviceLifecycleStatus);
}

/** Expected location for a canonical lifecycle status. */
export function locationForLifecycleStatus(
  status: string | null | undefined,
): string {
  switch (normalizeLifecycleStatus(status)) {
    case "received_at_branch":
    case "awaiting_customer":
    case "excluded_from_shipment":
      return "branch";
    case "in_transit_to_service":
      return "in_transit_to_service";
    case "awaiting_maintenance":
    case "in_maintenance":
    case "awaiting_manager_decision":
    case "ready_to_return":
    case "closed":
      return "service_center";
    case "in_return_transit":
      return "in_return_transit";
    case "delivered_to_customer":
      return "customer";
    default:
      return "branch";
  }
}

export function deviceLocationLabel(location: string | null | undefined) {
  const key = (location ?? "").trim();
  return DEVICE_LOCATION_LABELS[key] ?? key;
}

/** Rewrite legacy statuses/locations on stored devices so demo data keeps working. */
export function repairLegacyDeviceStatuses() {
  if (typeof window === "undefined") return;
  const all = readJson<MaintenanceRequestRecord[]>(REQUESTS_KEY, []);
  let changed = false;
  for (const request of all) {
    for (const device of request.devices) {
      const raw = (device.lifecycleStatus ?? "").trim();
      if (!raw) continue;
      const next = normalizeLifecycleStatus(raw);
      const nextLoc = locationForLifecycleStatus(next);
      if (device.lifecycleStatus !== next || (device.currentLocation ?? "") !== nextLoc) {
        device.lifecycleStatus = next;
        device.currentLocation = nextLoc;
        changed = true;
      }
    }
  }
  if (changed) writeJson(REQUESTS_KEY, all);
}

export function deviceStatusLabel(
  status: string | null | undefined,
  _audience: "technician" | "branch" | "default" = "default",
) {
  const key = status ?? "received_at_branch";
  return DEVICE_STATUS_LABELS[key] ?? DEVICE_STATUS_LABELS[normalizeLifecycleStatus(key)] ?? key;
}
