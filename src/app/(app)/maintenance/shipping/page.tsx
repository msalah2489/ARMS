"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { readSession } from "@/lib/session";
import {
  SHIPPING_BATCH_STATUS_LABELS,
  createShippingBatch,
  listDevicesEligibleForShipment,
  listOpsBranches,
  listShippingBatches,
} from "@/lib/shipping-store";
import type { Profile, ShippingBatch } from "@/types/domain";

function MaintenanceShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [branchId, setBranchId] = useState("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
  const [shipmentNumber, setShipmentNumber] = useState("");
  const [carrier, setCarrier] = useState("SMSA");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = useMemo(() => listOpsBranches(), []);
  const eligible = useMemo(() => listDevicesEligibleForShipment(branchId), [branchId, batches]);

  function refresh() {
    setBatches(listShippingBatches());
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    refresh();
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const branchName = branches.find((item) => item.id === branchId)?.name ?? "فرع";

  return (
    <div className="space-y-6">
      <PageHeader
        title="بوالص الشحن — مدير الصيانة"
        description="إنشاء بوالص إرسال لأجهزة الفروع. الفرع لا ينشئ البوليصة؛ يؤكد التسليم للشحن فقط."
      />

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">إنشاء بوليصة إرسال للصيانة</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            الفرع
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelected([]);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            رقم البوليصة (شركة الشحن) *
            <input
              value={shipmentNumber}
              onChange={(e) => setShipmentNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              placeholder="WB-123456"
            />
          </label>
          <label className="block text-sm">
            شركة الشحن *
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            ملاحظات
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
        </div>

        <h3 className="mt-6 text-sm font-medium">أجهزة متاحة في {branchName}</h3>
        <div className="mt-2 space-y-2">
          {eligible.length === 0 ? (
            <p className="text-sm text-ink-700/60">
              لا توجد أجهزة متاحة. أنشئ طلبًا من حساب الفرع أولًا، أو استبعد أجهزة من بوليصة سابقة.
            </p>
          ) : (
            eligible.map(({ request, device }) => (
              <label
                key={device.localId}
                className="flex items-start gap-3 rounded-xl border border-ink-900/10 px-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(device.localId)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, device.localId]
                        : prev.filter((id) => id !== device.localId),
                    )
                  }
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{device.deviceCode}</span> · {device.modelName} ·{" "}
                  {request.requestNumber} · {request.contactName}
                  <span className="block text-xs text-ink-700/60">
                    {request.priority === "urgent" ? "عاجل" : "عادي"} · سند {device.receiptNumber}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-aroma-700">{message}</p> : null}

        <button
          type="button"
          className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            const result = createShippingBatch({
              user,
              shipmentNumber,
              carrier,
              opsBranchId: branchId,
              sourceName: branchName,
              deviceLocalIds: selected,
              notes,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(`تم إنشاء البوليصة ${result.batch.batchNumber} بنجاح.`);
            setShipmentNumber("");
            setSelected([]);
            refresh();
          }}
        >
          إنشاء البوليصة
        </button>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">البوالص الحالية</h2>
        <div className="mt-4 space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا توجد بوالص بعد.</p>
          ) : (
            batches.map((batch) => (
              <div key={batch.id} className="rounded-xl border border-ink-900/10 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {batch.batchNumber} · بوليصة {batch.shipmentNumber} · {batch.carrier}
                  </p>
                  <span className="text-xs text-ink-700/60">
                    {SHIPPING_BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                  </span>
                </div>
                <p className="mt-1 text-ink-700/70">
                  من {batch.sourceName} إلى {batch.destinationName} ·{" "}
                  {batch.items.filter((item) => item.status === "active").length} جهاز نشط
                </p>
                <p className="mt-1 text-xs text-ink-700/50">
                  أنشأها {batch.createdByName} ·{" "}
                  {batch.items
                    .filter((item) => item.status === "active")
                    .map((item) => item.deviceCode)
                    .join("، ") || "—"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function MaintenanceShippingPage() {
  return (
    <RoleGuard allow={["maintenance_manager", "system_admin", "manager"]}>
      <MaintenanceShippingContent />
    </RoleGuard>
  );
}
