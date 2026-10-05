"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { EXTERNAL_CONDITION_LABELS } from "@/lib/branch-catalog";
import { findDeviceHistory } from "@/lib/branch-store";
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
          results.map(({ request, device }) => (
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
                  <dt className="text-ink-700/60">الشكوى / العطل</dt>
                  <dd>{device.fault || "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-700/60">الحالة الخارجية</dt>
                  <dd>{EXTERNAL_CONDITION_LABELS[device.externalCondition]}</dd>
                </div>
                <div>
                  <dt className="text-ink-700/60">الملحقات</dt>
                  <dd>{device.accessoryNames.join("، ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-700/60">تاريخ الاستلام بالفرع</dt>
                  <dd>{formatDate(request.receivedAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-700/60">انتقالات / إصلاح / قطع غيار</dt>
                  <dd className="mt-1 text-ink-700/80">
                    استلام بالفرع بواسطة {request.branchStaffName}. لم تُسجَّل بعد أعمال فني أو قطع غيار
                    مستهلكة على هذا الجهاز.
                  </dd>
                </div>
              </dl>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
