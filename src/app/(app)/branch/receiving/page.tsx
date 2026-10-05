"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { deviceStatusLabel, listMaintenanceRequests } from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { MaintenanceRequestRecord, Profile } from "@/types/domain";

type Row = {
  key: string;
  deviceCode: string;
  modelName: string;
  requestNumber: string;
  contactName: string;
  mobile: string;
  date: string;
  status: string;
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
              <th className="px-2 py-2 font-medium">الحالة</th>
              <th className="px-2 py-2 font-medium">العميل</th>
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
                <tr key={row.key} className="border-b border-ink-900/5">
                  <td className="px-2 py-3 font-medium">{row.deviceCode}</td>
                  <td className="px-2 py-3">{row.modelName}</td>
                  <td className="px-2 py-3">{row.requestNumber}</td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">
                    {row.contactName}
                    <span className="block text-xs text-ink-700/60">{row.mobile}</span>
                  </td>
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
    const atBranch: Row[] = [];
    const inService: Row[] = [];
    const returning: Row[] = [];
    const receivedBack: Row[] = [];

    for (const request of requests) {
      for (const device of request.devices) {
        const row: Row = {
          key: `${request.id}-${device.localId}`,
          deviceCode: device.deviceCode,
          modelName: device.modelName,
          requestNumber: request.requestNumber,
          contactName: request.contactName,
          mobile: request.customerMobile,
          date: request.receivedAt,
          status: deviceStatusLabel(device.lifecycleStatus, "branch"),
        };
        const status = device.lifecycleStatus ?? "received_at_branch";
        if (
          [
            "received_at_branch",
            "awaiting_branch_handover",
            "excluded_from_shipment",
            "ready_to_ship",
          ].includes(status)
        ) {
          atBranch.push(row);
        } else if (
          [
            "in_transit_to_service",
            "awaiting_maintenance",
            "in_maintenance",
            "under_maintenance",
            "ready_to_return",
            "awaiting_manager_decision",
            "at_service_center",
          ].includes(status)
        ) {
          inService.push(row);
        } else if (status === "in_return_transit") {
          returning.push(row);
        } else if (
          ["received_at_destination", "received_damaged", "delivered_to_customer"].includes(status)
        ) {
          receivedBack.push(row);
        }
      }
    }

    return { atBranch, inService, returning, receivedBack };
  }, [requests]);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="استلام الصيانة"
        description={`متابعة أجهزة ${user.opsBranchName || "الفرع"} حسب موقعها في المسار.`}
      />
      <Section title="أجهزة في الفرع" rows={sections.atBranch} />
      <Section title="أجهزة في الصيانة / الطريق إليها" rows={sections.inService} />
      <Section title="أجهزة في الطريق إلى الفرع" rows={sections.returning} />
      <Section title="أجهزة مستلمة من الصيانة" rows={sections.receivedBack} />
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
