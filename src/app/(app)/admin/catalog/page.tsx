"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import {
  addBrand,
  addDeviceType,
  addModel,
  addModelAccessory,
  addModelSparePart,
  deleteBrand,
  deleteDeviceType,
  deleteModel,
  deleteModelAccessory,
  deleteModelSparePart,
  getCatalog,
  resetCatalogToSeed,
  type DeviceCatalogState,
} from "@/lib/catalog-store";

type Tab = "types" | "brands" | "models";

function CatalogAdminContent() {
  const [tab, setTab] = useState<Tab>("types");
  const [catalog, setCatalog] = useState<DeviceCatalogState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [typeName, setTypeName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelTypeId, setModelTypeId] = useState("");
  const [modelBrandId, setModelBrandId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [accessoryName, setAccessoryName] = useState("");
  const [spareName, setSpareName] = useState("");

  function refresh() {
    setCatalog(getCatalog());
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedModel = useMemo(
    () => catalog?.models.find((model) => model.id === selectedModelId) ?? null,
    [catalog, selectedModelId],
  );

  if (!catalog) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  function run(action: () => { ok: true } | { ok: false; error: string }, success: string) {
    setError(null);
    setMessage(null);
    const result = action();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(success);
    refresh();
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "types", label: "تصنيفات الأجهزة" },
    { id: "brands", label: "البراندات" },
    { id: "models", label: "الموديلات والملحقات وقطع الغيار" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="كتالوج الأجهزة"
        description="إدارة تصنيفات الأجهزة والبراندات والموديلات والملحقات وقطع الغيار — لمدير النظام."
        action={
          <button
            type="button"
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm"
            onClick={() => {
              resetCatalogToSeed();
              setSelectedModelId("");
              setMessage("تمت إعادة الكتالوج إلى القيم الافتراضية.");
              setError(null);
              refresh();
            }}
          >
            إعادة الافتراضي
          </button>
        }
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm ${
              tab === item.id ? "bg-ink-900 text-white" : "border border-ink-900/15 bg-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "types" ? (
        <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <h2 className="font-display text-xl">تصنيفات الأجهزة</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="مثال: جهاز تعطير"
              className="min-w-[220px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
              onClick={() => {
                run(() => addDeviceType(typeName), "تمت إضافة التصنيف.");
                setTypeName("");
              }}
            >
              إضافة تصنيف
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {catalog.deviceTypes.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  className="text-rose-700"
                  onClick={() => run(() => deleteDeviceType(item.id), "تم حذف التصنيف.")}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "brands" ? (
        <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <h2 className="font-display text-xl">البراندات</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="مثال: AromaTech"
              className="min-w-[220px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
              onClick={() => {
                run(() => addBrand(brandName), "تمت إضافة البراند.");
                setBrandName("");
              }}
            >
              إضافة براند
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {catalog.brands.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  className="text-rose-700"
                  onClick={() => run(() => deleteBrand(item.id), "تم حذف البراند.")}
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "models" ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <h2 className="font-display text-xl">إضافة موديل</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={modelTypeId}
                onChange={(e) => setModelTypeId(e.target.value)}
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
              >
                <option value="">التصنيف *</option>
                {catalog.deviceTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={modelBrandId}
                onChange={(e) => setModelBrandId(e.target.value)}
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
              >
                <option value="">البراند *</option>
                {catalog.brands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="اسم الموديل *"
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
              onClick={() => {
                run(
                  () =>
                    addModel({
                      name: modelName,
                      deviceTypeId: modelTypeId,
                      brandId: modelBrandId,
                    }),
                  "تمت إضافة الموديل.",
                );
                setModelName("");
              }}
            >
              إضافة موديل
            </button>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <h2 className="font-display text-xl">الموديلات</h2>
            <div className="mt-4 space-y-2">
              {catalog.models.map((model) => {
                const typeName =
                  catalog.deviceTypes.find((item) => item.id === model.deviceTypeId)?.name ?? "—";
                const brandNameLabel =
                  catalog.brands.find((item) => item.id === model.brandId)?.name ?? "—";
                return (
                  <div
                    key={model.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm ${
                      selectedModelId === model.id
                        ? "border-aroma-500 bg-aroma-50/40"
                        : "border-ink-900/10"
                    }`}
                  >
                    <button
                      type="button"
                      className="text-right"
                      onClick={() => setSelectedModelId(model.id)}
                    >
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs text-ink-700/60">
                        {typeName} · {brandNameLabel} · {model.accessories.length} ملحق ·{" "}
                        {model.spareParts.length} قطعة غيار
                      </p>
                    </button>
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() => {
                        run(() => deleteModel(model.id), "تم حذف الموديل.");
                        if (selectedModelId === model.id) setSelectedModelId("");
                      }}
                    >
                      حذف
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {selectedModel ? (
            <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
              <h2 className="font-display text-xl">تفاصيل: {selectedModel.name}</h2>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">الملحقات الخاصة بالموديل</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={accessoryName}
                      onChange={(e) => setAccessoryName(e.target.value)}
                      placeholder="اسم الملحق"
                      className="min-w-[160px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        run(
                          () => addModelAccessory(selectedModel.id, accessoryName),
                          "تمت إضافة الملحق.",
                        );
                        setAccessoryName("");
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {selectedModel.accessories.length === 0 ? (
                      <li className="text-xs text-ink-700/60">لا توجد ملحقات بعد.</li>
                    ) : (
                      selectedModel.accessories.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
                        >
                          <span>{item.name}</span>
                          <button
                            type="button"
                            className="text-rose-700"
                            onClick={() =>
                              run(
                                () => deleteModelAccessory(selectedModel.id, item.id),
                                "تم حذف الملحق.",
                              )
                            }
                          >
                            حذف
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium">قطع الغيار الخاصة بالموديل</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={spareName}
                      onChange={(e) => setSpareName(e.target.value)}
                      placeholder="اسم قطعة الغيار"
                      className="min-w-[160px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        run(
                          () => addModelSparePart(selectedModel.id, spareName),
                          "تمت إضافة قطعة الغيار.",
                        );
                        setSpareName("");
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {selectedModel.spareParts.length === 0 ? (
                      <li className="text-xs text-ink-700/60">لا توجد قطع غيار بعد.</li>
                    ) : (
                      selectedModel.spareParts.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
                        >
                          <span>{item.name}</span>
                          <button
                            type="button"
                            className="text-rose-700"
                            onClick={() =>
                              run(
                                () => deleteModelSparePart(selectedModel.id, item.id),
                                "تم حذف قطعة الغيار.",
                              )
                            }
                          >
                            حذف
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-sm text-ink-700/60">اختر موديلًا لإدارة ملحقاته وقطع غياره.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminCatalogPage() {
  return (
    <RoleGuard allow={["system_admin", "manager"]}>
      <CatalogAdminContent />
    </RoleGuard>
  );
}
