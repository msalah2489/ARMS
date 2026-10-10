"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { usePreferences } from "@/components/preferences-provider";
import {
  addReplacedDevice,
  adjustReplacedDeviceQuantity,
  listReplacedDevices,
  removeReplacedDevice,
} from "@/lib/replaced-devices-store";
import { readSession } from "@/lib/session";
import type { Profile, ReplacedDeviceStockItem } from "@/types/domain";

function ReplacedDevicesContent() {
  const { t } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [items, setItems] = useState<ReplacedDeviceStockItem[]>([]);
  const [deviceTypeName, setDeviceTypeName] = useState("");
  const [modelName, setModelName] = useState("");
  const [serialOrCode, setSerialOrCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setItems(listReplacedDevices());
  }

  useEffect(() => {
    setUser(readSession());
    refresh();
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("common.loading")}</p>;
  }

  const panelClass =
    "rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900";
  const inputClass =
    "mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.replacedDevices")}
        description="سجّل الأجهزة المستبدلة المحتفظ بها في المخزون وعدّل الكميات عند الحاجة."
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <section className={panelClass}>
        <h2 className="font-display text-xl">إضافة جهاز مستبدل</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            نوع الجهاز *
            <input
              value={deviceTypeName}
              onChange={(e) => setDeviceTypeName(e.target.value)}
              className={inputClass}
              placeholder="مثال: مكينة قهوة"
            />
          </label>
          <label className="block text-sm">
            الموديل
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            الرقم التسلسلي / الكود
            <input
              value={serialOrCode}
              onChange={(e) => setSerialOrCode(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            الكمية *
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            ملاحظات
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
          onClick={() => {
            setError(null);
            setMessage(null);
            const result = addReplacedDevice({
              user,
              deviceTypeName,
              modelName,
              serialOrCode,
              quantity: Number(quantity),
              notes,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage("تم إضافة الجهاز المستبدل.");
            setDeviceTypeName("");
            setModelName("");
            setSerialOrCode("");
            setQuantity("1");
            setNotes("");
            refresh();
          }}
        >
          إضافة
        </button>
      </section>

      <section className={panelClass}>
        <h2 className="font-display text-xl">المخزون ({items.length})</h2>
        <div className="arms-scroll-x mt-4">
          {items.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد عناصر بعد.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-right text-ink-700/60 dark:border-white/10 dark:text-sand-100/60">
                  <th className="px-3 py-2 font-medium">النوع</th>
                  <th className="px-3 py-2 font-medium">الموديل</th>
                  <th className="px-3 py-2 font-medium">الكود</th>
                  <th className="px-3 py-2 font-medium">الكمية</th>
                  <th className="px-3 py-2 font-medium">ملاحظات</th>
                  <th className="px-3 py-2 font-medium">تعديل</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-ink-900/5 dark:border-white/5">
                    <td className="px-3 py-2">{row.deviceTypeName}</td>
                    <td className="px-3 py-2">{row.modelName || "—"}</td>
                    <td className="px-3 py-2">{row.serialOrCode || "—"}</td>
                    <td className="px-3 py-2 font-medium">{row.quantity}</td>
                    <td className="px-3 py-2">{row.notes || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-ink-900/15 px-3 py-1 text-xs dark:border-white/15"
                          onClick={() => {
                            setError(null);
                            const result = adjustReplacedDeviceQuantity({ id: row.id, delta: 1 });
                            if (!result.ok) setError(result.error);
                            refresh();
                          }}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-ink-900/15 px-3 py-1 text-xs dark:border-white/15"
                          onClick={() => {
                            setError(null);
                            const result = adjustReplacedDeviceQuantity({ id: row.id, delta: -1 });
                            if (!result.ok) setError(result.error);
                            refresh();
                          }}
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-300/50 px-3 py-1 text-xs text-rose-700 dark:border-rose-400/40 dark:text-rose-300"
                          onClick={() => {
                            setError(null);
                            const result = removeReplacedDevice(row.id);
                            if (!result.ok) setError(result.error);
                            else setMessage("تم الحذف.");
                            refresh();
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ReplacedDevicesPage() {
  return (
    <RoleGuard
      allow={["system_admin", "manager", "maintenance_manager"]}
      permission="view_inventory"
    >
      <ReplacedDevicesContent />
    </RoleGuard>
  );
}
