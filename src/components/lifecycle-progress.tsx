"use client";

import { deviceStatusLabel, normalizeLifecycleStatus } from "@/lib/branch-store";
import type { DeviceLifecycleStatus, MaintenanceAssignmentPath } from "@/types/domain";

const SERVICE_CENTER_STEPS: DeviceLifecycleStatus[] = [
  "received_at_branch",
  "in_transit_to_service",
  "awaiting_maintenance",
  "in_maintenance",
  "in_return_transit",
  "awaiting_customer",
  "delivered_to_customer",
];

const MOBILE_TECH_STEPS: DeviceLifecycleStatus[] = [
  "received_at_branch",
  "in_maintenance_at_branch",
  "awaiting_customer",
  "delivered_to_customer",
];

/** Map side statuses onto the nearest step in the main progression. */
function resolveStepIndex(
  status: DeviceLifecycleStatus,
  steps: DeviceLifecycleStatus[],
): number {
  const direct = steps.indexOf(status);
  if (direct >= 0) return direct;

  const aliases: Partial<Record<DeviceLifecycleStatus, DeviceLifecycleStatus>> = {
    ready_to_return: "in_return_transit",
    ready_to_send: "in_return_transit",
    awaiting_manager_decision: "in_maintenance",
    maintenance_failed: "in_maintenance_at_branch",
    excluded_from_shipment: "received_at_branch",
    closed: "delivered_to_customer",
  };

  const mapped = aliases[status];
  if (mapped) {
    const idx = steps.indexOf(mapped);
    if (idx >= 0) return idx;
  }

  // Fallback: furthest completed-looking step
  if (status === "awaiting_manager_decision") {
    return Math.max(0, steps.indexOf("in_maintenance"));
  }
  return 0;
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
  const isHold = normalized === "awaiting_manager_decision";
  const isFailed = normalized === "maintenance_failed";

  return (
    <div
      className={`rounded-xl border border-ink-900/10 bg-sand-50/50 px-3 py-3 dark:border-white/10 dark:bg-ink-950/30 ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-700/70 dark:text-sand-100/70">
          مسار الحالة
        </p>
        <p className="text-xs font-semibold text-aroma-700 dark:text-aroma-300">
          {deviceStatusLabel(normalized, "technician")}
          {isHold ? " · بانتظار المشرف" : null}
          {isFailed ? " · تعذر الإصلاح" : null}
        </p>
      </div>
      <ol className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                title={deviceStatusLabel(step, "technician")}
                className={[
                  "mx-auto h-2.5 w-2.5 shrink-0 rounded-full border transition",
                  done
                    ? "border-aroma-600 bg-aroma-600 dark:border-aroma-400 dark:bg-aroma-400"
                    : active
                      ? isHold || isFailed
                        ? "border-amber-500 bg-amber-400 dark:border-amber-400 dark:bg-amber-400"
                        : "border-aroma-600 bg-aroma-200 ring-2 ring-aroma-400/40 dark:border-aroma-300 dark:bg-aroma-700"
                      : "border-ink-900/20 bg-white dark:border-white/20 dark:bg-ink-900",
                ].join(" ")}
              />
              {index < steps.length - 1 ? (
                <span
                  className={[
                    "h-0.5 min-w-2 flex-1 rounded-full",
                    done
                      ? "bg-aroma-500 dark:bg-aroma-400"
                      : "bg-ink-900/10 dark:bg-white/10",
                  ].join(" ")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 truncate text-[11px] text-ink-700/55 dark:text-sand-100/55">
        {steps.map((step) => deviceStatusLabel(step, "technician")).join(" → ")}
      </p>
    </div>
  );
}
