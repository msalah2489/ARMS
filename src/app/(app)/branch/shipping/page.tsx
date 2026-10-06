"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { deviceStatusLabel } from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import {
  BRANCH_RETURN_OUTCOME_LABELS,
  SHIPPING_BATCH_STATUS_LABELS,
  confirmHandedToCarrier,
  listShippingBatches,
  receiveReturnBatchDevices,
  removeAllDevicesFromShippingBatch,
  removeDeviceFromShippingBatch,
} from "@/lib/shipping-store";
import type { BranchReturnReceiveOutcome, Profile, ShippingBatch } from "@/types/domain";

type ReturnDraft = Record<
  string,
  { outcome: BranchReturnReceiveOutcome | ""; reason: string }
>;

function BranchShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bulkReason, setBulkReason] = useState<Record<string, string>>({});
  const [returnDraft, setReturnDraft] = useState<ReturnDraft>({});
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

  const outbound = batches.filter((batch) => batch.direction === "to_service");
  const returns = batches.filter((batch) => batch.direction === "return");

  return (
    <div className="space-y-8">
      <PageHeader
        title="شحن الصيانة"
        description="بوالص الإرسال: استبعاد أو تسليم للشحن. بوالص الإرجاع: استلام سليم / تالف / لم يتم."
      />
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl">بوالص الإرسال إلى الصيانة</h2>
        {outbound.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد بوالص إرسال لفرعك. ينشئها مدير الصيانة.
          </p>
        ) : (
          outbound.map((batch) => {
            const activeItems = batch.items.filter((item) => item.status === "active");
            const removedItems = batch.items.filter((item) => item.status === "removed");
            const locked = batch.status === "handed_to_carrier" || batch.status === "received";

            return (
              <section
                key={batch.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl">
                      {batch.batchNumber} · {batch.shipmentNumber}
                    </h3>
                    <p className="text-sm text-ink-700/70">
                      {batch.carrier} · {SHIPPING_BATCH_STATUS_LABELS[batch.status]}
                    </p>
                  </div>
                  <p className="text-sm text-ink-700/60">{activeItems.length} جهاز نشط</p>
                </div>

                <div className="mt-4 space-y-3">
                  {activeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-ink-900/10 px-3 py-3"
                    >
                      <div>
                        <p className="font-medium">{item.deviceCode}</p>
                        <p className="text-xs text-ink-700/60">
                          {item.modelName || "—"}
                          {batch.status === "received"
                            ? ` · ${deviceStatusLabel("awaiting_maintenance", "branch")}`
                            : locked
                              ? ` · ${deviceStatusLabel("in_transit_to_service", "branch")}`
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
                              setMessage(`تم استبعاد ${item.deviceCode}.`);
                              refresh(user);
                            }}
                            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm"
                          >
                            استبعاد
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {removedItems.length > 0 ? (
                  <p className="mt-3 text-xs text-ink-700/60">
                    مستبعد:{" "}
                    {removedItems
                      .map((item) => `${item.deviceCode} (${item.removalReason})`)
                      .join(" · ")}
                  </p>
                ) : null}

                {!locked && activeItems.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink-900/10 pt-4">
                    <input
                      value={bulkReason[batch.id] ?? ""}
                      onChange={(e) =>
                        setBulkReason((prev) => ({ ...prev, [batch.id]: e.target.value }))
                      }
                      placeholder="سبب استبعاد كل الأجهزة"
                      className="min-w-[220px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        const result = removeAllDevicesFromShippingBatch({
                          user,
                          batchId: batch.id,
                          reason: bulkReason[batch.id] ?? "",
                        });
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        setMessage("تم استبعاد كل الأجهزة من البوليصة.");
                        refresh(user);
                      }}
                    >
                      استبعاد الكل
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        const result = confirmHandedToCarrier({ user, batchId: batch.id });
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        setMessage(
                          "تم التسليم لشركة الشحن. الحالة: جاري الشحن.",
                        );
                        refresh(user);
                      }}
                    >
                      تم التسليم لشركة الشحن
                    </button>
                  </div>
                ) : locked ? (
                  <p className="mt-4 text-sm text-ink-700/70">
                    {batch.status === "received"
                      ? "تم استلام البوليصة في مركز الصيانة."
                      : "الأجهزة جاري الشحن — لا يمكن التعديل."}
                  </p>
                ) : null}
              </section>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">بوالص الإرجاع من الصيانة</h2>
        {returns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد بوالص إرجاع لفرعك بعد.
          </p>
        ) : (
          returns.map((batch) => {
            const pendingItems = batch.items.filter(
              (item) => item.status === "active" && !item.branchReceiveOutcome,
            );
            const decidedItems = batch.items.filter((item) => item.branchReceiveOutcome);

            return (
              <section
                key={batch.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <h3 className="font-display text-xl">
                  {batch.batchNumber} · {batch.shipmentNumber}
                </h3>
                <p className="text-sm text-ink-700/70">
                  من {batch.sourceName} إلى {batch.destinationName} ·{" "}
                  {SHIPPING_BATCH_STATUS_LABELS[batch.status]}
                </p>

                <div className="mt-4 space-y-3">
                  {pendingItems.map((item) => {
                    const draft = returnDraft[item.id] ?? { outcome: "", reason: "" };
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-ink-900/10 px-3 py-3 text-sm"
                      >
                        <p className="font-medium">
                          {item.deviceCode} · {item.modelName || "—"}
                        </p>
                        <p className="text-xs text-ink-700/60">
                          {deviceStatusLabel("in_return_transit", "branch")}
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="block">
                            نتيجة الاستلام *
                            <select
                              value={draft.outcome}
                              onChange={(e) =>
                                setReturnDraft((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    outcome: e.target.value as BranchReturnReceiveOutcome | "",
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
                            >
                              <option value="">اختر</option>
                              {(Object.keys(BRANCH_RETURN_OUTCOME_LABELS) as BranchReturnReceiveOutcome[]).map(
                                (key) => (
                                  <option key={key} value={key}>
                                    {BRANCH_RETURN_OUTCOME_LABELS[key]}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          {draft.outcome === "damaged" || draft.outcome === "not_received" ? (
                            <label className="block">
                              السبب *
                              <input
                                value={draft.reason}
                                onChange={(e) =>
                                  setReturnDraft((prev) => ({
                                    ...prev,
                                    [item.id]: { ...draft, reason: e.target.value },
                                  }))
                                }
                                className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
                              />
                            </label>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {decidedItems.length > 0 ? (
                  <p className="mt-3 text-xs text-ink-700/60">
                    تم التسجيل:{" "}
                    {decidedItems
                      .map(
                        (item) =>
                          `${item.deviceCode} (${BRANCH_RETURN_OUTCOME_LABELS[item.branchReceiveOutcome!]}${
                            item.branchReceiveReason ? ` — ${item.branchReceiveReason}` : ""
                          })`,
                      )
                      .join(" · ")}
                  </p>
                ) : null}

                {pendingItems.length > 0 ? (
                  <button
                    type="button"
                    className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      const decisions = pendingItems
                        .map((item) => {
                          const draft = returnDraft[item.id];
                          if (!draft?.outcome) return null;
                          return {
                            itemId: item.id,
                            outcome: draft.outcome as BranchReturnReceiveOutcome,
                            reason: draft.reason,
                          };
                        })
                        .filter(Boolean) as Array<{
                        itemId: string;
                        outcome: BranchReturnReceiveOutcome;
                        reason?: string;
                      }>;

                      if (!decisions.length) {
                        setError("حدد نتيجة استلام لجهاز واحد على الأقل.");
                        return;
                      }

                      const result = receiveReturnBatchDevices({
                        user,
                        batchId: batch.id,
                        decisions,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage("تم تسجيل استلام الأجهزة المحددة.");
                      refresh(user);
                    }}
                  >
                    حفظ استلام الأجهزة المحددة
                  </button>
                ) : (
                  <p className="mt-4 text-sm text-aroma-700">اكتمل تسجيل استلام هذه البوليصة.</p>
                )}
              </section>
            );
          })
        )}
      </section>
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
