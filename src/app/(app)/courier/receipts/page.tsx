"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { readSession } from "@/lib/session";
import {
  PICKUP_RECEIPT_DIRECTION_LABELS,
  PICKUP_RECEIPT_STATUS_LABELS,
  courierReviewPickupReceipt,
  listPickupReceipts,
} from "@/lib/pickup-receipt-store";
import type { PickupReceipt, Profile } from "@/types/domain";

function CourierReceiptsContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [receipts, setReceipts] = useState<PickupReceipt[]>([]);
  const [rejectDraft, setRejectDraft] = useState<
    Record<string, { selected: boolean; reason: string }>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(session?: Profile | null) {
    const current = session ?? readSession();
    if (!current) return;
    setReceipts(
      listPickupReceipts({
        courierId: current.id,
        statuses: ["pending_courier", "approved", "pending_supervisor", "received_at_center", "received_at_branch"],
      }),
    );
  }

  useEffect(() => {
    function load() {
      const session = readSession();
      setUser(session);
      refresh(session);
    }
    load();
    void hydrateOpsFromSupabase().then(() => load());
  }, []);

  const pending = useMemo(
    () => receipts.filter((r) => r.status === "pending_courier"),
    [receipts],
  );
  const others = useMemo(
    () => receipts.filter((r) => r.status !== "pending_courier"),
    [receipts],
  );

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="نماذج الاستلام"
        description="راجع نماذج الاستلام المسندة إليك: اعتمد الكل أو ارفض أجهزة محددة مع سبب اختياري."
      />
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="font-display text-2xl">بانتظار مراجعتك ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            لا توجد نماذج بانتظارك حالياً.
          </p>
        ) : (
          pending.map((receipt) => {
            const lines = receipt.lines.filter((l) => l.status !== "rejected");
            return (
              <section
                key={receipt.id}
                className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl">{receipt.receiptNumber}</h3>
                    <p className="text-sm text-ink-700/70">
                      {receipt.opsBranchName} ·{" "}
                      {PICKUP_RECEIPT_DIRECTION_LABELS[receipt.direction]} ·{" "}
                      {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
                    </p>
                    {receipt.notes ? (
                      <p className="mt-1 text-xs text-ink-700/60">ملاحظة: {receipt.notes}</p>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-700/60">{lines.length} جهاز</p>
                </div>

                <div className="mt-4 space-y-3">
                  {lines.map((line) => {
                    const draft = rejectDraft[line.id] ?? { selected: false, reason: "" };
                    return (
                      <div
                        key={line.id}
                        className="rounded-xl border border-ink-900/10 px-3 py-3 text-sm"
                      >
                        <label className="flex flex-wrap items-center gap-3">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={(e) =>
                              setRejectDraft((prev) => ({
                                ...prev,
                                [line.id]: { ...draft, selected: e.target.checked },
                              }))
                            }
                          />
                          <span className="font-medium">{line.deviceCode}</span>
                          <span className="text-ink-700/60">
                            {line.modelName || "—"} · طلب {line.requestNumber}
                          </span>
                          <span className="text-xs text-rose-700">رفض هذا الجهاز</span>
                        </label>
                        {draft.selected ? (
                          <input
                            value={draft.reason}
                            onChange={(e) =>
                              setRejectDraft((prev) => ({
                                ...prev,
                                [line.id]: { ...draft, reason: e.target.value },
                              }))
                            }
                            placeholder="سبب الرفض (اختياري)"
                            className="mt-2 w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      const result = courierReviewPickupReceipt({
                        user,
                        receiptId: receipt.id,
                        rejectLineIds: [],
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(`تم اعتماد النموذج ${receipt.receiptNumber} بالكامل.`);
                      refresh(user);
                    }}
                  >
                    اعتماد الكل
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      const rejectLineIds = lines
                        .filter((line) => rejectDraft[line.id]?.selected)
                        .map((line) => line.id);
                      if (!rejectLineIds.length) {
                        setError("حدد جهازاً واحداً على الأقل للرفض الجزئي.");
                        return;
                      }
                      const rejectReasons: Record<string, string> = {};
                      for (const id of rejectLineIds) {
                        rejectReasons[id] = rejectDraft[id]?.reason ?? "";
                      }
                      const result = courierReviewPickupReceipt({
                        user,
                        receiptId: receipt.id,
                        rejectLineIds,
                        rejectReasons,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(
                        `تم رفض ${rejectLineIds.length} جهاز جزئياً — عاد النموذج للفرع للتعديل.`,
                      );
                      setRejectDraft({});
                      refresh(user);
                    }}
                  >
                    رفض جزئي للمحددة
                  </button>
                </div>
              </section>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">سجل النماذج</h2>
        {others.length === 0 ? (
          <p className="text-sm text-ink-700/70">لا يوجد سجل بعد.</p>
        ) : (
          others.map((receipt) => (
            <div
              key={receipt.id}
              className="rounded-2xl border border-ink-900/10 bg-white px-4 py-3 text-sm shadow-panel"
            >
              <p className="font-medium">
                {receipt.receiptNumber} · {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
              </p>
              <p className="text-ink-700/60">
                {receipt.opsBranchName} · {PICKUP_RECEIPT_DIRECTION_LABELS[receipt.direction]} ·{" "}
                {receipt.lines.filter((l) => l.status === "approved").length} جهاز معتمد
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default function CourierReceiptsPage() {
  return (
    <RoleGuard allow="pickup_courier" permission="review_pickup_receipt">
      <CourierReceiptsContent />
    </RoleGuard>
  );
}
