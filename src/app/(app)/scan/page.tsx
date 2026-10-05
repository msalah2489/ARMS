"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { EXTERNAL_CONDITION_LABELS } from "@/lib/branch-catalog";
import { DEVICE_STATUS_LABELS, findDeviceHistory } from "@/lib/branch-store";
import { OUTCOME_LABELS } from "@/lib/technician-catalog";
import { getDeviceWorkHistory } from "@/lib/technician-store";
import { formatDate } from "@/lib/utils";

export default function ScanPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturnType<typeof findDeviceHistory>>([]);
  const [searched, setSearched] = useState(false);

  return (
    <div>
      <PageHeader
        title="سكان الجهاز"
        description="ابحث بكود الجهاز أو الرقم التسلسلي أو محتوى QR لعرض تاريخ الصيانة الكامل."
      />
      <form
        className="flex flex-wrap gap-3 rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setResults(findDeviceHistory(query));
          setSearched(true);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="كود الجهاز / السيريال / QR"
          className="min-w-[240px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2"
        />
        <button type="submit" className="rounded-full bg-ink-900 px-5 py-2 text-sm text-white">
          عرض السجل
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {!searched ? (
          <p className="text-sm text-ink-700/70">أدخل معرف الجهاز لعرض السجل.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-rose-700">لا يوجد سجل مطابق.</p>
        ) : (
          results.map(({ request, device }) => {
            const workHistory = getDeviceWorkHistory(device.deviceCode);
            return (
              <section
                key={`${request.id}-${device.localId}`}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <h2 className="font-display text-xl">{device.deviceCode}</h2>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-700/60">رقم الطلب</dt>
                    <dd className="font-medium">{request.requestNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">العميل</dt>
                    <dd>
                      {request.contactName} · {request.customerMobile}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">الفرع</dt>
                    <dd>{request.opsBranchName}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">الحالة الحالية</dt>
                    <dd>{DEVICE_STATUS_LABELS[device.lifecycleStatus ?? "received_at_branch"]}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">الموديل</dt>
                    <dd>
                      {device.brandName} {device.modelName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">السيريال</dt>
                    <dd>{device.serialNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">الشكوى السابقة</dt>
                    <dd>{device.fault || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-700/60">الحالة الخارجية عند الاستلام</dt>
                    <dd>{EXTERNAL_CONDITION_LABELS[device.externalCondition]}</dd>
                  </div>
                </dl>

                <h3 className="mt-6 font-display text-lg">أعمال الفنيين وقطع الغيار</h3>
                {workHistory.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-700/60">لم تُسجَّل أعمال صيانة بعد على هذا الجهاز.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workHistory.map((work) => (
                      <div key={work.id} className="rounded-xl bg-sand-50 p-3 text-sm">
                        <p className="font-medium">
                          {work.technicianName} ·{" "}
                          {work.status === "completed"
                            ? "مكتمل"
                            : work.status === "held"
                              ? "معلّق / مستبعد"
                              : "قيد العمل"}
                        </p>
                        <p className="text-ink-700/70">
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
                        {work.sparePartsUsed?.length ? (
                          <p>
                            قطع الغيار:{" "}
                            {work.sparePartsUsed
                              .map(
                                (part) =>
                                  `${part.partName}${part.color ? ` (${part.color})` : ""} × ${part.qty}`,
                              )
                              .join("، ")}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-700/60">
                          انتقالات: فرع ← مركز صيانة
                          {work.status === "completed"
                            ? " ← جاهز للإرسال"
                            : work.status === "held"
                              ? " ← محوّل للمشرف"
                              : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
