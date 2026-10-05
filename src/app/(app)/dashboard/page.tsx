"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ROLE_LABELS, isBranchRole, normalizeRole } from "@/lib/auth";
import { listMaintenanceRequests } from "@/lib/branch-store";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { DashboardStats, MaintenanceRequestRecord, Profile, ServiceRequest } from "@/types/domain";

export default function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (!session) return;

    if (isBranchRole(session.role) || normalizeRole(session.role) === "system_admin") {
      setBranchRequests(listMaintenanceRequests(session.opsBranchId));
    }

    void Promise.all([getDashboardStats(), getServiceRequests()]).then(([nextStats, nextRequests]) => {
      setStats(nextStats);
      setRequests(nextRequests);
    });
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const branchMode = isBranchRole(user.role) || normalizeRole(user.role) === "system_admin";

  if (branchMode) {
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
          <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <p className="text-sm text-ink-700/70">طلبات الفرع</p>
            <p className="mt-2 font-display text-4xl">{openCount}</p>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <p className="text-sm text-ink-700/70">أجهزة مستلمة</p>
            <p className="mt-2 font-display text-4xl">{deviceCount}</p>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <p className="text-sm text-ink-700/70">طلبات عاجلة</p>
            <p className="mt-2 font-display text-4xl">{urgentCount}</p>
          </div>
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
                  </div>
                  <div className="text-sm text-ink-700/70">
                    {request.priority === "urgent" ? "عاجل" : "عادي"} ·{" "}
                    {formatDate(request.receivedAt)}
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
          <div key={card.label} className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <p className="text-sm text-ink-700/70">{card.label}</p>
            <p className="mt-2 font-display text-4xl">{card.value}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-display text-2xl">أحدث الطلبات</h2>
      <div className="space-y-3">
        {requests.map((request) => (
          <Link
            key={request.id}
            href={`/service-requests/${request.id}`}
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
