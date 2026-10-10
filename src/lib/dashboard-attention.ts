import {
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";
import { listApprovedReturnReceiptsForBranch } from "@/lib/pickup-receipt-store";
import {
  listBranchesReadyToShip,
  listCarriersWithOpenBatches,
  listDevicesEligibleForShipment,
  type BranchReadyToShipSummary,
  type CarrierOpenBatchesSummary,
} from "@/lib/shipping-store";

export type DashboardAttentionCounts = {
  urgentToday: number;
  pendingSupervisor: number;
  awaitingCustomer: number;
};

/** Daily work queues for branch employee home screen. */
export type BranchDailyWorkCounts = {
  /** Devices returning to this branch (in transit / with courier return). */
  incomingFromService: number;
  /** Maintained devices at branch waiting for customer pickup. */
  awaitingCustomer: number;
  /** Devices at branch ready to send to service (or mobile tech path). */
  readyToSend: number;
};

export function getBranchDailyWorkCounts(opsBranchId: string): BranchDailyWorkCounts {
  const devices = listAllRequestDevices().filter(
    (item) => item.request.opsBranchId === opsBranchId,
  );

  const incomingDeviceIds = new Set(
    devices
      .filter(
        (item) =>
          normalizeLifecycleStatus(item.device.lifecycleStatus) === "in_return_transit",
      )
      .map((item) => item.device.localId),
  );

  for (const receipt of listApprovedReturnReceiptsForBranch(opsBranchId)) {
    for (const line of receipt.lines) {
      if (line.status === "approved" || line.status === "included") {
        incomingDeviceIds.add(line.deviceLocalId);
      }
    }
  }

  return {
    incomingFromService: incomingDeviceIds.size,
    awaitingCustomer: devices.filter(
      (item) =>
        normalizeLifecycleStatus(item.device.lifecycleStatus) === "awaiting_customer",
    ).length,
    readyToSend: listDevicesEligibleForShipment(opsBranchId).length,
  };
}

export type DashboardOpsShippingAttention = {
  branchesReadyToShip: BranchReadyToShipSummary[];
  carriersWithOpenBatches: CarrierOpenBatchesSummary[];
  readyToShipDeviceTotal: number;
  openBatchTotal: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Ops attention counters for dashboard widgets. */
export function getDashboardAttentionCounts(
  opsBranchId?: string | null,
): DashboardAttentionCounts {
  const today = todayKey();
  const requests = listMaintenanceRequests(opsBranchId ?? undefined);
  const devices = listAllRequestDevices().filter((item) =>
    opsBranchId ? item.request.opsBranchId === opsBranchId : true,
  );

  return {
    urgentToday: requests.filter(
      (request) =>
        request.priority === "urgent" &&
        String(request.receivedAt ?? "").startsWith(today),
    ).length,
    pendingSupervisor: devices.filter(
      (item) =>
        normalizeLifecycleStatus(item.device.lifecycleStatus) ===
        "awaiting_manager_decision",
    ).length,
    awaitingCustomer: devices.filter(
      (item) =>
        normalizeLifecycleStatus(item.device.lifecycleStatus) === "awaiting_customer",
    ).length,
  };
}

/** Shipping attention for maintenance manager / system admin dashboards. */
export function getDashboardOpsShippingAttention(): DashboardOpsShippingAttention {
  const branchesReadyToShip = listBranchesReadyToShip();
  const carriersWithOpenBatches = listCarriersWithOpenBatches();
  return {
    branchesReadyToShip,
    carriersWithOpenBatches,
    readyToShipDeviceTotal: branchesReadyToShip.reduce(
      (sum, item) => sum + item.readyCount,
      0,
    ),
    openBatchTotal: carriersWithOpenBatches.reduce((sum, item) => sum + item.total, 0),
  };
}
