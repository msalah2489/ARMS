"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { isBranchRole } from "@/lib/auth";
import { listMaintenanceRequests } from "@/lib/branch-store";
import { getDashboardStats, getSpareParts } from "@/lib/data";
import { readSession } from "@/lib/session";
import type { DashboardStats, MaintenanceRequestRecord, Profile, SparePart } from "@/types/domain";

export default function ReportsPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [parts, setParts] = useState<SparePart[]>([]);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (!session) return;
    if (isBranchRole(session.role)) {
      setBranchRequests(listMaintenanceRequests(session.opsBranchId));
    }
    void Promise.all([getDashboardStats(), getSpareParts()]).then(([nextStats, nextParts]) => {
      setStats(nextStats);
      setParts(nextParts);
    });
  }, []);

  const branchReport = useMemo(() => {
    const devices = branchRequests.reduce((sum, item) => sum + item.devices.length, 0);
    const urgent = branchRequests.filter((item) => item.priority === "urgent").length;
    const customers = new Set(branchRequests.map((item) => item.customerMobile)).size;
    return { requests: branchRequests.length, devices, urgent, customers };
  }, [branchRequests]);

  if (!user) return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>;

  if (isBranchRole(user.role)) {
    return (
      <div>
        <PageHeader
          title="تقارير الفرع"
          description={`تقارير طلبات الصيانة الخاصة بـ ${user.opsBranchName || "الفرع"} فقط.`}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportCard label="إجمالي الطلبات" value={branchReport.requests} />
          <ReportCard label="إجمالي الأجهزة" value={branchReport.devices} />
          <ReportCard label="طلبات عاجلة" value={branchReport.urgent} />
          <ReportCard label="عملاء مميزون" value={branchReport.customers} />
        </div>
        <section className="mt-6 rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-800">
          <h2 className="font-display text-xl dark:text-sand-50">تفصيل الطلبات</h2>
          <ul className="mt-4 space-y-2 text-sm dark:text-sand-100">
            {branchRequests.length === 0 ? (
              <li className="text-ink-700/60 dark:text-sand-100/70">لا توجد بيانات تقارير بعد.</li>
            ) : (
              branchRequests.map((request) => (
                <li
                  key={request.id}
                  className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                >
                  {request.requestNumber} — {request.contactName} — {request.devices.length} جهاز —{" "}
                  {request.priority === "urgent" ? "عاجل" : "عادي"}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    );
  }

  const low = parts.filter((part) => part.stockQuantity < part.minimumStock);

  return (
    <div>
      <PageHeader title="التقارير" description="تقارير تشغيلية عامة." />
      {!stats ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-800">
            <h2 className="font-display text-xl dark:text-sand-50">حمل الخدمة</h2>
            <ul className="mt-4 space-y-2 text-sm dark:text-sand-100">
              <li>طلبات مفتوحة: {stats.openRequests}</li>
              <li>مكتمل هذا الشهر: {stats.completedThisMonth}</li>
              <li>أجهزة تحت الصيانة: {stats.devicesUnderMaintenance}</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-800">
            <h2 className="font-display text-xl dark:text-sand-50">تنبيهات المخزون</h2>
            <ul className="mt-4 space-y-2 text-sm dark:text-sand-100">
              {low.length === 0 ? (
                <li>لا توجد قطع تحت الحد الأدنى.</li>
              ) : (
                low.map((part) => (
                  <li key={part.id}>
                    {part.partCode} {part.name} — {part.stockQuantity} / {part.minimumStock}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function ReportCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-800">
      <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{label}</p>
      <p className="mt-2 font-display text-4xl dark:text-sand-50">{value}</p>
    </div>
  );
}
