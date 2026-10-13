"use client";

import Link from "next/link";
import type { DelayAlertItem } from "@/lib/delay-alerts";
import { formatDate } from "@/lib/utils";

type Props = {
  alerts: DelayAlertItem[];
  title?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyHidden?: boolean;
};

export function DelayAlertsStrip({
  alerts,
  title = "تنبيهات التأخير",
  viewAllHref = "/my-tasks/",
  viewAllLabel = "مهامي اليوم",
  emptyHidden = true,
}: Props) {
  if (emptyHidden && alerts.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 shadow-panel dark:border-amber-400/40 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink-900 dark:text-sand-50">{title}</h2>
          <p className="mt-1 text-sm text-ink-700/75 dark:text-sand-100/70">
            {alerts.length === 0
              ? "لا توجد عناصر متأخرة عن المهلة الافتراضية."
              : `${alerts.length} عنصر تجاوز المهلة الزمنية للمرحلة الحالية`}
          </p>
        </div>
        {alerts.length > 0 ? (
          <Link
            href={viewAllHref}
            className="rounded-full border border-ink-900/15 bg-white px-3 py-1.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>

      {alerts.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {alerts.slice(0, 5).map((alert) => (
            <li key={alert.id}>
              <Link
                href={alert.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-white/80 px-3 py-2 text-sm transition hover:border-aroma-400 dark:border-amber-500/30 dark:bg-ink-950/50 dark:hover:border-aroma-400"
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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
