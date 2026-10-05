import {
  deviceStatusLabel,
  getMaintenanceRequestById,
  listAllRequestDevices,
  listMaintenanceRequests,
} from "@/lib/branch-store";
import type {
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
  switch (status) {
    case "received_at_branch":
    case "excluded_from_shipment":
      return "new";
    case "awaiting_branch_handover":
    case "in_transit_to_service":
    case "handed_to_carrier":
    case "in_return_transit":
    case "returning_from_service":
      return "dispatched";
    case "awaiting_maintenance":
    case "at_service_center":
    case "received_at_warehouse":
      return "at_service_center";
    case "in_maintenance":
    case "under_maintenance":
      return "in_progress";
    case "awaiting_manager_decision":
      return "in_review";
    case "ready_to_return":
    case "ready_to_send":
      return "testing";
    case "received_at_destination":
    case "received_damaged":
      return "completed";
    case "delivered_to_customer":
    case "closed":
      return "closed";
    default:
      return "new";
  }
}

function mapLifecycleToDeviceStatus(status: string | undefined): DeviceStatus {
  switch (status) {
    case "in_maintenance":
    case "under_maintenance":
    case "awaiting_maintenance":
    case "at_service_center":
    case "awaiting_manager_decision":
      return "under_maintenance";
    case "in_transit_to_service":
    case "awaiting_branch_handover":
    case "handed_to_carrier":
      return "sent_to_service_center";
    case "ready_to_return":
    case "in_return_transit":
      return "under_service_center_maintenance";
    case "received_damaged":
      return "damaged";
    case "delivered_to_customer":
    case "closed":
    case "received_at_destination":
      return "active";
    default:
      return "active";
  }
}

function summarizeRequestStatus(request: MaintenanceRequestRecord): ServiceRequestStatus {
  const statuses = request.devices.map((device) => device.lifecycleStatus ?? "received_at_branch");
  if (statuses.every((status) => ["delivered_to_customer", "closed"].includes(status))) {
    return "closed";
  }
  if (statuses.every((status) => ["received_at_destination", "received_damaged", "delivered_to_customer", "closed"].includes(status))) {
    return "completed";
  }
  if (statuses.some((status) => ["in_maintenance", "under_maintenance"].includes(status))) {
    return "in_progress";
  }
  if (statuses.some((status) => status === "awaiting_manager_decision")) {
    return "in_review";
  }
  if (statuses.some((status) => ["awaiting_maintenance", "at_service_center"].includes(status))) {
    return "at_service_center";
  }
  if (statuses.some((status) => ["in_transit_to_service", "in_return_transit", "awaiting_branch_handover"].includes(status))) {
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
      currentLocation:
        device.currentLocation ||
        deviceStatusLabel(device.lifecycleStatus, "technician"),
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

export { getMaintenanceRequestById };
