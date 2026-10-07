import {
  listAllRequestDevices,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
} from "@/lib/branch-store";

export type DashboardAttentionCounts = {
  urgentToday: number;
  pendingSupervisor: number;
  awaitingCustomer: number;
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
