"use client";

import { useEffect, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { LifecycleProgressStrip } from "@/components/lifecycle-progress";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  ASSIGNMENT_PATH_LABELS,
  deviceStatusLabel,
  formatMaintenanceDuration,
  getDeviceAssignmentPath,
} from "@/lib/branch-store";
import { getMaintenanceRequestById, getOpsServiceRequest } from "@/lib/ops-data";
import { formatDate } from "@/lib/utils";
import type { MaintenanceRequestRecord, ServiceRequest } from "@/types/domain";

export function RequestDetailClient({ id }: { id: string }) {
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [record, setRecord] = useState<MaintenanceRequestRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const opsRecord = getMaintenanceRequestById(id);
    setRecord(opsRecord);
    setRequest(getOpsServiceRequest(id));
    setLoading(false);
  }, [id]);

  if (loading) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  if (!request && !record) {
    return <p className="text-sm text-rose-700">طلب الصيانة غير موجود.</p>;
  }

  const title = record?.requestNumber ?? request?.requestNumber ?? id;
  const description = record
    ? `${record.contactName} · ${record.opsBranchName}`
    : `${request?.customerName} · ${request?.branchName}`;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={request ? <StatusBadge value={request.status} /> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900 lg:col-span-2">
          <h2 className="font-display text-xl">تفاصيل الطلب</h2>
          {record ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">رقم الطلب</dt>
                <dd className="font-medium">{record.requestNumber}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الأولوية</dt>
                <dd>
                  <StatusBadge value={record.priority} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">العميل</dt>
                <dd className="font-medium">{record.contactName}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الجوال</dt>
                <dd>{record.customerMobile}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الفرع</dt>
                <dd>{record.opsBranchName}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">تاريخ الاستلام</dt>
                <dd>{formatDate(record.receivedAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">فاتورة الشراء</dt>
                <dd>{record.purchaseInvoice || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">موظف الفرع</dt>
                <dd>{record.branchStaffName}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">مسار الصيانة</dt>
                <dd>
                  {record.assignmentPath
                    ? ASSIGNMENT_PATH_LABELS[record.assignmentPath]
                    : "إرسال لمركز الصيانة (افتراضي)"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-700/60 dark:text-sand-100/60">ملاحظات عامة</dt>
                <dd className="mt-1">{record.generalNotes || "—"}</dd>
              </div>
            </dl>
          ) : request ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الجهاز</dt>
                <dd className="font-medium">
                  {request.deviceCode} / {request.serialNumber}
                </dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الأولوية</dt>
                <dd>
                  <StatusBadge value={request.priority} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">الفني</dt>
                <dd>{request.assignedTechnician ?? "غير معيّن"}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">تاريخ الفتح</dt>
                <dd>{formatDate(request.requestedAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-700/60 dark:text-sand-100/60">المشكلة</dt>
                <dd className="mt-1">{request.reportedProblem}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <h2 className="font-display text-xl">الأجهزة ({record?.devices.length ?? 0})</h2>
          <div className="mt-4 space-y-3 text-sm">
            {(record?.devices ?? []).length === 0 ? (
              <p className="text-ink-700/60 dark:text-sand-100/60">لا توجد أجهزة.</p>
            ) : (
              record!.devices.map((device) => (
                <div
                  key={device.localId}
                  className="flex gap-3 rounded-xl border border-ink-900/10 px-3 py-3 dark:border-white/10"
                >
                  {device.deviceImageDataUrl ? (
                    <ClickableImage
                      src={device.deviceImageDataUrl}
                      alt={device.deviceCode}
                      size="md"
                    />
                  ) : (
                    <ImagePlaceholder size="md" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {device.deviceCode} · {device.brandName} {device.modelName}
                    </p>
                    <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                      SN: {device.serialNumber || "—"} ·{" "}
                      {deviceStatusLabel(device.lifecycleStatus, "technician")}
                    </p>
                    {device.lifecycleStatus ? (
                      <LifecycleProgressStrip
                        status={device.lifecycleStatus}
                        path={getDeviceAssignmentPath(record!, device)}
                        className="mt-2"
                      />
                    ) : null}
                    <p className="mt-1 text-xs text-ink-700/70 dark:text-sand-100/70">
                      العطل: {device.fault || "—"}
                    </p>
                    {device.assignedTechnicianName ? (
                      <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                        الفني: {device.assignedTechnicianName}
                      </p>
                    ) : null}
                    {device.maintenanceStartedAt ? (
                      <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                        مدة الصيانة:{" "}
                        {formatMaintenanceDuration(
                          device.maintenanceStartedAt,
                          device.maintenanceFinishedAt,
                        )}
                      </p>
                    ) : null}
                    {device.receiptPhotoDataUrl ? (
                      <div className="mt-2">
                        <ClickableImage
                          src={device.receiptPhotoDataUrl}
                          alt={device.receiptPhotoName || "سند الاستلام"}
                          size="sm"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
