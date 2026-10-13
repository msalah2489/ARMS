"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { LifecycleProgressStrip } from "@/components/lifecycle-progress";
import { PageHeader } from "@/components/page-header";
import { RequestReturnReasonModal } from "@/components/request-return-reason-modal";
import { RequestTimeline } from "@/components/request-timeline";
import { StatusBadge } from "@/components/status-badge";
import { branchScopeId } from "@/lib/auth";
import {
  ASSIGNMENT_PATH_LABELS,
  deviceStatusLabel,
  formatMaintenanceDuration,
  getDeviceAssignmentPath,
  getMaintenanceRequestById,
  listMaintenanceRequests,
  normalizeLifecycleStatus,
  withDevicePhotos,
} from "@/lib/branch-store";
import { getOpsServiceRequest } from "@/lib/ops-data";
import {
  canCreateFollowUpRequest,
  canReopenRequest,
  listFollowUpRequests,
  reopenMaintenanceRequest,
  requestReturnReasonLabel,
} from "@/lib/request-return";
import { buildRequestTimeline, type TimelineEvent } from "@/lib/request-timeline";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type {
  MaintenanceRequestRecord,
  Profile,
  RequestReturnReason,
  ServiceRequest,
} from "@/types/domain";

function detailHref(id: string) {
  return `/service-requests/detail/?id=${encodeURIComponent(id)}`;
}

export function RequestDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [record, setRecord] = useState<MaintenanceRequestRecord | null>(null);
  const [followUps, setFollowUps] = useState<MaintenanceRequestRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [modalMode, setModalMode] = useState<"follow_up" | "reopen" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const session = readSession();
    setUser(session);
    const scope = branchScopeId(session);
    const opsRecord = getMaintenanceRequestById(id);
    if (scope && opsRecord && opsRecord.opsBranchId !== scope) {
      setRecord(null);
      setRequest(null);
      setFollowUps([]);
      setTimeline([]);
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setRecord(opsRecord);
    setRequest(getOpsServiceRequest(id, scope));
    setFollowUps(opsRecord ? listFollowUpRequests(opsRecord.id, listMaintenanceRequests()) : []);
    setTimeline(opsRecord ? buildRequestTimeline(opsRecord) : []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;
  if (forbidden) {
    return <p className="text-sm text-rose-700">لا يمكنك عرض طلبات فروع أخرى.</p>;
  }
  if (!request && !record) {
    return <p className="text-sm text-rose-700">طلب الصيانة غير موجود.</p>;
  }

  const title = record?.requestNumber ?? request?.requestNumber ?? id;
  const description = record
    ? `${record.contactName} · ${record.opsBranchName}`
    : `${request?.customerName} · ${request?.branchName}`;
  const headerLifecycle =
    request?.deviceLifecycles?.length === 1
      ? request.deviceLifecycles[0].status
      : request?.deviceLifecycles &&
          new Set(request.deviceLifecycles.map((item) => item.status)).size === 1
        ? request.deviceLifecycles[0].status
        : record?.devices.length === 1
          ? normalizeLifecycleStatus(record.devices[0].lifecycleStatus)
          : null;

  const showFollowUp = Boolean(record && canCreateFollowUpRequest(record));
  const showReopen = Boolean(record && canReopenRequest(record));
  const parentId = record?.parentRequestId?.trim() || "";
  const parentNumber = record?.parentRequestNumber?.trim() || parentId;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        backHref="/service-requests"
        backLabel="رجوع"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {headerLifecycle ? (
              <StatusBadge value={headerLifecycle} />
            ) : request ? (
              <StatusBadge value={request.status} />
            ) : null}
            {showFollowUp ? (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActionMessage(null);
                  setModalMode("follow_up");
                }}
                className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
              >
                طلب متابعة (إرجاع)
              </button>
            ) : null}
            {showReopen ? (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActionMessage(null);
                  setModalMode("reopen");
                }}
                className="rounded-full border border-ink-900/20 bg-white px-4 py-2 text-sm text-ink-900 dark:border-white/20 dark:bg-ink-950 dark:text-sand-50"
              >
                إعادة فتح الطلب
              </button>
            ) : null}
          </div>
        }
      />

      {actionError ? (
        <p className="mb-4 text-sm text-rose-700 dark:text-rose-300">{actionError}</p>
      ) : null}
      {actionMessage ? (
        <p className="mb-4 text-sm text-aroma-700 dark:text-aroma-200">{actionMessage}</p>
      ) : null}

      {record && (parentId || followUps.length > 0) ? (
        <section className="mb-6 rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <h2 className="font-display text-lg text-ink-900 dark:text-sand-50">الربط مع الطلبات</h2>
          {parentId ? (
            <p className="mt-2 text-sm text-ink-800 dark:text-sand-100">
              تابع للطلب السابق{" "}
              <Link href={detailHref(parentId)} className="font-medium underline">
                {parentNumber}
              </Link>
              {record.linkReason ? (
                <span className="text-ink-700/70 dark:text-sand-100/70">
                  {" "}
                  · السبب: {requestReturnReasonLabel(record.linkReason)}
                  {record.linkNote?.trim() ? ` — ${record.linkNote.trim()}` : ""}
                </span>
              ) : null}
            </p>
          ) : null}
          {followUps.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-ink-800 dark:text-sand-100">
              {followUps.map((child) => (
                <li key={child.id}>
                  طلب متابعة:{" "}
                  <Link href={detailHref(child.id)} className="font-medium underline">
                    {child.requestNumber}
                  </Link>
                  {child.linkReason ? (
                    <span className="text-ink-700/70 dark:text-sand-100/70">
                      {" "}
                      · {requestReturnReasonLabel(child.linkReason)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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
              record!.devices.map((rawDevice) => {
                const device = withDevicePhotos(rawDevice);
                return (
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
                    {device.replacedByDeviceCode ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        استُبدل بـ {device.replacedByDeviceCode}
                      </p>
                    ) : null}
                    {device.replacementOfDeviceCode ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        بديل عن {device.replacementOfDeviceCode}
                      </p>
                    ) : null}
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
                );
              })
            )}
          </div>
        </section>
      </div>

      {record ? (
        <div className="mt-6">
          <RequestTimeline events={timeline} title="الخط الزمني للطلب" />
        </div>
      ) : null}

      <RequestReturnReasonModal
        open={modalMode !== null}
        mode={modalMode ?? "follow_up"}
        onClose={() => setModalMode(null)}
        onConfirm={(reason: RequestReturnReason, note: string) => {
          if (!record || !user) {
            setActionError("يجب تسجيل الدخول لإكمال الإجراء.");
            setModalMode(null);
            return;
          }
          if (modalMode === "follow_up") {
            const params = new URLSearchParams({
              from: record.id,
              reason,
            });
            if (note) params.set("note", note);
            setModalMode(null);
            router.push(`/service-requests/new?${params.toString()}`);
            return;
          }
          const result = reopenMaintenanceRequest({
            user,
            requestId: record.id,
            reason,
            note,
          });
          setModalMode(null);
          if (!result.ok) {
            setActionError(result.error);
            return;
          }
          setActionMessage("تمت إعادة فتح الطلب وتسجيل السبب في الخط الزمني.");
          refresh();
        }}
      />
    </div>
  );
}
