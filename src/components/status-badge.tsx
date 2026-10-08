"use client";

import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/preferences-provider";
import { statusMessageKey } from "@/lib/i18n/messages";

const TONES: Record<string, string> = {
  new: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  active: "bg-aroma-100 text-aroma-700 ring-aroma-200 dark:bg-aroma-700/30 dark:text-aroma-200 dark:ring-aroma-600",
  installed: "bg-aroma-100 text-aroma-700 ring-aroma-200 dark:bg-aroma-700/30 dark:text-aroma-200 dark:ring-aroma-600",
  assigned: "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-800",
  in_progress: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  in_review: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  under_maintenance: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  waiting_parts: "bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  waiting_for_spare_parts: "bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  dispatched: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  sent_to_service_center: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  at_service_center: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  under_service_center_maintenance: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  testing: "bg-cyan-50 text-cyan-900 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-200 dark:ring-cyan-800",
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  closed: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
  returned: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  damaged: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  non_repairable: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  retired: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
  cancelled: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
  high: "bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  urgent: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  normal: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
  low: "bg-sand-100 text-ink-700 ring-sand-200 dark:bg-ink-800 dark:text-sand-100 dark:ring-ink-700",
  // Lifecycle (9-step)
  received_at_branch: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  in_transit_to_service: "bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  awaiting_maintenance: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  in_maintenance: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  in_maintenance_at_branch: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  ready_to_return: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  ready_to_send: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  awaiting_manager_decision: "bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  maintenance_failed: "bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  in_return_transit: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  awaiting_customer: "bg-cyan-50 text-cyan-900 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-200 dark:ring-cyan-800",
  delivered_to_customer: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
  excluded_from_shipment: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
};

export function StatusBadge({ value }: { value: string }) {
  const { t } = usePreferences();
  const key = statusMessageKey(value);
  const label = key ? t(key) : value.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[value] ?? "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700",
      )}
    >
      {label}
    </span>
  );
}
