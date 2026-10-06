"use client";

import { useEffect, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { deviceStatusLabel, listAllRequestDevices } from "@/lib/branch-store";
import { getOpsDevice } from "@/lib/ops-data";
import type { Device } from "@/types/domain";

export function DeviceDetailClient({ id }: { id: string }) {
  const [device, setDevice] = useState<Device | null>(null);
  const [lifecycle, setLifecycle] = useState<string>("");
  const [fault, setFault] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ops = getOpsDevice(id);
    setDevice(ops);
    const match = listAllRequestDevices().find((item) => item.device.localId === id);
    if (match) {
      setLifecycle(match.device.lifecycleStatus ?? "");
      setFault(match.device.fault);
      setRequestNumber(match.request.requestNumber);
      if (match.device.receiptPhotoDataUrl) {
        setReceiptPhoto({
          name: match.device.receiptPhotoName || "سند الاستلام",
          dataUrl: match.device.receiptPhotoDataUrl,
        });
      } else {
        setReceiptPhoto(null);
      }
    }
    setLoading(false);
  }, [id]);

  if (loading) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  if (!device) return <p className="text-sm text-rose-700">الجهاز غير موجود.</p>;

  return (
    <div>
      <PageHeader
        title={device.deviceCode}
        description={`${device.brand} ${device.modelName}`}
        action={<StatusBadge value={device.status} />}
      />
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
          <div className="sm:col-span-2">
            <dt className="text-ink-700/60 dark:text-sand-100/60">العطل</dt>
            <dd className="mt-1">{fault || "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
