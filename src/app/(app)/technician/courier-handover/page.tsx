"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  PICKUP_RECEIPT_STATUS_LABELS,
  listCourierHeldForHandover,
  requestCourierHandoverToMaintenance,
} from "@/lib/pickup-receipt-store";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { readSession } from "@/lib/session";
import type { PickupReceipt, Profile } from "@/types/domain";

function TechnicianCourierHandoverContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [receipts, setReceipts] = useState<PickupReceipt[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setReceipts(listCourierHeldForHandover());
  }

  useEffect(() => {
    function load() {
      setUser(readSession());
      refresh();
    }
    load();
    void hydrateOpsFromSupabase().then(() => load());
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسليم للصيانة — أجهزة المندوب"
        description="الأجهزة المعتمدة لدى مندوب الاستلام. اطلب تسليمها للصيانة ليوافق المشرف أو مدير الصيانة."
      />
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {receipts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
          لا توجد أجهزة لدى المندوب بانتظار التسليم للصيانة.
        </p>
      ) : (
        receipts.map((receipt) => {
          const lines = receipt.lines.filter((l) => l.status === "approved");
          return (
            <section
              key={receipt.id}
              className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
            >
              <h3 className="font-display text-xl">{receipt.receiptNumber}</h3>
              <p className="text-sm text-ink-700/70">
                {receipt.opsBranchName} · المندوب: {receipt.assignedCourierName} ·{" "}
                {PICKUP_RECEIPT_STATUS_LABELS[receipt.status]}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {lines.map((line) => (
                  <li key={line.id}>
                    {line.deviceCode} · {line.modelName || "—"} · طلب {line.requestNumber}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  const result = requestCourierHandoverToMaintenance({
                    user,
                    receiptId: receipt.id,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage(
                    `تم طلب التسليم للصيانة للنموذج ${receipt.receiptNumber}. بانتظار اعتماد المشرف.`,
                  );
                  refresh();
                }}
              >
                تسليم للصيانة
              </button>
            </section>
          );
        })
      )}
    </div>
  );
}

export default function TechnicianCourierHandoverPage() {
  return (
    <RoleGuard allow="technician" permission="request_courier_handover">
      <TechnicianCourierHandoverContent />
    </RoleGuard>
  );
}
