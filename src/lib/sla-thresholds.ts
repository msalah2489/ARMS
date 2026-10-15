/**
 * Stage time thresholds for delay alerts / «متوقف عند» visibility.
 * General rule: overdue after 24 hours in the current stage without progress.
 * Urgent requests use a shorter threshold (half of the stage base, min 12h).
 */
import type { DeviceLifecycleStatus } from "@/types/domain";

/** Hours allowed in each stage before the item is flagged overdue (24h default). */
export const DEFAULT_STAGE_SLA_HOURS = 24;

/** Urgent floor so urgent stays shorter than the normal 24h rule. */
export const URGENT_MIN_SLA_HOURS = 12;

export const STAGE_SLA_HOURS: Partial<Record<DeviceLifecycleStatus, number>> = {
  received_at_branch: DEFAULT_STAGE_SLA_HOURS,
  ready_to_send: DEFAULT_STAGE_SLA_HOURS,
  excluded_from_shipment: DEFAULT_STAGE_SLA_HOURS,
  excluded: DEFAULT_STAGE_SLA_HOURS,
  in_transit_to_service: DEFAULT_STAGE_SLA_HOURS,
  handed_to_carrier: DEFAULT_STAGE_SLA_HOURS,
  in_shipping: DEFAULT_STAGE_SLA_HOURS,
  awaiting_maintenance: DEFAULT_STAGE_SLA_HOURS,
  at_service_center: DEFAULT_STAGE_SLA_HOURS,
  received_at_warehouse: DEFAULT_STAGE_SLA_HOURS,
  in_maintenance: DEFAULT_STAGE_SLA_HOURS,
  in_maintenance_at_branch: DEFAULT_STAGE_SLA_HOURS,
  under_maintenance: DEFAULT_STAGE_SLA_HOURS,
  ready_to_return: DEFAULT_STAGE_SLA_HOURS,
  awaiting_manager_decision: DEFAULT_STAGE_SLA_HOURS,
  maintenance_failed: DEFAULT_STAGE_SLA_HOURS,
  in_return_transit: DEFAULT_STAGE_SLA_HOURS,
  returning_from_service: DEFAULT_STAGE_SLA_HOURS,
  awaiting_customer: DEFAULT_STAGE_SLA_HOURS,
  awaiting_branch_handover: DEFAULT_STAGE_SLA_HOURS,
};

/** @deprecated Prefer STAGE_SLA_HOURS — kept as days (hours/24) for callers/reports. */
export const STAGE_SLA_DAYS: Partial<Record<DeviceLifecycleStatus, number>> =
  Object.fromEntries(
    Object.entries(STAGE_SLA_HOURS).map(([status, hours]) => [
      status,
      (hours as number) / 24,
    ]),
  ) as Partial<Record<DeviceLifecycleStatus, number>>;

/** Urgent requests get a tighter threshold (half of base, at least URGENT_MIN_SLA_HOURS). */
export const URGENT_SLA_FACTOR = 0.5;

/** Pickup receipt pending with courier — hours after submit/create. */
export const COURIER_PENDING_SLA_HOURS = DEFAULT_STAGE_SLA_HOURS;

/** @deprecated Prefer COURIER_PENDING_SLA_HOURS */
export const COURIER_PENDING_SLA_DAYS = COURIER_PENDING_SLA_HOURS / 24;

export function thresholdHoursForStage(
  status: DeviceLifecycleStatus,
  priority?: "urgent" | "normal" | string | null,
): number | null {
  const base = STAGE_SLA_HOURS[status];
  if (base == null) return null;
  if (priority === "urgent") {
    return Math.max(URGENT_MIN_SLA_HOURS, Math.ceil(base * URGENT_SLA_FACTOR));
  }
  return base;
}

/** Days equivalent of {@link thresholdHoursForStage} (24h → 1, urgent 12h → 0.5). */
export function thresholdDaysForStage(
  status: DeviceLifecycleStatus,
  priority?: "urgent" | "normal" | string | null,
): number | null {
  const hours = thresholdHoursForStage(status, priority);
  if (hours == null) return null;
  return hours / 24;
}
