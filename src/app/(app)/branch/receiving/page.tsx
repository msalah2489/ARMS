"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { listMaintenanceRequests } from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { MaintenanceRequestRecord, Profile } from "@/types/domain";

type Row = {
  deviceCode: string;
  modelName: string;
  requestNumber: string;
  contactName: string;
  mobile: string;
  date: string;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-1 text-xs text-ink-700/60">{rows.length} جهاز</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-right text-ink-700/70">
              <th className="px-2 py-2 font-medium">كود الجهاز</th>
              <th className="px-2 py-2 font-medium">الموديل</th>
              <th className="px-2 py-2 font-medium">رقم الطلب</th>
              <th className="px-2 py-2 font-medium">اسم العميل</th>
              <th className="px-2 py-2 font-medium">جوال العميل</th>
              <th className="px-2 py-2 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-ink-700/60">
                  لا توجد أجهزة في هذا القسم.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${title}-${row.deviceCode}-${row.requestNumber}`} className="border-b border-ink-900/5">
                  <td className="px-2 py-3 font-medium">{row.deviceCode}</td>
                  <td className="px-2 py-3">{row.modelName}</td>
                  <td className="px-2 py-3">{row.requestNumber}</td>
                  <td className="px-2 py-3">{row.contactName}</td>
                  <td className="px-2 py-3">{row.mobile}</td>
                  <td className="px-2 py-3">{formatDate(row.date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BranchReceivingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([]);

  useEffect(() => {
    const session = readSession();
    setUser(session);
    setRequests(listMaintenanceRequests(session?.opsBranchId));
  }, []);

  const sections = useMemo(() => {
    const received: Row[] = [];
    const fromService: Row[] = [];
    const delivered: Row[] = [];

    for (const request of requests) {
      for (const device of request.devices) {
        received.push({
          deviceCode: device.deviceCode,
          modelName: device.modelName,
          requestNumber: request.requestNumber,
          contactName: request.contactName,
          mobile: request.customerMobile,
          date: request.receivedAt,
        });
      }
    }

    return { received, fromService, delivered };
  }, [requests]);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="استلام الصيانة"
        description={`متابعة أجهزة ${user.opsBranchName || "الفرع"} حسب حالة الاستلام والتسليم.`}
      />
      <Section title="أجهزة مستلمة بالفرع" rows={sections.received} />
      <Section title="أجهزة قادمة من الصيانة" rows={sections.fromService} />
      <Section title="أجهزة تم تسليمها للعميل" rows={sections.delivered} />
    </div>
  );
}

export default function BranchReceivingPage() {
  return (
    <RoleGuard allow="branch">
      <BranchReceivingContent />
    </RoleGuard>
  );
}
