"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DeviceQrPrintModal } from "@/components/device-qr-print-modal";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  deviceStatusLabel,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import { ensureDeviceQrFields, isDeviceQrPrinted } from "@/lib/device-qr";
import { markDeliveredToCustomer } from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { DraftRequestDevice, MaintenanceRequestRecord, Profile } from "@/types/domain";

type Row = {
  key: string;
  requestId: string;
  deviceLocalId: string;
  deviceCode: string;
  modelName: string;
  requestNumber: string;
  contactName: string;
  mobile: string;
  date: string;
  status: string;
  lifecycleStatus: string;
  qrPrinted: boolean;
  device: DraftRequestDevice;
};

function BranchReceivingContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<{
    requestId: string;
    device: DraftRequestDevice;
  } | null>(null);

  function refresh(session?: Profile | null) {
    const current = session ?? user;
    setRequests(listMaintenanceRequests(current?.opsBranchId));
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    refresh(session);
    return subscribeMaintenanceRequestsChanged(() => {
      const current = readSession();
      setUser(current);
      refresh(current);
    });
  }, []);

  useEffect(() => {
    const created = searchParams?.get("created")?.trim();
    if (!created) return;
    setMessage(`تم حفظ الطلب ${created} بنجاح.`);
  }, [searchParams]);

  useEffect(() => {
    const focus = searchParams?.get("focus")?.trim();
    if (!focus) return;
    const id =
      focus === "deliver"
        ? "branch-focus-deliver"
        : focus === "return"
          ? "branch-focus-return"
          : focus === "at_branch"
            ? "branch-focus-at-branch"
            : null;
    if (!id) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [searchParams, requests]);

  const sections = useMemo(() => {
    const atBranch: Row[] = [];
    const inService: Row[] = [];
    const returning: Row[] = [];
    const readyForCustomer: Row[] = [];
    const delivered: Row[] = [];

    for (const request of requests) {
      for (const device of request.devices) {
        const row: Row = {
          key: `${request.id}-${device.localId}`,
          requestId: request.id,
          deviceLocalId: device.localId,
          deviceCode: device.deviceCode,
          modelName: device.modelName,
          requestNumber: request.requestNumber,
          contactName: request.contactName,
          mobile: request.customerMobile,
          date: request.receivedAt,
          status: deviceStatusLabel(device.lifecycleStatus, "branch"),
          lifecycleStatus: device.lifecycleStatus ?? "received_at_branch",
          qrPrinted: isDeviceQrPrinted(device),
          device,
        };
        const status = normalizeLifecycleStatus(row.lifecycleStatus);
        if (
          [
            "received_at_branch",
            "excluded_from_shipment",
            "in_maintenance_at_branch",
            "maintenance_failed",
          ].includes(status)
        ) {
          atBranch.push(row);
        } else if (
          [
            "in_transit_to_service",
            "awaiting_maintenance",
            "in_maintenance",
            "ready_to_return",
            "awaiting_manager_decision",
            "closed",
          ].includes(status)
        ) {
          inService.push(row);
        } else if (status === "in_return_transit") {
          returning.push(row);
        } else if (status === "awaiting_customer") {
          readyForCustomer.push(row);
        } else if (status === "delivered_to_customer") {
          delivered.push(row);
        }
      }
    }

    return { atBranch, inService, returning, readyForCustomer, delivered };
  }, [requests]);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  function renderTable(rows: Row[], withDeliver = false) {
    const colSpan = withDeliver ? 8 : 7;
    return (
      <div className="arms-scroll-x mt-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-right text-ink-700/70">
              <th className="px-2 py-2 font-medium">كود الجهاز</th>
              <th className="px-2 py-2 font-medium">الموديل</th>
              <th className="px-2 py-2 font-medium">رقم الطلب</th>
              <th className="px-2 py-2 font-medium">الحالة</th>
              <th className="px-2 py-2 font-medium">ملصق QR</th>
              <th className="px-2 py-2 font-medium">العميل</th>
              <th className="px-2 py-2 font-medium">التاريخ</th>
              {withDeliver ? <th className="px-2 py-2 font-medium">إجراء</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-2 py-6 text-ink-700/60">
                  لا توجد أجهزة في هذا القسم.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-ink-900/5">
                  <td className="px-2 py-3 font-medium">{row.deviceCode}</td>
                  <td className="px-2 py-3">{row.modelName}</td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/service-requests/detail/?id=${encodeURIComponent(row.requestId)}`}
                      className="inline-flex font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 hover:text-aroma-800 dark:text-aroma-200"
                    >
                      {row.requestNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-3">{row.status}</td>
                  <td className="px-2 py-3">
                    {row.qrPrinted ? (
                      <button
                        type="button"
                        className="text-xs text-aroma-700 underline"
                        onClick={() =>
                          setQrTarget({
                            requestId: row.requestId,
                            device: ensureDeviceQrFields(row.device),
                          })
                        }
                      >
                        مطبوع — إعادة
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-full bg-amber-600 px-3 py-1.5 text-xs text-white"
                        onClick={() =>
                          setQrTarget({
                            requestId: row.requestId,
                            device: ensureDeviceQrFields(row.device),
                          })
                        }
                      >
                        طباعة QR
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {row.contactName}
                    <span className="block text-xs text-ink-700/60">{row.mobile}</span>
                  </td>
                  <td className="px-2 py-3">{formatDate(row.date)}</td>
                  {withDeliver ? (
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="rounded-full bg-ink-900 px-3 py-1.5 text-xs text-white"
                        onClick={() => {
                          if (!user) return;
                          setError(null);
                          setMessage(null);
                          const result = markDeliveredToCustomer({
                            user,
                            requestId: row.requestId,
                            deviceLocalId: row.deviceLocalId,
                          });
                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }
                          setMessage(`تم تسليم ${row.deviceCode} للعميل.`);
                          refresh(user);
                        }}
                      >
                        تسليم للعميل
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="استلام الصيانة"
        description={`متابعة أجهزة ${user.opsBranchName || "الفرع"} حسب موقعها، وتسليمها للعميل بعد العودة من الصيانة.`}
        action={
          <Link
            href="/service-requests/new"
            className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
          >
            طلب جديد
          </Link>
        }
      />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {sections.atBranch.some((row) => !row.qrPrinted) ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          يوجد أجهزة بلا ملصق QR مطبوع — لن تظهر في الشحن/نماذج المندوب حتى تتم الطباعة.
        </p>
      ) : null}

      <section
        id="branch-focus-at-branch"
        className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
      >
        <h2 className="font-display text-xl">أجهزة في الفرع</h2>
        <p className="mt-1 text-xs text-ink-700/60">{sections.atBranch.length} جهاز</p>
        {renderTable(sections.atBranch)}
      </section>
      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">أجهزة في الصيانة / الطريق إليها</h2>
        <p className="mt-1 text-xs text-ink-700/60">{sections.inService.length} جهاز</p>
        {renderTable(sections.inService)}
      </section>
      <section
        id="branch-focus-return"
        className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
      >
        <h2 className="font-display text-xl">أجهزة فى الطريق الى الفرع</h2>
        <p className="mt-1 text-xs text-ink-700/60">{sections.returning.length} جهاز</p>
        {renderTable(sections.returning)}
      </section>
      <section
        id="branch-focus-deliver"
        className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
      >
        <h2 className="font-display text-xl">بانتظار العميل — تسليم للعميل</h2>
        <p className="mt-1 text-xs text-ink-700/60">{sections.readyForCustomer.length} جهاز</p>
        {renderTable(sections.readyForCustomer, true)}
      </section>
      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">تم التسليم للعميل</h2>
        <p className="mt-1 text-xs text-ink-700/60">{sections.delivered.length} جهاز</p>
        {renderTable(sections.delivered)}
      </section>

      <DeviceQrPrintModal
        open={Boolean(qrTarget)}
        device={qrTarget?.device ?? null}
        requestId={qrTarget?.requestId}
        requirePrint={!qrTarget?.device.qrPrintedAt}
        onPrinted={() => {
          setQrTarget(null);
          setMessage("تم تأكيد طباعة ملصق QR.");
          refresh(user);
        }}
        onClose={() => setQrTarget(null)}
      />
    </div>
  );
}

export default function BranchReceivingPage() {
  return (
    <RoleGuard
      allow="branch"
      permission={["receive_from_customer", "receive_return_from_service", "deliver_to_customer"]}
    >
      <Suspense fallback={<p className="text-sm text-ink-700/70">جاري التحميل…</p>}>
        <BranchReceivingContent />
      </Suspense>
    </RoleGuard>
  );
}
