"use client";

import { useEffect, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { DeviceHistoryPanel } from "@/components/device-history-panel";
import { DeviceQrPrintModal } from "@/components/device-qr-print-modal";
import { LifecycleProgressStrip } from "@/components/lifecycle-progress";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { branchScopeId, isBranchRole } from "@/lib/auth";
import {
  deviceStatusLabel,
  getDeviceAssignmentPath,
  listAllRequestDevices,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { ensureDeviceQrFields, isDeviceQrPrinted } from "@/lib/device-qr";
import { getOpsDevice } from "@/lib/ops-data";
import { readSession } from "@/lib/session";
import type { Device, DraftRequestDevice, MaintenanceAssignmentPath } from "@/types/domain";

export function DeviceDetailClient({ id }: { id: string }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [match, setMatch] = useState<TechnicianQueueItem | null>(null);
  const [lifecycle, setLifecycle] = useState<string>("");
  const [assignmentPath, setAssignmentPath] = useState<MaintenanceAssignmentPath | null>(null);
  const [fault, setFault] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [canPrintQr, setCanPrintQr] = useState(false);

  function reload() {
    const session = readSession();
    const scope = branchScopeId(session);
    const ops = getOpsDevice(id, scope);
    setDevice(ops);
    setCanPrintQr(Boolean(session && isBranchRole(session.role)));
    const found = listAllRequestDevices().find(
      (item) =>
        item.device.localId === id && (!scope || item.request.opsBranchId === scope),
    );
    if (found) {
      setMatch(found);
      setLifecycle(found.device.lifecycleStatus ?? "");
      setAssignmentPath(getDeviceAssignmentPath(found.request, found.device));
      setFault(found.device.fault);
      setRequestNumber(found.request.requestNumber);
      if (found.device.receiptPhotoDataUrl) {
        setReceiptPhoto({
          name: found.device.receiptPhotoName || "سند الاستلام",
          dataUrl: found.device.receiptPhotoDataUrl,
        });
      } else {
        setReceiptPhoto(null);
      }
      setForbidden(false);
    } else if (scope && listAllRequestDevices().some((item) => item.device.localId === id)) {
      setMatch(null);
      setForbidden(true);
    } else {
      setMatch(null);
      setForbidden(false);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [id]);

  if (loading) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  if (forbidden) {
    return <p className="text-sm text-rose-700">لا يمكنك عرض أجهزة فروع أخرى.</p>;
  }
  if (!device) return <p className="text-sm text-rose-700">الجهاز غير موجود.</p>;

  const draftDevice: DraftRequestDevice | null = match
    ? ensureDeviceQrFields(match.device)
    : null;

  return (
    <div>
      <PageHeader
        title={device.deviceCode}
        description={`${device.brand} ${device.modelName}`}
        backHref="/devices"
        backLabel="رجوع"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canPrintQr && draftDevice ? (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="rounded-full border border-ink-900/15 px-3 py-1.5 text-xs dark:border-white/15"
              >
                {isDeviceQrPrinted(draftDevice) ? "إعادة طباعة QR" : "طباعة QR"}
              </button>
            ) : null}
            <StatusBadge value={lifecycle || device.lifecycleStatus || device.status} />
          </div>
        }
      />
      {lifecycle ? (
        <LifecycleProgressStrip
          status={lifecycle}
          path={assignmentPath}
          className="mb-4"
        />
      ) : null}
      <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900">
        <div className="mb-6 flex flex-wrap items-start gap-4">
          {device.imageDataUrl ? (
            <ClickableImage src={device.imageDataUrl} alt={device.deviceCode} size="lg" />
          ) : (
            <ImagePlaceholder size="lg" />
          )}
          {receiptPhoto ? (
            <div>
              <p className="mb-1 text-xs text-ink-700/60 dark:text-sand-100/60">سند الاستلام</p>
              <ClickableImage src={receiptPhoto.dataUrl} alt={receiptPhoto.name} size="lg" />
            </div>
          ) : null}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">الرقم التسلسلي</dt>
            <dd className="font-medium">{device.serialNumber}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">حالة مسار الصيانة</dt>
            <dd className="font-medium">
              {lifecycle ? deviceStatusLabel(lifecycle, "technician") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">العميل</dt>
            <dd>{device.customerName}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">الفرع</dt>
            <dd>{device.branchName}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">طلب الصيانة</dt>
            <dd>{requestNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">الموقع الحالي</dt>
            <dd>{device.currentLocation}</dd>
          </div>
          <div>
            <dt className="text-ink-700/60 dark:text-sand-100/60">ملصق QR</dt>
            <dd>
              {draftDevice && isDeviceQrPrinted(draftDevice) ? "مطبوع" : "غير مطبوع"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-700/60 dark:text-sand-100/60">العطل</dt>
            <dd className="mt-1">{fault || "—"}</dd>
          </div>
        </dl>
      </section>

      {match ? (
        <div className="mt-6">
          <DeviceHistoryPanel request={match.request} device={match.device} />
        </div>
      ) : null}

      {draftDevice && match ? (
        <DeviceQrPrintModal
          open={qrOpen}
          device={draftDevice}
          requestId={match.request.id}
          requirePrint={false}
          onPrinted={() => {
            setQrOpen(false);
            reload();
          }}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </div>
  );
}
