import { cn, statusLabel } from "@/lib/utils";

const TONES: Record<string, string> = {
  new: "bg-sky-50 text-sky-800 ring-sky-200",
  active: "bg-aroma-100 text-aroma-700 ring-aroma-200",
  installed: "bg-aroma-100 text-aroma-700 ring-aroma-200",
  assigned: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  in_progress: "bg-amber-50 text-amber-900 ring-amber-200",
  in_review: "bg-amber-50 text-amber-900 ring-amber-200",
  under_maintenance: "bg-amber-50 text-amber-900 ring-amber-200",
  waiting_parts: "bg-orange-50 text-orange-900 ring-orange-200",
  waiting_for_spare_parts: "bg-orange-50 text-orange-900 ring-orange-200",
  dispatched: "bg-violet-50 text-violet-900 ring-violet-200",
  sent_to_service_center: "bg-violet-50 text-violet-900 ring-violet-200",
  at_service_center: "bg-violet-50 text-violet-900 ring-violet-200",
  under_service_center_maintenance: "bg-violet-50 text-violet-900 ring-violet-200",
  testing: "bg-cyan-50 text-cyan-900 ring-cyan-200",
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-stone-100 text-stone-700 ring-stone-200",
  returned: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  damaged: "bg-rose-50 text-rose-800 ring-rose-200",
  non_repairable: "bg-rose-50 text-rose-800 ring-rose-200",
  retired: "bg-stone-100 text-stone-700 ring-stone-200",
  cancelled: "bg-stone-100 text-stone-700 ring-stone-200",
  high: "bg-orange-50 text-orange-900 ring-orange-200",
  urgent: "bg-rose-50 text-rose-800 ring-rose-200",
  normal: "bg-stone-100 text-stone-700 ring-stone-200",
  low: "bg-sand-100 text-ink-700 ring-sand-200",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex capitalize rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[value] ?? "bg-stone-100 text-stone-700 ring-stone-200",
      )}
    >
      {statusLabel(value)}
    </span>
  );
}
