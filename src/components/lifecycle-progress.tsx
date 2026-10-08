"use client";

import { deviceStatusLabel, normalizeLifecycleStatus } from "@/lib/branch-store";
import type { DeviceLifecycleStatus, MaintenanceAssignmentPath } from "@/types/domain";

/** Nine-step service-center path (including supervisor hold). */
const SERVICE_CENTER_STEPS: DeviceLifecycleStatus[] = [
  "received_at_branch",
  "in_transit_to_service",
  "awaiting_maintenance",
  "in_maintenance",
  "ready_to_return",
  "awaiting_manager_decision",
  "in_return_transit",
  "awaiting_customer",
  "delivered_to_customer",
];

const MOBILE_TECH_STEPS: DeviceLifecycleStatus[] = [
  "received_at_branch",
  "in_maintenance_at_branch",
  "awaiting_manager_decision",
  "awaiting_customer",
  "delivered_to_customer",
];

/** Map side / legacy statuses onto the nearest step in the main progression. */
function resolveStepIndex(
  status: DeviceLifecycleStatus,
  steps: DeviceLifecycleStatus[],
): number {
  const direct = steps.indexOf(status);
  if (direct >= 0) return direct;

  const aliases: Partial<Record<DeviceLifecycleStatus, DeviceLifecycleStatus>> = {
    ready_to_send: "ready_to_return",
    maintenance_failed: "awaiting_manager_decision",
    excluded_from_shipment: "received_at_branch",
    closed: "delivered_to_customer",
    under_maintenance: "in_maintenance",
    at_service_center: "awaiting_maintenance",
    returning_from_service: "in_return_transit",
  };

  const mapped = aliases[status];
  if (mapped) {
    const idx = steps.indexOf(mapped);
    if (idx >= 0) return idx;
  }

  return 0;
}

/**
 * When the device progressed past maintenance successfully, the supervisor-hold
 * step is an unused side branch — treat it as skipped (not a future/red step).
 */
function isSkippedHoldStep(
  step: DeviceLifecycleStatus,
  status: DeviceLifecycleStatus,
  currentIndex: number,
  stepIndex: number,
): boolean {
  if (step !== "awaiting_manager_decision") return false;
  if (status === "awaiting_manager_decision" || status === "maintenance_failed") {
    return false;
  }
  return currentIndex > stepIndex;
}

export function LifecycleProgressStrip({
  status,
  path = "service_center",
  className = "",
}: {
  status: string | null | undefined;
  path?: MaintenanceAssignmentPath | null;
  className?: string;
}) {
  if (!status) return null;

  const normalized = normalizeLifecycleStatus(status);
  const steps =
    path === "mobile_technician" ? MOBILE_TECH_STEPS : SERVICE_CENTER_STEPS;
  const currentIndex = resolveStepIndex(normalized, steps);
  const isHold =
    normalized === "awaiting_manager_decision" || normalized === "maintenance_failed";

  return (
    <div
      className={`rounded-xl border border-ink-900/10 bg-sand-50/50 px-3 py-3 dark:border-white/10 dark:bg-ink-950/30 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-700/70 dark:text-sand-100/70">
          مسار الحالة
        </p>
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {deviceStatusLabel(normalized, "technician")}
        </p>
      </div>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const skipped = isSkippedHoldStep(step, normalized, currentIndex, index);
          const done = !skipped && index < currentIndex;
          const active = !skipped && index === currentIndex;
          const upcoming = !skipped && index > currentIndex;
          const label = deviceStatusLabel(step, "technician");

          return (
            <li key={step} className="flex gap-3">
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span
                  title={label}
                  className={[
                    "mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 transition",
                    skipped
                      ? "border-ink-900/20 bg-ink-900/10 dark:border-white/20 dark:bg-white/10"
                      : done || (active && !isHold)
                        ? "border-emerald-600 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400"
                        : active && isHold
                          ? "border-amber-500 bg-amber-400 dark:border-amber-400 dark:bg-amber-400"
                          : upcoming
                            ? "border-rose-500 bg-rose-500 dark:border-rose-400 dark:bg-rose-400"
                            : "border-ink-900/20 bg-white dark:border-white/20 dark:bg-ink-900",
                  ].join(" ")}
                />
                {index < steps.length - 1 ? (
                  <span
                    className={[
                      "my-0.5 w-0.5 flex-1 min-h-3 rounded-full",
                      index < currentIndex && !skipped
                        ? "bg-emerald-500 dark:bg-emerald-400"
                        : "bg-rose-300/70 dark:bg-rose-500/40",
                    ].join(" ")}
                  />
                ) : null}
              </div>
              <p
                className={[
                  "pb-3 text-xs leading-snug",
                  index === steps.length - 1 ? "pb-0" : "",
                  skipped
                    ? "text-ink-700/40 line-through dark:text-sand-100/35"
                    : done || (active && !isHold)
                      ? "font-medium text-emerald-800 dark:text-emerald-200"
                      : active && isHold
                        ? "font-semibold text-amber-800 dark:text-amber-200"
                        : upcoming
                          ? "font-medium text-rose-700 dark:text-rose-300"
                          : "text-ink-700/70 dark:text-sand-100/70",
                ].join(" ")}
              >
                {label}
                {active ? (
                  <span className="ms-1 text-[10px] font-normal opacity-80">(الحالي)</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
