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

export function listMaintenanceRequests(opsBranchId?: string | null) {
  const all = readJson<MaintenanceRequestRecord[]>(REQUESTS_KEY, []);
  if (!opsBranchId) return all;
  return all.filter((item) => item.opsBranchId === opsBranchId);
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
  return listAllRequestDevices().filter(
    (item) =>
      ["at_service_center", "awaiting_maintenance", "in_maintenance", "under_maintenance"].includes(
        item.device.lifecycleStatus ?? "",
      ),
  );
}

export function listAwaitingMaintenanceDevices(): TechnicianQueueItem[] {
  return listAllRequestDevices().filter(
    (item) =>
      ["at_service_center", "awaiting_maintenance"].includes(item.device.lifecycleStatus ?? "") &&
      !item.device.assignedTechnicianId,
  );
}

/** Default / technician-facing lifecycle labels. */
export const DEVICE_STATUS_LABELS: Record<string, string> = {
  received_at_branch: "مستلم بالفرع",
  awaiting_branch_handover: "بانتظار تسليم الفرع للشحن",
  handed_to_carrier: "تم التسليم لشركة الشحن",
  in_transit_to_service: "في الطريق إلى الصيانة",
  received_at_warehouse: "مستلم بالمستودع",
  at_service_center: "جاهز للصيانة",
  awaiting_maintenance: "جاهز للصيانة",
  in_maintenance: "قيد الصيانة",
  ready_to_return: "جاهز للإرجاع",
  in_return_transit: "في طريق الإرجاع",
  received_at_destination: "مستلم بالوجهة",
  excluded_from_shipment: "مستبعد من البوليصة",
  ready_to_ship: "جاهز للشحن",
  in_shipping: "قيد الشحن",
  under_maintenance: "قيد الصيانة",
  returning_from_service: "قادم من الصيانة",
  delivered_to_customer: "تم التسليم للعميل",
  ready_to_send: "جاهز للإرسال",
  excluded: "مستبعد",
};

/** Branch-facing labels: once at service center, show "في الصيانة". */
const BRANCH_IN_SERVICE_STATUSES = new Set([
  "received_at_warehouse",
  "at_service_center",
  "awaiting_maintenance",
  "in_maintenance",
  "under_maintenance",
]);

export function deviceStatusLabel(
  status: string | null | undefined,
  audience: "technician" | "branch" | "default" = "default",
) {
  const key = status ?? "received_at_branch";
  if (audience === "branch" && BRANCH_IN_SERVICE_STATUSES.has(key)) {
    return "في الصيانة";
  }
  return DEVICE_STATUS_LABELS[key] ?? key;
}
