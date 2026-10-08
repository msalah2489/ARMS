"use client";

import { EXTERNAL_CONDITION_LABELS } from "@/lib/branch-catalog";
import { deviceStatusLabel, getDeviceAssignmentPath } from "@/lib/branch-store";
import { OUTCOME_LABELS } from "@/lib/technician-catalog";
import { getDeviceWorkHistory } from "@/lib/technician-store";
import { formatDate } from "@/lib/utils";
import type { DraftRequestDevice, MaintenanceRequestRecord } from "@/types/domain";

type Props = {
  request: MaintenanceRequestRecord;
  device: DraftRequestDevice;
  /** Compact mode for scan results */
  compact?: boolean;
};

export function DeviceHistoryPanel({ request, device, compact = false }: Props) {
  const workHistory = [
    ...getDeviceWorkHistory(device.deviceCode),
    ...getDeviceWorkHistory(device.localId),
  ].filter(
    (work, index, all) => all.findIndex((item) => item.id === work.id) === index,
  );
  const path = getDeviceAssignmentPath(request, device);
  const spareLines = workHistory.flatMap((work) =>
    (work.sparePartsUsed ?? []).map((part) => ({
      workId: work.id,
      technicianName: work.technicianName,
      finishedAt: work.finishedAt || work.startedAt,
      ...part,
    })),
  );

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900"
          : "mt-6 space-y-6"
      }
    >
      <div>
        <h2 className="font-display text-xl">{device.deviceCode}</h2>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
          {device.brandName} {device.modelName} · طلب {request.requestNumber}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">العميل</dt>
          <dd>
            {request.contactName} · {request.customerMobile}
          </dd>
        </div>
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">الفرع</dt>
          <dd>{request.opsBranchName}</dd>
        </div>
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">الحالة الحالية</dt>
          <dd>{deviceStatusLabel(device.lifecycleStatus)}</dd>
        </div>
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">مسار الصيانة</dt>
          <dd>
            {path === "mobile_technician"
              ? "فني متنقل"
              : path === "service_center"
                ? "مركز الصيانة"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">السيريال</dt>
          <dd>{device.serialNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-700/60 dark:text-sand-100/60">الحالة الخارجية عند الاستلام</dt>
          <dd>{EXTERNAL_CONDITION_LABELS[device.externalCondition]}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink-700/60 dark:text-sand-100/60">العطل المبلّغ</dt>
          <dd className="mt-1">{device.fault || "—"}</dd>
        </div>
      </dl>

      <div className={compact ? "mt-6" : undefined}>
        <h3 className="font-display text-lg">سجل أعمال الصيانة</h3>
        {workHistory.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/60 dark:text-sand-100/60">
            لم تُسجَّل أعمال صيانة بعد على هذا الجهاز.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {workHistory.map((work) => (
              <div
                key={work.id}
                className="rounded-xl bg-sand-50 p-3 text-sm dark:bg-ink-950"
              >
                <p className="font-medium">
                  {work.technicianName} ·{" "}
                  {work.status === "completed"
                    ? "مكتمل"
                    : work.status === "held"
                      ? "معلّق / مستبعد"
                      : "قيد العمل"}
                </p>
                <p className="text-ink-700/70 dark:text-sand-100/70">
                  بدء: {formatDate(work.startedAt)}
                  {work.finishedAt ? ` · انتهاء: ${formatDate(work.finishedAt)}` : ""}
                </p>
                {work.outcome ? <p>النتيجة: {OUTCOME_LABELS[work.outcome]}</p> : null}
                {work.faultCause ? <p>سبب العطل: {work.faultCause}</p> : null}
                {work.actionTaken ? (
                  <p>
                    الإجراء: {work.actionTaken}
                    {work.actionOther ? ` — ${work.actionOther}` : ""}
                  </p>
                ) : null}
                {work.holdReason ? <p>سبب التعليق: {work.holdReason}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={compact ? "mt-6" : undefined}>
        <h3 className="font-display text-lg">قطع الغيار المستهلكة</h3>
        {spareLines.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/60 dark:text-sand-100/60">
            لا توجد قطع غيار مسجّلة على هذا الجهاز.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {spareLines.map((line, index) => (
              <li
                key={`${line.workId}-${line.partId}-${index}`}
                className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
              >
                <span className="font-medium">
                  {line.partName}
                  {line.color ? ` (${line.color})` : ""} × {line.qty}
                </span>
                <span className="mt-0.5 block text-xs text-ink-700/60 dark:text-sand-100/60">
                  {line.technicianName} · {formatDate(line.finishedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
