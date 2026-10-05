"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { DEVICE_STATUS_LABELS } from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import {
  SHIPPING_BATCH_STATUS_LABELS,
  confirmHandedToCarrier,
  listShippingBatches,
  removeDeviceFromShippingBatch,
} from "@/lib/shipping-store";
import type { Profile, ShippingBatch } from "@/types/domain";

function BranchShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(session?: Profile | null) {
    const current = session ?? readSession();
    setBatches(listShippingBatches(current?.opsBranchId));
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    refresh(session);
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div>
      <PageHeader
        title="شحن الصيانة"
        description="بوالص أنشأها مدير الصيانة لفرعك. يمكنك استبعاد جهاز قبل التسليم، ثم تأكيد التسليم لشركة الشحن."
      />
      {message ? <p className="mb-4 text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}

      <div className="space-y-4">
        {batches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد بوالص لفرعك بعد. ينشئها مدير الصيانة مركزيًا.
          </p>
        ) : (
          batches.map((batch) => {
            const activeItems = batch.items.filter((item) => item.status === "active");
            const removedItems = batch.items.filter((item) => item.status === "removed");
            const locked = batch.status === "handed_to_carrier";

            return (
              <section
                key={batch.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl">
                      {batch.batchNumber} · بوليصة {batch.shipmentNumber}
                    </h2>
                    <p className="text-sm text-ink-700/70">
                      شركة الشحن: {batch.carrier} ·{" "}
                      {SHIPPING_BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </p>
                  </div>
                  <p className="text-sm text-ink-700/60">{activeItems.length} جهاز نشط</p>
                </div>

                <div className="mt-4 space-y-3">
                  {activeItems.length === 0 ? (
                    <p className="text-sm text-ink-700/60">لا توجد أجهزة نشطة على هذه البوليصة.</p>
                  ) : (
                    activeItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-ink-900/10 px-3 py-3"
                      >
                        <div>
                          <p className="font-medium">{item.deviceCode}</p>
                          <p className="text-xs text-ink-700/60">
                            {item.modelName || "—"}
                            {locked
                              ? ` · ${DEVICE_STATUS_LABELS.in_transit_to_service}`
                              : " · يمكن الاستبعاد قبل التسليم"}
                          </p>
                        </div>
                        {!locked ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <input
                              value={notes[item.id] ?? ""}
                              onChange={(e) =>
                                setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="سبب الاستبعاد"
                              className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setMessage(null);
                                const result = removeDeviceFromShippingBatch({
                                  user,
                                  batchId: batch.id,
                                  itemId: item.id,
                                  reason: notes[item.id] ?? "",
                                });
                                if (!result.ok) {
                                  setError(result.error);
                                  return;
                                }
                                setMessage(`تم استبعاد ${item.deviceCode} من البوليصة.`);
                                refresh(user);
                              }}
                              className="rounded-full bg-rose-700 px-4 py-2 text-sm text-white"
                            >
                              استبعاد من البوليصة
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                {removedItems.length ? (
                  <div className="mt-4 rounded-xl bg-sand-50 p-3 text-xs text-ink-700/70">
                    أجهزة مُستبعدة:{" "}
                    {removedItems
                      .map((item) => `${item.deviceCode} (${item.removalReason ?? "—"})`)
                      .join(" · ")}
                  </div>
                ) : null}

                {!locked ? (
                  <button
                    type="button"
                    className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      const result = confirmHandedToCarrier({ user, batchId: batch.id });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(
                        `تم تأكيد التسليم لشركة الشحن. الحالة: مرسل إلى مركز الصيانة / في الطريق.`,
                      );
                      refresh(user);
                    }}
                  >
                    تم التسليم لشركة الشحن
                  </button>
                ) : (
                  <p className="mt-4 text-sm text-aroma-700">
                    تم التسليم في{" "}
                    {batch.handedToCarrierAt
                      ? new Date(batch.handedToCarrierAt).toLocaleString("ar-SA")
                      : "—"}
                    . البوليصة مقفلة — لا تعديل ولا استبعاد.
                  </p>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function BranchShippingPage() {
  return (
    <RoleGuard allow="branch">
      <BranchShippingContent />
    </RoleGuard>
  );
}
