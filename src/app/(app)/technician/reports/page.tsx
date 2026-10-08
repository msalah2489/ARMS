"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { subscribeMaintenanceRequestsChanged } from "@/lib/branch-store";
import { isDemoMode } from "@/lib/auth";
import { readSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import {
  buildTechnicianDailyWorkRows,
  buildTechnicianPerformanceReport,
  PERFORMANCE_RATE_THRESHOLDS,
  todayLocalDateKey,
  type RateColorTone,
} from "@/lib/technician-reports";
import type { Profile } from "@/types/domain";

function rateToneClasses(tone: RateColorTone): string {
  // TODO(user): temporary color mapping — confirm thresholds/order later.
  if (tone === "green") {
    return "bg-emerald-100 text-emerald-900 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-100";
  }
  if (tone === "yellow") {
    return "bg-amber-100 text-amber-950 ring-amber-600/20 dark:bg-amber-500/20 dark:text-amber-100";
  }
  return "bg-rose-100 text-rose-900 ring-rose-600/20 dark:bg-rose-500/20 dark:text-rose-100";
}

function TechnicianReportsContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [fromDate, setFromDate] = useState(todayLocalDateKey);
  const [toDate, setToDate] = useState(todayLocalDateKey);
  const [, setTick] = useState(0);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    setReady(true);

    if (isSupabaseConfigured() && !isDemoMode()) {
      void hydrateOpsFromSupabase({ force: true }).then(() => setTick((n) => n + 1));
    }

    const unsubscribe = subscribeMaintenanceRequestsChanged(() => {
      setTick((n) => n + 1);
    });
    const onHydrated = () => setTick((n) => n + 1);
    window.addEventListener("arms-ops-hydrated", onHydrated);

    return () => {
      unsubscribe();
      window.removeEventListener("arms-ops-hydrated", onHydrated);
    };
  }, []);

  const range = useMemo(() => {
    const from = fromDate || todayLocalDateKey();
    const to = toDate || from;
    return from <= to ? { from, to } : { from: to, to: from };
  }, [fromDate, toDate]);

  const dailyRows = useMemo(() => {
    if (!user) return [];
    return buildTechnicianDailyWorkRows(user.id, range.from, range.to);
  }, [user, range]);

  const performance = useMemo(() => {
    if (!user) return null;
    return buildTechnicianPerformanceReport(user, range.from, range.to);
  }, [user, range]);

  if (!ready || !user) {
    return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  }

  const sameDay = range.from === range.to;

  return (
    <div className="space-y-6">
      <PageHeader
        title="تقارير الفني"
        description="سجل الأجهزة التي صُنتَها ومؤشرات الأداء لفترة محددة."
      />

      <section className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-ink-700/70 dark:text-sand-100/70">من تاريخ</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                const next = e.target.value || todayLocalDateKey();
                setFromDate(next);
                if (!toDate || toDate < next) setToDate(next);
              }}
              className="min-h-11 rounded-xl border border-ink-900/10 bg-sand-50 px-3 dark:border-white/10 dark:bg-ink-950"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-700/70 dark:text-sand-100/70">إلى تاريخ</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value || fromDate)}
              className="min-h-11 rounded-xl border border-ink-900/10 bg-sand-50 px-3 dark:border-white/10 dark:bg-ink-950"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const today = todayLocalDateKey();
              setFromDate(today);
              setToDate(today);
            }}
            className="min-h-11 rounded-xl border border-ink-900/10 px-3 text-sm dark:border-white/10"
          >
            اليوم
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-700/60 dark:text-sand-100/60">
          {sameDay
            ? `عرض يوم ${range.from} (الافتراضي: اليوم).`
            : `عرض من ${range.from} إلى ${range.to}.`}
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">
            الأجهزة التي صُنتَها
          </h2>
          <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
            من سجلات عمل الفني للجلسة الحالية في الفترة المحددة. الفشل = أُرجع للمشرف (أو نتيجة غير ناجحة).
          </p>
        </div>

        {dailyRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-6 text-sm text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
            لا توجد سجلات صيانة مكتملة في هذه الفترة.
          </p>
        ) : (
          <DataTable
            columns={[
              "نوع الجهاز",
              "رقم الطلب",
              "كود الجهاز",
              "سبب العطل",
              "النتيجة",
              "مدة الصيانة",
            ]}
            mobilePrimaryIndex={2}
            mobileBadgeIndexes={[4]}
            rows={dailyRows.map((row) => [
              row.deviceTypeName,
              row.requestNumber,
              row.deviceCode,
              row.faultCause,
              <span
                key={`${row.id}-result`}
                className={
                  row.resultKind === "success"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
                }
              >
                {row.resultLabel}
              </span>,
              row.durationLabel,
            ])}
          />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">تقرير الأداء</h2>
          <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
            متوسط مدة الصيانة ونسبة الإنجاز لنفس الفترة.
          </p>
        </div>

        {performance ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900">
                <p className="text-xs text-ink-700/60 dark:text-sand-100/60">أجهزة صُنتَها</p>
                <p className="mt-1 font-display text-3xl tabular-nums">{performance.maintainedCount}</p>
              </div>
              <div className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900">
                <p className="text-xs text-ink-700/60 dark:text-sand-100/60">متاحة للصيانة</p>
                <p className="mt-1 font-display text-3xl tabular-nums">{performance.availableCount}</p>
                <p className="mt-1 text-[11px] text-ink-700/50 dark:text-sand-100/50">
                  ما بدأتَه/أنهيتَه في الفترة
                  {range.from <= todayLocalDateKey() && range.to >= todayLocalDateKey()
                    ? " + انتظار الحالية"
                    : ""}
                  .
                </p>
              </div>
              <div className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900">
                <p className="text-xs text-ink-700/60 dark:text-sand-100/60">نسبة الإنجاز</p>
                {performance.ratePercent == null || performance.rateTone == null ? (
                  <p className="mt-1 font-display text-3xl">—</p>
                ) : (
                  <p
                    className={`mt-2 inline-flex rounded-xl px-3 py-1.5 font-display text-2xl tabular-nums ring-1 ring-inset ${rateToneClasses(performance.rateTone)}`}
                  >
                    {performance.ratePercent}%
                  </p>
                )}
                <p className="mt-2 text-[11px] text-ink-700/50 dark:text-sand-100/50">
                  {/* TODO(user): confirm color thresholds / ordering later */}
                  عتبات مؤقتة: ≥{PERFORMANCE_RATE_THRESHOLDS.greenMin}% أخضر،{" "}
                  {PERFORMANCE_RATE_THRESHOLDS.yellowMin}–
                  {PERFORMANCE_RATE_THRESHOLDS.greenMin - 1}% أصفر، &lt;
                  {PERFORMANCE_RATE_THRESHOLDS.yellowMin}% أحمر.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-sand-50">
                  متوسط المدة حسب نوع العطل
                </h3>
                {performance.avgByFaultCause.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-5 text-sm text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
                    لا بيانات مدة كافية.
                  </p>
                ) : (
                  <DataTable
                    columns={["نوع العطل", "العدد", "متوسط المدة"]}
                    rows={performance.avgByFaultCause.map((bucket) => [
                      bucket.label,
                      String(bucket.count),
                      bucket.averageLabel,
                    ])}
                  />
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink-900 dark:text-sand-50">
                  متوسط المدة حسب نوع الجهاز
                </h3>
                {performance.avgByDeviceType.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-900/15 px-4 py-5 text-sm text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
                    لا بيانات مدة كافية.
                  </p>
                ) : (
                  <DataTable
                    columns={["نوع الجهاز", "العدد", "متوسط المدة"]}
                    rows={performance.avgByDeviceType.map((bucket) => [
                      bucket.label,
                      String(bucket.count),
                      bucket.averageLabel,
                    ])}
                  />
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function TechnicianReportsPage() {
  return (
    <RoleGuard
      allow={["technician", "mobile_technician"]}
      permission="view_work_queue"
    >
      <TechnicianReportsContent />
    </RoleGuard>
  );
}
