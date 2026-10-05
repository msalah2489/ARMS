"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { getSparePartsForModel } from "@/lib/catalog-store";
import { readSession } from "@/lib/session";
import {
  listInventoryBalances,
  listModelsWithSpareParts,
  listReceiveReceipts,
  partLabel,
  receiveSpareParts,
} from "@/lib/spare-inventory-store";
import type {
  Profile,
  SpareInventoryBalance,
  SpareReceiveReceipt,
} from "@/types/domain";

const MAX_PHOTO_BYTES = 700_000;

function SpareInventoryContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [balances, setBalances] = useState<SpareInventoryBalance[]>([]);
  const [receipts, setReceipts] = useState<SpareReceiveReceipt[]>([]);
  const [modelId, setModelId] = useState("");
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = useMemo(() => listModelsWithSpareParts(), [balances, receipts]);
  const parts = useMemo(
    () => (modelId ? getSparePartsForModel(modelId) : []),
    [modelId, balances],
  );
  const selectedPart = parts.find((item) => item.id === partId) ?? null;

  function refresh() {
    setBalances(listInventoryBalances());
    setReceipts(listReceiveReceipts());
  }

  useEffect(() => {
    setUser(readSession());
    refresh();
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="قطع الغيار والمخزون"
        description="استلام قطع الغيار بسند رسمي، ومتابعة الرصيد، وخصم المستهلك تلقائيًا عند عمليات الصيانة."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">استلام قطع غيار</h2>
        <p className="mt-1 text-sm text-ink-700/70">
          اختر الموديل ثم قطعة الغيار المسجلة له. جميع بيانات السند إلزامية.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            موديل الجهاز *
            <select
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setPartId("");
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر الموديل</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.sparePartsCount} قطعة)
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            قطعة الغيار *
            <select
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              disabled={!modelId}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 disabled:bg-sand-50"
            >
              <option value="">اختر القطعة</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {partLabel(part)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            الكمية المستلمة *
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            اللون
            <input
              value={selectedPart?.color ?? ""}
              readOnly
              placeholder="يُحدَّد من كتالوج القطعة"
              className="mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            رقم سند الاستلام *
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              placeholder="مثال: GR-2026-001"
            />
          </label>

          <label className="block text-sm">
            تاريخ السند *
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            جهة التوريد *
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              placeholder="اسم المورد أو جهة التوريد"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            صورة سند الاستلام *
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setError(null);
                if (!file) {
                  setPhotoName("");
                  setPhotoDataUrl("");
                  return;
                }
                if (file.size > MAX_PHOTO_BYTES) {
                  setError("حجم صورة السند كبير جدًا. اختر صورة أصغر من 700KB تقريبًا.");
                  setPhotoName("");
                  setPhotoDataUrl("");
                  e.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setPhotoName(file.name);
                  setPhotoDataUrl(String(reader.result ?? ""));
                };
                reader.onerror = () => {
                  setError("تعذر قراءة صورة السند.");
                  setPhotoName("");
                  setPhotoDataUrl("");
                };
                reader.readAsDataURL(file);
              }}
            />
            {photoName ? (
              <span className="mt-1 block text-xs text-ink-700/60">تم اختيار: {photoName}</span>
            ) : null}
          </label>
        </div>

        <button
          type="button"
          className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            if (!modelId) {
              setError("اختر موديل الجهاز.");
              return;
            }
            if (!partId) {
              setError("اختر قطعة الغيار.");
              return;
            }
            const result = receiveSpareParts({
              user,
              modelId,
              partId,
              quantity: Number(quantity),
              receiptNumber,
              receiptDate,
              supplier,
              receiptPhotoName: photoName,
              receiptPhotoDataUrl: photoDataUrl,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(
              `تم استلام ${result.receipt.quantity} من «${partLabel(result.receipt)}». الرصيد الحالي: ${result.balance.quantity}.`,
            );
            setPartId("");
            setQuantity("1");
            setReceiptNumber("");
            setSupplier("");
            setPhotoName("");
            setPhotoDataUrl("");
            refresh();
          }}
        >
          تسجيل الاستلام
        </button>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">رصيد المخزون ({balances.length})</h2>
        <div className="mt-4 overflow-x-auto">
          {balances.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا يوجد رصيد بعد. سجّل أول استلام أعلاه.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-right text-ink-700/60">
                  <th className="px-3 py-2 font-medium">الموديل</th>
                  <th className="px-3 py-2 font-medium">القطعة</th>
                  <th className="px-3 py-2 font-medium">اللون</th>
                  <th className="px-3 py-2 font-medium">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((row) => (
                  <tr key={row.id} className="border-b border-ink-900/5">
                    <td className="px-3 py-2">{row.modelName}</td>
                    <td className="px-3 py-2">{row.partName}</td>
                    <td className="px-3 py-2">{row.color || "—"}</td>
                    <td
                      className={`px-3 py-2 font-medium ${row.quantity <= 0 ? "text-rose-700" : ""}`}
                    >
                      {row.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">سندات الاستلام ({receipts.length})</h2>
        <div className="mt-4 space-y-3">
          {receipts.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا توجد سندات بعد.</p>
          ) : (
            receipts.slice(0, 20).map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {receipt.receiptNumber} · {partLabel(receipt)} × {receipt.quantity}
                  </p>
                  <p className="text-xs text-ink-700/60">
                    {receipt.modelName} · {receipt.supplier} · تاريخ السند {receipt.receiptDate}
                  </p>
                  <p className="text-xs text-ink-700/50">
                    بواسطة {receipt.receivedByName} · {receipt.receiptPhotoName}
                  </p>
                </div>
                {receipt.receiptPhotoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.receiptPhotoDataUrl}
                    alt={receipt.receiptPhotoName}
                    className="h-16 w-16 rounded-lg object-cover border border-ink-900/10"
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function SparePartsPage() {
  return (
    <RoleGuard allow={["system_admin", "manager", "maintenance_manager"]}>
      <SpareInventoryContent />
    </RoleGuard>
  );
}
