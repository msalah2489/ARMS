import {
  deviceLocationLabel,
  getMaintenanceRequestById,
  listAllRequestDevices,
  listMaintenanceRequests,
  locationForLifecycleStatus,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";
import { listOpsBranchRecords } from "@/lib/branches-store";
import type { AppLocale } from "@/lib/preferences";
import type {
  Branch,
  Customer,
  Device,
  DeviceStatus,
  MaintenanceRequestRecord,
  RequestPriority,
  ServiceRequest,
  ServiceRequestStatus,
} from "@/types/domain";

function mapPriority(priority: MaintenanceRequestRecord["priority"]): RequestPriority {
  return priority === "urgent" ? "urgent" : "normal";
}

function mapLifecycleToRequestStatus(status: string | undefined): ServiceRequestStatus {
  switch (normalizeLifecycleStatus(status)) {
    case "received_at_branch":
    case "excluded_from_shipment":
      return "new";
    case "in_transit_to_service":
    case "in_return_transit":
      return "dispatched";
    case "awaiting_maintenance":
      return "at_service_center";
    case "in_maintenance":
      return "in_progress";
    case "awaiting_manager_decision":
      return "in_review";
    case "ready_to_return":
      return "testing";
    case "awaiting_customer":
      return "completed";
    case "delivered_to_customer":
    case "closed":
      return "closed";
    default:
      return "new";
  }
}

function mapLifecycleToDeviceStatus(status: string | undefined): DeviceStatus {
  switch (normalizeLifecycleStatus(status)) {
    case "in_maintenance":
    case "awaiting_maintenance":
    case "awaiting_manager_decision":
      return "under_maintenance";
    case "in_transit_to_service":
      return "sent_to_service_center";
    case "ready_to_return":
    case "in_return_transit":
      return "under_service_center_maintenance";
    case "delivered_to_customer":
    case "closed":
    case "awaiting_customer":
      return "active";
    default:
      return "active";
  }
}

function summarizeRequestStatus(request: MaintenanceRequestRecord): ServiceRequestStatus {
  const statuses = request.devices.map((device) =>
    normalizeLifecycleStatus(device.lifecycleStatus),
  );
  if (statuses.every((status) => ["delivered_to_customer", "closed"].includes(status))) {
    return "closed";
  }
  if (
    statuses.every((status) =>
      ["awaiting_customer", "delivered_to_customer", "closed"].includes(status),
    )
  ) {
    return "completed";
  }
  if (statuses.some((status) => status === "in_maintenance")) {
    return "in_progress";
  }
  if (statuses.some((status) => status === "awaiting_manager_decision")) {
    return "in_review";
  }
  if (statuses.some((status) => status === "awaiting_maintenance")) {
    return "at_service_center";
  }
  if (statuses.some((status) => ["in_transit_to_service", "in_return_transit"].includes(status))) {
    return "dispatched";
  }
  return mapLifecycleToRequestStatus(statuses[0]);
}

/** Convert branch-created maintenance requests into the shared ServiceRequest list shape. */
export function listOpsServiceRequests(): ServiceRequest[] {
  return listMaintenanceRequests()
    .map((request) => {
      const first = request.devices[0];
      const tech =
        request.devices.find((device) => device.assignedTechnicianName)?.assignedTechnicianName ??
        null;
      const problem =
        first?.fault?.trim() ||
        request.generalNotes?.trim() ||
        (request.devices.length > 1 ? `${request.devices.length} أجهزة` : "—");

      return {
        id: request.id,
        requestNumber: request.requestNumber,
        customerName: request.contactName,
        branchName: request.opsBranchName,
        deviceCode:
          request.devices.length > 1
            ? `${first?.deviceCode ?? "—"} (+${request.devices.length - 1})`
            : first?.deviceCode ?? "—",
        serialNumber: first?.serialNumber ?? "—",
        reportedProblem: problem,
        priority: mapPriority(request.priority),
        status: summarizeRequestStatus(request),
        assignedTechnician: tech,
        requestedAt: request.receivedAt,
      } satisfies ServiceRequest;
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** Convert all devices on maintenance requests into the shared Device list shape. */
export function listOpsDevices(): Device[] {
  return listAllRequestDevices()
    .map(({ request, device }) => ({
      id: device.localId,
      deviceCode: device.deviceCode,
      serialNumber: device.serialNumber,
      modelName: device.modelName,
      brand: device.brandName,
      color: device.color ?? "",
      customerName: request.contactName,
      branchName: request.opsBranchName,
      status: mapLifecycleToDeviceStatus(device.lifecycleStatus),
      currentLocation: deviceLocationLabel(
        device.currentLocation || locationForLifecycleStatus(device.lifecycleStatus),
      ),
      qrCode: device.deviceCode,
    }))
    .sort((a, b) => a.deviceCode.localeCompare(b.deviceCode, "ar"));
}

export function getOpsServiceRequest(id: string): ServiceRequest | null {
  return listOpsServiceRequests().find((item) => item.id === id) ?? null;
}

export function getOpsDevice(id: string): Device | null {
  return listOpsDevices().find((item) => item.id === id) ?? null;
}

/**
 * Customers registered via branch receiving / service requests (localStorage).
 * One row per mobile number, with aggregated branch and device counts.
 */
export function listOpsCustomers(): Customer[] {
  type Acc = {
    contactName: string;
    phone: string;
    branchIds: Set<string>;
    branchNames: string[];
    deviceCount: number;
    lastAt: string;
  };

  const byMobile = new Map<string, Acc>();

  for (const request of listMaintenanceRequests()) {
    const phone = request.customerMobile.trim();
    if (!phone) continue;

    const branchKey = request.opsBranchId || request.opsBranchName || "unknown";
    const existing = byMobile.get(phone);
    if (!existing) {
      byMobile.set(phone, {
        contactName: request.contactName.trim() || phone,
        phone,
        branchIds: new Set([branchKey]),
        branchNames: request.opsBranchName ? [request.opsBranchName] : [],
        deviceCount: request.devices.length,
        lastAt: request.receivedAt,
      });
      continue;
    }

    existing.branchIds.add(branchKey);
    if (request.opsBranchName && !existing.branchNames.includes(request.opsBranchName)) {
      existing.branchNames.push(request.opsBranchName);
    }
    existing.deviceCount += request.devices.length;
    if (request.receivedAt > existing.lastAt) {
      existing.lastAt = request.receivedAt;
      const name = request.contactName.trim();
      if (name) existing.contactName = name;
    }
  }

  return [...byMobile.values()]
    .map(
      (item) =>
        ({
          id: `ops-customer-${item.phone}`,
          name: item.contactName,
          contactName: item.contactName,
          phone: item.phone,
          email: "",
          address: item.branchNames.join(" · "),
          branchCount: item.branchIds.size,
          deviceCount: item.deviceCount,
        }) satisfies Customer,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/** Branches from admin CRUD (`arms_ops_branches_v1`), same source as /admin/branches. */
export function listOpsBranches(locale: AppLocale = "ar"): Branch[] {
  const serviceCenterLabel = locale === "en" ? "Service center" : "مركز صيانة";
  const branchLabel = locale === "en" ? "Branch" : "فرع";

  return listOpsBranchRecords().map(
    (item) =>
      ({
        id: item.id,
        customerId: "",
        customerName: item.isServiceCenter ? serviceCenterLabel : branchLabel,
        name: item.name,
        code: item.code,
        address: item.city,
        phone: "",
      }) satisfies Branch,
  );
}

export { getMaintenanceRequestById };
