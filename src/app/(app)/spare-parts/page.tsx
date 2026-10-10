"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClickableImage } from "@/components/clickable-image";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { getSparePartsForModel } from "@/lib/catalog-store";
import { readSession } from "@/lib/session";
import {
  listInventoryBalances,
  listModelsWithSpareParts,
  listReceiveReceipts,
  partLabel,
  receiptTotalQty,
  receiveSpareParts,
  updateBalanceMinimumQuantity,
} from "@/lib/spare-inventory-store";
import type {
  Profile,
  SpareInventoryBalance,
  SpareReceiveReceipt,
} from "@/types/domain";

const MAX_PHOTO_BYTES = 700_000;

function partImageFor(modelId: string, partId: string) {
  return getSparePartsForModel(modelId).find((part) => part.id === partId)?.imageDataUrl;
}

type LineDraft = {
  id: string;
  modelId: string;
  partId: string;
  quantity: string;
};

function emptyLine(): LineDraft {
  return {
    id: crypto.randomUUID(),
    modelId: "",
    partId: "",
    quantity: "1",
  };
}

function SpareInventoryContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [balances, setBalances] = useState<SpareInventoryBalance[]>([]);
  const [receipts, setReceipts] = useState<SpareReceiveReceipt[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = useMemo(() => listModelsWithSpareParts(), [balances, receipts]);

  function refresh() {
    setBalances(listInventoryBalances());
    setReceipts(listReceiveReceipts());
  }

  useEffect(() => {
    setUser(readSession());
    refresh();
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>;

  const panelClass =
    "rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900";
  const inputClass =
    "mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50";

  return (
    <div className="space-y-6">
      <PageHeader
        title="قطع الغيار والمخزون"
        description="سجّل بيانات السند أولًا، ثم أضف صفًا أو أكثر لقطع الغيار بكميات مختلفة."
        action={
          <>
            <Link
              href="/service-requests/new"
              className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
            >
              طلب جديد
            </Link>
            <Link
              href="/maintenance/shipping"
              className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
            >
              بوليصة شحن
            </Link>
          </>
        }
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <section className={panelClass}>
        <h2 className="font-display text-xl">1) بيانات سند الاستلام</h2>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
          رقم السند والتاريخ وجهة التوريد وصورة السند إلزامية قبل تسجيل القطع.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            رقم سند الاستلام *
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className={inputClass}
              placeholder="مثال: GR-2026-001"
            />
          </label>
          <label className="block text-sm">
            تاريخ السند *
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            جهة التوريد *
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className={inputClass}
              placeholder="اسم المورد أو جهة التوريد"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            صورة سند الاستلام *
            <input
              type="file"
              accept="image/*"
              className={inputClass}
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
              <span className="mt-1 block text-xs text-ink-700/60 dark:text-sand-100/60">
                تم اختيار: {photoName}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">2) قطع الغيار المستلمة</h2>
            <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
              كل صف = موديل + اسم القطعة + الكمية. يمكن إضافة عدة أنواع في نفس السند.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm dark:border-white/15"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + إضافة صف
          </button>
        </div>

        <div className="arms-scroll-x mt-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink-900/10 text-right text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">الموديل *</th>
                <th className="px-2 py-2 font-medium">قطعة الغيار *</th>
                <th className="px-2 py-2 font-medium">الكمية *</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const parts = line.modelId ? getSparePartsForModel(line.modelId) : [];
                return (
                  <tr key={line.id} className="border-b border-ink-900/5 dark:border-white/5">
                    <td className="px-2 py-2 align-middle text-ink-700/60">{index + 1}</td>
                    <td className="px-2 py-2 align-middle min-w-[10rem]">
                      <select
                        value={line.modelId}
                        onChange={(e) => {
                          const modelId = e.target.value;
                          setLines((prev) =>
                            prev.map((item) =>
                              item.id === line.id
                                ? { ...item, modelId, partId: "" }
                                : item,
                            ),
                          );
                        }}
                        className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                      >
                        <option value="">اختر الموديل</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle min-w-[12rem]">
                      <select
                        value={line.partId}
                        disabled={!line.modelId}
                        onChange={(e) => {
                          const partId = e.target.value;
                          setLines((prev) =>
                            prev.map((item) =>
                              item.id === line.id ? { ...item, partId } : item,
                            ),
                          );
                        }}
                        className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 disabled:bg-sand-50 dark:border-white/15 dark:bg-ink-950 dark:disabled:bg-ink-800"
                      >
                        <option value="">اختر القطعة</option>
                        {parts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {partLabel(part)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 align-middle w-28">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) => {
                          const quantity = e.target.value;
                          setLines((prev) =>
                            prev.map((item) =>
                              item.id === line.id ? { ...item, quantity } : item,
                            ),
                          );
                        }}
                        className="w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <button
                        type="button"
                        className="text-rose-700 disabled:opacity-40 dark:text-rose-300"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((prev) => prev.filter((item) => item.id !== line.id))
                        }
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
          onClick={() => {
            setError(null);
            setMessage(null);
            const result = receiveSpareParts({
              user,
              receiptNumber,
              receiptDate,
              supplier,
              receiptPhotoName: photoName,
              receiptPhotoDataUrl: photoDataUrl,
              lines: lines.map((line) => ({
                modelId: line.modelId,
                partId: line.partId,
                quantity: Number(line.quantity),
              })),
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const total = receiptTotalQty(result.receipt);
            setMessage(
              `تم تسجيل السند ${result.receipt.receiptNumber} بعدد ${result.receipt.lines.length} نوعًا بإجمالي كمية ${total}.`,
            );
            setReceiptNumber("");
            setSupplier("");
            setPhotoName("");
            setPhotoDataUrl("");
            setLines([emptyLine()]);
            refresh();
          }}
        >
          تسجيل استلام السند
        </button>
      </section>

      <section className={panelClass}>
        <h2 className="font-display text-xl">رصيد المخزون ({balances.length})</h2>
        <div className="arms-scroll-x mt-4">
          {balances.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">
              لا يوجد رصيد بعد. سجّل أول استلام أعلاه.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-right text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
                  <th className="px-3 py-2 font-medium">الصورة</th>
                  <th className="px-3 py-2 font-medium">الموديل</th>
                  <th className="px-3 py-2 font-medium">القطعة</th>
                  <th className="px-3 py-2 font-medium">اللون</th>
                  <th className="px-3 py-2 font-medium">الكمية</th>
                  <th className="px-3 py-2 font-medium">الحد الأدنى</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((row) => {
                  const image = partImageFor(row.modelId, row.partId);
                  const isLow = row.quantity <= (row.minimumQuantity ?? 2);
                  return (
                    <tr key={row.id} className="border-b border-ink-900/5 dark:border-white/5">
                      <td className="px-3 py-2">
                        {image ? (
                          <ClickableImage src={image} alt={row.partName} size="sm" />
                        ) : (
                          <span className="text-xs text-ink-700/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.modelName}</td>
                      <td className="px-3 py-2">{row.partName}</td>
                      <td className="px-3 py-2">{row.color || "—"}</td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          isLow ? "text-rose-700 dark:text-rose-300" : ""
                        }`}
                      >
                        {row.quantity}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={row.minimumQuantity ?? 2}
                          className="w-20 rounded-xl border border-ink-900/15 bg-white px-2 py-1 dark:border-white/15 dark:bg-ink-950"
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next) || next === row.minimumQuantity) return;
                            const result = updateBalanceMinimumQuantity(row.id, next);
                            if (!result.ok) {
                              setError(result.error);
                              e.target.value = String(row.minimumQuantity ?? 2);
                              return;
                            }
                            setError(null);
                            setMessage(`تم تحديث الحد الأدنى لـ «${row.partName}».`);
                            refresh();
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={panelClass}>
        <h2 className="font-display text-xl">سندات الاستلام ({receipts.length})</h2>
        <div className="mt-4 space-y-3">
          {receipts.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد سندات بعد.</p>
          ) : (
            receipts.slice(0, 20).map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {receipt.receiptNumber} · {receipt.lines.length} نوع · إجمالي{" "}
                    {receiptTotalQty(receipt)}
                  </p>
                  <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                    {receipt.supplier} · تاريخ السند {receipt.receiptDate}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-ink-700/70 dark:text-sand-100/70">
                    {receipt.lines.map((line) => (
                      <li key={`${line.modelId}-${line.partId}`}>
                        {line.modelName} · {partLabel(line)} × {line.quantity}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-ink-700/50 dark:text-sand-100/50">
                    بواسطة {receipt.receivedByName} · {receipt.receiptPhotoName}
                  </p>
                </div>
                {receipt.receiptPhotoDataUrl ? (
                  <ClickableImage
                    src={receipt.receiptPhotoDataUrl}
                    alt={receipt.receiptPhotoName}
                    size="md"
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
    <RoleGuard
      allow={["system_admin", "manager", "maintenance_manager"]}
      permission="view_inventory"
    >
      <SpareInventoryContent />
    </RoleGuard>
  );
}
