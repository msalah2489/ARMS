import {
  getBranchDailyWorkCounts as getBranchWorkCountsFromQueues,
  type BranchDailyWorkCounts,
} from "@/lib/dashboard-work-queues";
import {
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";
import {
  listBranchesReadyToShip,
  listCarriersWithOpenBatches,
  type BranchReadyToShipSummary,
  type CarrierOpenBatchesSummary,
} from "@/lib/shipping-store";

export type DashboardAttentionCounts = {
  urgentToday: number;
  pendingSupervisor: number;
  awaitingCustomer: number;
};

/** @deprecated Prefer BranchDailyWorkCounts from dashboard-work-queues — re-exported for callers. */
export type { BranchDailyWorkCounts };

/** Daily work queues for branch employee home screen (5 exclusive cards). */
export function getBranchDailyWorkCounts(opsBranchId: string): BranchDailyWorkCounts {
  return getBranchWorkCountsFromQueues(opsBranchId);
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
