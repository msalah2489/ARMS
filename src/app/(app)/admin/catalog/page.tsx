"use client";

import { useEffect, useMemo, useState } from "react";
import { CatalogSuggestInput } from "@/components/catalog-suggest-input";
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
  suggestAccessoryNames,
  suggestSparePartNames,
  updateBrand,
  updateDeviceType,
  updateModel,
  updateModelAccessory,
  updateModelSparePart,
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
  const [spareColor, setSpareColor] = useState("");

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingBrandName, setEditingBrandName] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editModelTypeId, setEditModelTypeId] = useState("");
  const [editModelBrandId, setEditModelBrandId] = useState("");
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [editingAccessoryName, setEditingAccessoryName] = useState("");
  const [editingSpareId, setEditingSpareId] = useState<string | null>(null);
  const [editingSpareName, setEditingSpareName] = useState("");
  const [editingSpareColor, setEditingSpareColor] = useState("");

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

  const accessorySuggestions = useMemo(
    () =>
      suggestAccessoryNames(accessoryName, {
        excludeModelId: selectedModelId || undefined,
      }),
    [accessoryName, selectedModelId, catalog],
  );

  const editingAccessorySuggestions = useMemo(
    () =>
      suggestAccessoryNames(editingAccessoryName, {
        excludeModelId: selectedModelId || undefined,
      }),
    [editingAccessoryName, selectedModelId, catalog],
  );

  const spareSuggestions = useMemo(
    () =>
      suggestSparePartNames(spareName || spareColor, {
        excludeModelId: selectedModelId || undefined,
      }),
    [spareName, spareColor, selectedModelId, catalog],
  );

  const editingSpareSuggestions = useMemo(
    () =>
      suggestSparePartNames(editingSpareName || editingSpareColor, {
        excludeModelId: selectedModelId || undefined,
      }),
    [editingSpareName, editingSpareColor, selectedModelId, catalog],
  );

  if (!catalog) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  function run(action: () => { ok: true } | { ok: false; error: string }, success: string) {
    setError(null);
    setMessage(null);
    const result = action();
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setMessage(success);
    refresh();
    return true;
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
        description="إضافة وتعديل وحذف التصنيفات والبراندات والموديلات والملحقات وقطع الغيار."
        action={
          <button
            type="button"
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm"
            onClick={() => {
              resetCatalogToSeed();
              setSelectedModelId("");
              setEditingTypeId(null);
              setEditingBrandId(null);
              setEditingModelId(null);
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
                if (run(() => addDeviceType(typeName), "تمت إضافة التصنيف.")) setTypeName("");
              }}
            >
              إضافة تصنيف
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {catalog.deviceTypes.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
              >
                {editingTypeId === item.id ? (
                  <>
                    <input
                      value={editingTypeName}
                      onChange={(e) => setEditingTypeName(e.target.value)}
                      className="min-w-[180px] flex-1 rounded-xl border border-ink-900/15 px-3 py-1.5"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-aroma-700"
                        onClick={() => {
                          if (run(() => updateDeviceType(item.id, editingTypeName), "تم تعديل التصنيف.")) {
                            setEditingTypeId(null);
                          }
                        }}
                      >
                        حفظ
                      </button>
                      <button type="button" className="text-ink-700/60" onClick={() => setEditingTypeId(null)}>
                        إلغاء
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{item.name}</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-ink-900"
                        onClick={() => {
                          setEditingTypeId(item.id);
                          setEditingTypeName(item.name);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="text-rose-700"
                        onClick={() => run(() => deleteDeviceType(item.id), "تم حذف التصنيف.")}
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
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
                if (run(() => addBrand(brandName), "تمت إضافة البراند.")) setBrandName("");
              }}
            >
              إضافة براند
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {catalog.brands.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
              >
                {editingBrandId === item.id ? (
                  <>
                    <input
                      value={editingBrandName}
                      onChange={(e) => setEditingBrandName(e.target.value)}
                      className="min-w-[180px] flex-1 rounded-xl border border-ink-900/15 px-3 py-1.5"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-aroma-700"
                        onClick={() => {
                          if (run(() => updateBrand(item.id, editingBrandName), "تم تعديل البراند.")) {
                            setEditingBrandId(null);
                          }
                        }}
                      >
                        حفظ
                      </button>
                      <button type="button" className="text-ink-700/60" onClick={() => setEditingBrandId(null)}>
                        إلغاء
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{item.name}</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-ink-900"
                        onClick={() => {
                          setEditingBrandId(item.id);
                          setEditingBrandName(item.name);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="text-rose-700"
                        onClick={() => run(() => deleteBrand(item.id), "تم حذف البراند.")}
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
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
                if (
                  run(
                    () =>
                      addModel({
                        name: modelName,
                        deviceTypeId: modelTypeId,
                        brandId: modelBrandId,
                      }),
                    "تمت إضافة الموديل.",
                  )
                ) {
                  setModelName("");
                }
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
                const brandLabel =
                  catalog.brands.find((item) => item.id === model.brandId)?.name ?? "—";
                const isEditing = editingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      selectedModelId === model.id
                        ? "border-aroma-500 bg-aroma-50/40"
                        : "border-ink-900/10"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <select
                            value={editModelTypeId}
                            onChange={(e) => setEditModelTypeId(e.target.value)}
                            className="rounded-xl border border-ink-900/15 px-3 py-2"
                          >
                            {catalog.deviceTypes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editModelBrandId}
                            onChange={(e) => setEditModelBrandId(e.target.value)}
                            className="rounded-xl border border-ink-900/15 px-3 py-2"
                          >
                            {catalog.brands.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={editModelName}
                            onChange={(e) => setEditModelName(e.target.value)}
                            className="rounded-xl border border-ink-900/15 px-3 py-2"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="text-aroma-700"
                            onClick={() => {
                              if (
                                run(
                                  () =>
                                    updateModel({
                                      id: model.id,
                                      name: editModelName,
                                      deviceTypeId: editModelTypeId,
                                      brandId: editModelBrandId,
                                    }),
                                  "تم تعديل الموديل.",
                                )
                              ) {
                                setEditingModelId(null);
                              }
                            }}
                          >
                            حفظ التعديل
                          </button>
                          <button
                            type="button"
                            className="text-ink-700/60"
                            onClick={() => setEditingModelId(null)}
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-right"
                          onClick={() => setSelectedModelId(model.id)}
                        >
                          <p className="font-medium">{model.name}</p>
                          <p className="text-xs text-ink-700/60">
                            {typeName} · {brandLabel} · {model.accessories.length} ملحق ·{" "}
                            {model.spareParts.length} قطعة غيار
                          </p>
                        </button>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="text-ink-900"
                            onClick={() => {
                              setEditingModelId(model.id);
                              setEditModelName(model.name);
                              setEditModelTypeId(model.deviceTypeId);
                              setEditModelBrandId(model.brandId);
                              setSelectedModelId(model.id);
                            }}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="text-rose-700"
                            onClick={() => {
                              run(() => deleteModel(model.id), "تم حذف الموديل.");
                              if (selectedModelId === model.id) setSelectedModelId("");
                              if (editingModelId === model.id) setEditingModelId(null);
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    )}
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
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <CatalogSuggestInput
                      value={accessoryName}
                      onChange={setAccessoryName}
                      suggestions={accessorySuggestions}
                      onPick={(item) => setAccessoryName(item.name)}
                      placeholder="اسم الملحق"
                      hint="اكتب لعرض أسماء مشابهة من موديلات أخرى"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        if (
                          run(
                            () => addModelAccessory(selectedModel.id, accessoryName),
                            "تمت إضافة الملحق.",
                          )
                        ) {
                          setAccessoryName("");
                        }
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
                        >
                          {editingAccessoryId === item.id ? (
                            <div className="flex w-full flex-wrap items-start gap-2">
                              <CatalogSuggestInput
                                value={editingAccessoryName}
                                onChange={setEditingAccessoryName}
                                suggestions={editingAccessorySuggestions}
                                onPick={(suggestion) => setEditingAccessoryName(suggestion.name)}
                                placeholder="اسم الملحق"
                              />
                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  className="text-aroma-700"
                                  onClick={() => {
                                    if (
                                      run(
                                        () =>
                                          updateModelAccessory(
                                            selectedModel.id,
                                            item.id,
                                            editingAccessoryName,
                                          ),
                                        "تم تعديل الملحق.",
                                      )
                                    ) {
                                      setEditingAccessoryId(null);
                                    }
                                  }}
                                >
                                  حفظ
                                </button>
                                <button
                                  type="button"
                                  className="text-ink-700/60"
                                  onClick={() => setEditingAccessoryId(null)}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>{item.name}</span>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  className="text-ink-900"
                                  onClick={() => {
                                    setEditingAccessoryId(item.id);
                                    setEditingAccessoryName(item.name);
                                  }}
                                >
                                  تعديل
                                </button>
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
                              </div>
                            </>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium">قطع الغيار الخاصة بالموديل</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                    <CatalogSuggestInput
                      value={spareName}
                      onChange={setSpareName}
                      suggestions={spareSuggestions}
                      onPick={(item) => {
                        setSpareName(item.name);
                        setSpareColor(item.color ?? "");
                      }}
                      placeholder="اسم قطعة الغيار *"
                      hint="اكتب لعرض قطع مشابهة من موديلات أخرى"
                    />
                    <input
                      value={spareColor}
                      onChange={(e) => setSpareColor(e.target.value)}
                      placeholder="اللون (اختياري)"
                      className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        if (
                          run(
                            () => addModelSparePart(selectedModel.id, spareName, spareColor),
                            "تمت إضافة قطعة الغيار.",
                          )
                        ) {
                          setSpareName("");
                          setSpareColor("");
                        }
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
                        >
                          {editingSpareId === item.id ? (
                            <div className="flex w-full flex-wrap items-start gap-2">
                              <CatalogSuggestInput
                                value={editingSpareName}
                                onChange={setEditingSpareName}
                                suggestions={editingSpareSuggestions}
                                onPick={(suggestion) => {
                                  setEditingSpareName(suggestion.name);
                                  setEditingSpareColor(suggestion.color ?? "");
                                }}
                                placeholder="الاسم *"
                              />
                              <input
                                value={editingSpareColor}
                                onChange={(e) => setEditingSpareColor(e.target.value)}
                                placeholder="اللون (اختياري)"
                                className="min-w-[120px] flex-1 rounded-xl border border-ink-900/15 px-3 py-1.5"
                              />
                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  className="text-aroma-700"
                                  onClick={() => {
                                    if (
                                      run(
                                        () =>
                                          updateModelSparePart(
                                            selectedModel.id,
                                            item.id,
                                            editingSpareName,
                                            editingSpareColor,
                                          ),
                                        "تم تعديل قطعة الغيار.",
                                      )
                                    ) {
                                      setEditingSpareId(null);
                                    }
                                  }}
                                >
                                  حفظ
                                </button>
                                <button
                                  type="button"
                                  className="text-ink-700/60"
                                  onClick={() => setEditingSpareId(null)}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>
                                {item.name}
                                {item.color ? (
                                  <span className="text-ink-700/60"> · لون: {item.color}</span>
                                ) : null}
                              </span>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  className="text-ink-900"
                                  onClick={() => {
                                    setEditingSpareId(item.id);
                                    setEditingSpareName(item.name);
                                    setEditingSpareColor(item.color ?? "");
                                  }}
                                >
                                  تعديل
                                </button>
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
                              </div>
                            </>
                          )}
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
