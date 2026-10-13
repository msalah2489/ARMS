/**
 * Default stage time thresholds (days) for delay alerts — v1 configurable constants.
 * Measured from when the device entered its current lifecycle stage.
 */
import type { DeviceLifecycleStatus } from "@/types/domain";

/** Days allowed in each stage before the item is flagged overdue. */
export const STAGE_SLA_DAYS: Partial<Record<DeviceLifecycleStatus, number>> = {
  received_at_branch: 2,
  ready_to_send: 2,
  excluded_from_shipment: 3,
  excluded: 3,
  in_transit_to_service: 3,
  handed_to_carrier: 3,
  in_shipping: 3,
  awaiting_maintenance: 2,
  at_service_center: 2,
  received_at_warehouse: 2,
  in_maintenance: 5,
  in_maintenance_at_branch: 5,
  under_maintenance: 5,
  ready_to_return: 2,
  awaiting_manager_decision: 1,
  maintenance_failed: 1,
  in_return_transit: 3,
  returning_from_service: 3,
  awaiting_customer: 5,
  awaiting_branch_handover: 5,
};

/** Urgent requests get a tighter threshold (at least 1 day). */
export const URGENT_SLA_FACTOR = 0.5;

/** Pickup receipt pending with courier — days after submit/create. */
export const COURIER_PENDING_SLA_DAYS = 1;

export function thresholdDaysForStage(
  status: DeviceLifecycleStatus,
  priority?: "urgent" | "normal" | string | null,
): number | null {
  const base = STAGE_SLA_DAYS[status];
  if (base == null) return null;
  if (priority === "urgent") {
    return Math.max(1, Math.ceil(base * URGENT_SLA_FACTOR));
  }
  return base;
}
