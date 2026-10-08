"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { deviceStatusLabel } from "@/lib/branch-store";
import {
  PICKUP_RECEIPT_STATUS_LABELS,
  cancelPickupReceipt,
  confirmPickupReturnAtBranch,
  createPickupReceipt,
  listApprovedReturnReceiptsForBranch,
  listDevicesEligibleForPickupOutbound,
  listPickupCouriers,
  listPickupReceipts,
  resubmitPickupReceipt,
} from "@/lib/pickup-receipt-store";
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
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type {
  BranchReturnReceiveOutcome,
  PickupReceipt,
  Profile,
  ShippingBatch,
} from "@/types/domain";

type ReturnDraft = Record<
  string,
  { outcome: BranchReturnReceiveOutcome | ""; reason: string }
>;

function BranchShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [receipts, setReceipts] = useState<PickupReceipt[]>([]);
  const [returnReceipts, setReturnReceipts] = useState<PickupReceipt[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bulkReason, setBulkReason] = useState<Record<string, string>>({});
  const [returnDraft, setReturnDraft] = useState<ReturnDraft>({});
  const [courierId, setCourierId] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [editSelected, setEditSelected] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const couriers = useMemo(() => listPickupCouriers(), [receipts]);
  const eligible = useMemo(() => {
    if (!user?.opsBranchId) return [];
    return listDevicesEligibleForPickupOutbound(user.opsBranchId);
  }, [user?.opsBranchId, receipts, batches]);

  function refresh(session?: Profile | null) {
    const current = session ?? readSession();
    setBatches(listShippingBatches(current?.opsBranchId));
    if (current?.opsBranchId) {
      setReceipts(
        listPickupReceipts({
          opsBranchId: current.opsBranchId,
          direction: "branch_to_center",
        }),
      );
      setReturnReceipts(listApprovedReturnReceiptsForBranch(current.opsBranchId));
    } else {
      setReceipts([]);
      setReturnReceipts([]);
    }
  }

  useEffect(() => {
    function load() {
      const session = readSession();
      setUser(session);
      refresh(session);
      const first = listPickupCouriers()[0];
      setCourierId((c) => c || first?.id || "");
    }
    load();
    void hydrateOpsFromSupabase().then(() => load());
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const outbound = batches.filter((batch) => batch.direction === "to_service");
  const returns = batches.filter((batch) => batch.direction === "return");
  const rejectedReceipts = receipts.filter((r) => r.status === "partially_rejected");
  const pendingReceipts = receipts.filter((r) => r.status === "pending_courier");
  const otherReceipts = receipts.filter(
    (r) => r.status !== "partially_rejected" && r.status !== "pending_courier",
  );
  const courier = couriers.find((c) => c.id === courierId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="شحن الصيانة"
        description="بدون بوليصة شحن: أرسل الأجهزة عبر مندوب الاستلام. إن وُجدت بوليصة فعّالة يبقى مسار شركة الشحن كما هو."
      />
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl">نموذج استلام لمندوب الاستلام</h2>
        <p className="text-sm text-ink-700/70">
          للأجهزة غير المدرجة في بوليصة شحن نشطة — هذا المسار الوحيد للإرسال عبر المندوب.
        </p>

        <div className="grid gap-3 rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel md:grid-cols-2">
          <label className="block text-sm">
            مندوب الاستلام
            <select
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              {couriers.length === 0 ? (
                <option value="">لا يوجد مندوبون — أنشئ حساباً بدور مندوب الاستلام</option>
              ) : (
                couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm">
            ملاحظات
            <input
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-2">
          {eligible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-6 text-sm text-ink-700/70">
              لا توجد أجهزة متاحة للإرسال عبر المندوب (قد تكون على بوليصة أو نموذج آخر).
            </p>
          ) : (
            eligible.map(({ device, request }) => {
              const checked = selectedDevices.includes(device.localId);
              return (
                <label
                  key={device.localId}
                  className="flex items-center gap-3 rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSelectedDevices((prev) =>
                        e.target.checked
                          ? [...prev, device.localId]
                          : prev.filter((id) => id !== device.localId),
                      )
                    }
                  />
                  <span>
                    {device.deviceCode} · {device.modelName || "—"} · طلب {request.requestNumber} ·{" "}
                    {deviceStatusLabel(device.lifecycleStatus, "branch")}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <button
          type="button"
          className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            if (!user.opsBranchId) {
              setError("حساب الفرع بدون فرع مرتبط.");
              return;
            }
            if (!courier) {
              setError("اختر مندوب الاستلام.");
              return;
            }
            const result = createPickupReceipt({
              user,
              direction: "branch_to_center",
              opsBranchId: user.opsBranchId,
              opsBranchName: user.opsBranchName ?? "فرع",
              assignedCourierId: courier.id,
              assignedCourierName: courier.fullName,
              deviceLocalIds: selectedDevices,
              notes: receiptNotes,
              submit: true,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(`تم إنشاء النموذج ${result.receipt.receiptNumber} وإرساله للمندوب.`);
            setSelectedDevices([]);
            setReceiptNotes("");
            refresh(user);
          }}
        >
          إرسال نموذج الاستلام للمندوب
        </button>
      </section>

      {rejectedReceipts.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">نماذج مرفوضة جزئياً — عدّل وأعد الإرسال</h2>
          {rejectedReceipts.map((receipt) => {
            const rejected = receipt.lines.filter((l) => l.status === "rejected");
            const kept = receipt.lines.filter((l) => l.status !== "rejected");
            const currentSelected =
              editSelected[receipt.id] ?? kept.map((l) => l.deviceLocalId);
            const extraEligible = eligible.filter(
              (row) => !currentSelected.includes(row.device.localId),
            );
            return (
              <section
                key={receipt.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-panel"
              >
                <h3 className="font-display text-xl">{receipt.receiptNumber}</h3>
                <p className="text-sm text-ink-700/70">
                  المندوب: {receipt.assignedCourierName} ·{" "}
                  {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="font-medium text-rose-700">مرفوض:</p>
                  {rejected.map((line) => (
                    <p key={line.id} className="text-rose-700">
                      {line.deviceCode}
                      {line.rejectReason ? ` — ${line.rejectReason}` : ""}
                    </p>
                  ))}
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="font-medium">أجهزة للإعادة:</p>
                  {[...kept.map((l) => ({ localId: l.deviceLocalId, label: `${l.deviceCode} · ${l.modelName}` })),
                    ...extraEligible.map(({ device }) => ({
                      localId: device.localId,
                      label: `${device.deviceCode} · ${device.modelName}`,
                    }))].map((item) => (
                    <label key={item.localId} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={currentSelected.includes(item.localId)}
                        onChange={(e) =>
                          setEditSelected((prev) => {
                            const base = prev[receipt.id] ?? kept.map((l) => l.deviceLocalId);
                            return {
                              ...prev,
                              [receipt.id]: e.target.checked
                                ? [...base, item.localId]
                                : base.filter((id) => id !== item.localId),
                            };
                          })
                        }
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      if (!courier) {
                        setError("اختر مندوب الاستلام أعلاه.");
                        return;
                      }
                      const result = resubmitPickupReceipt({
                        user,
                        receiptId: receipt.id,
                        assignedCourierId: courier.id,
                        assignedCourierName: courier.fullName,
                        deviceLocalIds: currentSelected,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(`أُعيد إرسال النموذج ${receipt.receiptNumber} للمندوب.`);
                      refresh(user);
                    }}
                  >
                    إعادة الإرسال للمندوب
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-ink-900/15 px-4 py-2 text-sm"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      const result = cancelPickupReceipt({ user, receiptId: receipt.id });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage("تم إلغاء النموذج.");
                      refresh(user);
                    }}
                  >
                    إلغاء النموذج
                  </button>
                </div>
              </section>
            );
          })}
        </section>
      ) : null}

      {(pendingReceipts.length > 0 || otherReceipts.length > 0) && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">نماذج الاستلام</h2>
          {[...pendingReceipts, ...otherReceipts].map((receipt) => (
            <div
              key={receipt.id}
              className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {receipt.receiptNumber} · {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
              </p>
              <p className="text-ink-700/60">
                المندوب: {receipt.assignedCourierName} ·{" "}
                {receipt.lines.filter((l) => l.status !== "rejected").length} جهاز
              </p>
            </div>
          ))}
        </section>
      )}

      {returnReceipts.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">مرتجع عبر المندوب — تأكيد الاستلام</h2>
          {returnReceipts.map((receipt) => {
            const lines = receipt.lines.filter((l) => l.status === "approved");
            return (
              <section
                key={receipt.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <h3 className="font-display text-xl">{receipt.receiptNumber}</h3>
                <p className="text-sm text-ink-700/70">
                  المندوب: {receipt.assignedCourierName} ·{" "}
                  {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {lines.map((line) => (
                    <li key={line.id}>
                      {line.deviceCode} · {line.modelName || "—"}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    const result = confirmPickupReturnAtBranch({
                      user,
                      receiptId: receipt.id,
                    });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setMessage(`تم تأكيد استلام المرتجع ${receipt.receiptNumber}.`);
                    refresh(user);
                  }}
                >
                  تأكيد استلام الأجهزة في الفرع
                </button>
              </section>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl">بوالص الإرسال إلى الصيانة</h2>
        {outbound.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد بوالص إرسال لفرعك. ينشئها مدير الصيانة — أو استخدم نموذج المندوب أعلاه.
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
                        setMessage("تم التسليم لشركة الشحن. الحالة: جاري الشحن.");
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
                              {(
                                Object.keys(BRANCH_RETURN_OUTCOME_LABELS) as BranchReturnReceiveOutcome[]
                              ).map((key) => (
                                <option key={key} value={key}>
                                  {BRANCH_RETURN_OUTCOME_LABELS[key]}
                                </option>
                              ))}
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
    <RoleGuard allow="branch" permission={["branch_shipping", "create_pickup_receipt"]}>
      <BranchShippingContent />
    </RoleGuard>
  );
}
