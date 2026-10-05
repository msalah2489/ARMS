"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS, isBranchRole, isTechnicianRole } from "@/lib/auth";
import {
  deviceStatusLabel,
  listAllRequestDevices,
  listMaintenanceRequests,
} from "@/lib/branch-store";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import { getTechnicianDashboardStats } from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { DashboardStats, MaintenanceRequestRecord, Profile, ServiceRequest } from "@/types/domain";

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [techStats, setTechStats] = useState<ReturnType<typeof getTechnicianDashboardStats> | null>(
    null,
  );

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (!session) return;

    if (isBranchRole(session.role)) {
      setBranchRequests(listMaintenanceRequests(session.opsBranchId));
    }

    if (isTechnicianRole(session.role)) {
      setTechStats(getTechnicianDashboardStats(session.id));
    }

    void Promise.all([getDashboardStats(), getServiceRequests()]).then(([nextStats, nextRequests]) => {
      setStats(nextStats);
      setRequests(nextRequests);
    });
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  if (isTechnicianRole(user.role)) {
    const todayDevices = listAllRequestDevices().filter((item) =>
      item.request.receivedAt.startsWith(new Date().toISOString().slice(0, 10)),
    );

    return (
      <div>
        <PageHeader
          title={`مرحبًا، ${user.fullName.split(" ")[0]}`}
          description="لوحة الفني — نظرة على أجهزة قسم الصيانة المتاحة لك"
          action={
            <Link href="/technician/work" className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white">
              عمل الفني
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="طلبات متاحة للعمل" value={techStats?.availableRequests ?? 0} />
          <StatCard label="أجهزة متاحة للعمل" value={techStats?.availableDevices ?? 0} />
          <StatCard label="جاهز للإرجاع" value={techStats?.readyToReturn ?? techStats?.readyToSend ?? 0} />
          <StatCard label="بانتظار قرار المدير" value={techStats?.awaitingManager ?? techStats?.excluded ?? 0} />
        </div>

        <h2 className="mb-3 mt-10 font-display text-2xl">آخر الطلبات (اليوم)</h2>
        <div className="space-y-3">
          {todayDevices.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
              لا توجد طلبات بتاريخ اليوم. أنشئ طلبًا من حساب الفرع ثم ارجع هنا.
            </p>
          ) : (
            todayDevices.map(({ request, device }) => (
              <div
                key={`${request.id}-${device.localId}`}
                className="rounded-2xl border border-ink-900/10 bg-white px-4 py-4 shadow-panel"
              >
                <p className="font-medium">{request.requestNumber}</p>
                <p className="text-sm text-ink-700/70">
                  {request.contactName} · {request.opsBranchName} · {device.deviceTypeName} ·{" "}
                  {deviceStatusLabel(device.lifecycleStatus, "technician")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (isBranchRole(user.role)) {
    const openCount = branchRequests.length;
    const deviceCount = branchRequests.reduce((sum, item) => sum + item.devices.length, 0);
    const urgentCount = branchRequests.filter((item) => item.priority === "urgent").length;

    return (
      <div>
        <PageHeader
          title={`مرحبًا، ${user.fullName.split(" ")[0]}`}
          description={`لوحة الفرع — ${user.opsBranchName || "فرع الرياض"}`}
          action={
            <Link
              href="/service-requests/new"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
            >
              إنشاء طلب
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="طلبات الفرع" value={openCount} />
          <StatCard label="أجهزة مستلمة" value={deviceCount} />
          <StatCard label="طلبات عاجلة" value={urgentCount} />
        </div>
        <h2 className="mb-3 mt-10 font-display text-2xl">طلبات الصيانة الخاصة بالفرع</h2>
        <div className="space-y-3">
          {branchRequests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
              لا توجد طلبات بعد. ابدأ بإنشاء طلب جديد.
            </p>
          ) : (
            branchRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-ink-900/10 bg-white px-4 py-4 shadow-panel"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.requestNumber}</p>
                    <p className="text-sm text-ink-700/70">
                      {request.contactName} · {request.customerMobile} · {request.devices.length} جهاز
                    </p>
                    <p className="mt-1 text-xs text-ink-700/60">
                      {request.devices
                        .map(
                          (device) =>
                            `${device.deviceCode}: ${deviceStatusLabel(device.lifecycleStatus, "branch")}`,
                        )
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-sm text-ink-700/70">
                    {request.priority === "urgent" ? "عاجل" : "عادي"} · {formatDate(request.receivedAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!stats) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const cards = [
    { label: "طلبات مفتوحة", value: stats.openRequests },
    { label: "تحت الصيانة", value: stats.devicesUnderMaintenance },
    { label: "في مركز الصيانة", value: stats.dispatchedDevices },
    { label: "قطع منخفضة", value: stats.lowStockParts },
    { label: "أجهزة نشطة", value: stats.activeDevices },
    { label: "مكتمل هذا الشهر", value: stats.completedThisMonth },
  ];

  return (
    <div>
      <PageHeader
        title={`مرحبًا، ${user.fullName.split(" ")[0]}`}
        description={`${ROLE_LABELS[user.role]} — نظرة عامة على العمليات`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-display text-2xl">أحدث الطلبات</h2>
      <div className="space-y-3">
        {requests.map((request) => (
          <Link
            key={request.id}
            href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-900/10 bg-white px-4 py-4 shadow-panel hover:border-aroma-400"
          >
            <div>
              <p className="font-medium">{request.requestNumber}</p>
              <p className="text-sm text-ink-700/70">
                {request.customerName} · {request.deviceCode} · {request.reportedProblem}
              </p>
            </div>
            <span className="text-xs text-ink-700/60">{formatDate(request.requestedAt)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
      <p className="text-sm text-ink-700/70">{label}</p>
      <p className="mt-2 font-display text-4xl">{value}</p>
    </div>
  );
}
