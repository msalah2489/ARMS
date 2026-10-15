"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClockAlert } from "lucide-react";
import type { DelayAlertItem } from "@/lib/delay-alerts";
import { formatDate } from "@/lib/utils";

type Props = {
  alerts: DelayAlertItem[];
  /** Total overdue count (may exceed alerts.length when list is capped). */
  total?: number;
  title?: string;
  hint?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  openListLabel?: string;
};

/**
 * Dashboard work-card for SLA delay alerts.
 * Opens an overlay with the same item details formerly shown in the yellow strip.
 */
export function DelayAlertsCard({
  alerts,
  total,
  title = "تنبيهات التأخير",
  hint = "عناصر تجاوزت 24 ساعة في المرحلة الحالية دون انتقال (أقصر للعاجل)",
  viewAllHref = "/my-tasks/",
  viewAllLabel = "مهامي اليوم",
  openListLabel = "عرض التأخيرات",
}: Props) {
  const [open, setOpen] = useState(false);
  const count = total ?? alerts.length;
  const hasOverdue = count > 0;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex flex-col rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={[
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-sand-50 dark:bg-ink-950/40",
                hasOverdue
                  ? "border-rose-300/70 text-rose-700 dark:border-rose-400/40 dark:text-rose-300"
                  : "border-ink-900/10 text-ink-800 dark:border-white/10 dark:text-sand-100",
              ].join(" ")}
            >
              <ClockAlert className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
            </span>
            <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">{title}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {hasOverdue ? (
              <span
                className="arms-delay-blink inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600 dark:bg-rose-400"
                title="يوجد تأخير"
                aria-hidden
              />
            ) : null}
            <span
              className={[
                "inline-flex min-w-10 items-center justify-center rounded-full px-3 py-1 text-sm font-semibold text-white",
                hasOverdue
                  ? "arms-delay-count-blink bg-rose-700 dark:bg-rose-600"
                  : "bg-ink-900 dark:bg-aroma-600",
              ].join(" ")}
            >
              {count}
            </span>
          </div>
        </div>
        <p className="mt-2 flex-1 text-sm text-ink-700/70 dark:text-sand-100/70">{hint}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
          >
            {openListLabel}
          </button>
          {hasOverdue ? (
            <Link
              href={viewAllHref}
              className="rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
            >
              {viewAllLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delay-alerts-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id="delay-alerts-modal-title"
                  className="font-display text-2xl text-ink-900 dark:text-sand-50"
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm text-ink-700/75 dark:text-sand-100/70">
                  {count === 0
                    ? "لا توجد عناصر متأخرة عن مهلة 24 ساعة."
                    : `${count} عنصر تجاوز 24 ساعة في المرحلة الحالية دون انتقال`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-ink-700/70 dark:text-sand-100/70"
              >
                إغلاق
              </button>
            </div>

            {alerts.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={alert.href}
                      onClick={() => setOpen(false)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 bg-sand-50/60 px-3 py-2 text-sm transition hover:border-aroma-400 dark:border-white/10 dark:bg-ink-950/40 dark:hover:border-aroma-400"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-aroma-800 dark:text-aroma-200">
                            {alert.title}
                          </span>
                          {alert.priority === "urgent" ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                              عاجل
                            </span>
                          ) : null}
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/70 dark:text-amber-100">
                            متأخر {alert.daysOverdue} يوم
                          </span>
                        </div>
                        <p className="text-ink-700/70 dark:text-sand-100/70">
                          {alert.statusLabel} · منذ {formatDate(alert.stageStartedAt)} ·{" "}
                          {alert.subtitle}
                        </p>
                        {alert.stuckWith ? (
                          <p className="mt-0.5 font-medium text-rose-800 dark:text-rose-200">
                            متوقف عند: {alert.stuckWith}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {hasOverdue ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={viewAllHref}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
                >
                  {viewAllLabel}
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
