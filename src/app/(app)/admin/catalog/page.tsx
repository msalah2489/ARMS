"use client";

import { useEffect, useMemo, useState } from "react";
import { CatalogSuggestInput } from "@/components/catalog-suggest-input";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import { ImagePickerField, type ImageValue } from "@/components/image-picker-field";
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
  getModelColors,
  normalizeModelColors,
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
import { isDemoMode } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Tab = "types" | "brands" | "models";

function CatalogAdminContent() {
  const [tab, setTab] = useState<Tab>("types");
  const [catalog, setCatalog] = useState<DeviceCatalogState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [typeName, setTypeName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelColors, setModelColors] = useState<string[]>([]);
  const [modelColorDraft, setModelColorDraft] = useState("");
  const [modelTypeId, setModelTypeId] = useState("");
  const [modelBrandId, setModelBrandId] = useState("");
  const [modelImage, setModelImage] = useState<ImageValue | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [accessoryName, setAccessoryName] = useState("");
  const [accessoryColor, setAccessoryColor] = useState("");
  const [spareName, setSpareName] = useState("");
  const [spareColor, setSpareColor] = useState("");
  const [spareImage, setSpareImage] = useState<ImageValue | null>(null);

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingBrandName, setEditingBrandName] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editModelColors, setEditModelColors] = useState<string[]>([]);
  const [editModelColorDraft, setEditModelColorDraft] = useState("");
  const [editModelTypeId, setEditModelTypeId] = useState("");
  const [editModelBrandId, setEditModelBrandId] = useState("");
  const [editModelImage, setEditModelImage] = useState<ImageValue | null>(null);
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [editingAccessoryName, setEditingAccessoryName] = useState("");
  const [editingAccessoryColor, setEditingAccessoryColor] = useState("");
  const [editingSpareId, setEditingSpareId] = useState<string | null>(null);
  const [editingSpareName, setEditingSpareName] = useState("");
  const [editingSpareColor, setEditingSpareColor] = useState("");
  const [editingSpareImage, setEditingSpareImage] = useState<ImageValue | null>(null);

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
      suggestAccessoryNames(accessoryName || accessoryColor, {
        excludeModelId: selectedModelId || undefined,
      }),
    [accessoryName, accessoryColor, selectedModelId, catalog],
  );

  const editingAccessorySuggestions = useMemo(
    () =>
      suggestAccessoryNames(editingAccessoryName || editingAccessoryColor, {
        excludeModelId: selectedModelId || undefined,
      }),
    [editingAccessoryName, editingAccessoryColor, selectedModelId, catalog],
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

  /** Merge chips + draft (supports «أبيض، أسود» in one field). Used on save so draft is not lost. */
  function resolveColors(list: string[], draft: string): string[] {
    const fromDraft = draft
      .split(/[,،]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return normalizeModelColors({ colors: [...list, ...fromDraft] });
  }

  function addColorToList(
    list: string[],
    draft: string,
    setList: (next: string[]) => void,
    setDraft: (next: string) => void,
  ) {
    const next = resolveColors(list, draft);
    if (next.length === list.length && !draft.trim()) return;
    setList(next);
    setDraft("");
  }

  function removeColorFromList(
    list: string[],
    color: string,
    setList: (next: string[]) => void,
  ) {
    setList(list.filter((item) => item !== color));
  }

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
              setMessage(
                isSupabaseConfigured() && !isDemoMode()
                  ? "تم تفريغ الكتالوج (بدون بيانات تجريبية)."
                  : "تمت إعادة الكتالوج إلى القيم الافتراضية.",
              );
              setError(null);
              refresh();
            }}
          >
            {isSupabaseConfigured() && !isDemoMode() ? "تفريغ الكتالوج" : "إعادة الافتراضي"}
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
          <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
            <h2 className="font-display text-xl">إضافة موديل</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <select
                value={modelTypeId}
                onChange={(e) => setModelTypeId(e.target.value)}
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
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
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
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
                className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
              />
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-700/80 dark:text-sand-100/70">
                ألوان الجهاز المتاحة *
              </p>
              <p className="mt-0.5 text-[11px] text-ink-700/55 dark:text-sand-100/55">
                لون واحد يكفي. لأكثر من لون: اكتبها مفصولة بفاصلة (أبيض، أسود) أو أضف كل لون على حدة.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  value={modelColorDraft}
                  onChange={(e) => setModelColorDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColorToList(modelColors, modelColorDraft, setModelColors, setModelColorDraft);
                    }
                  }}
                  placeholder="مثال: أبيض  أو  أبيض، أسود"
                  className="min-w-[10rem] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
                />
                <button
                  type="button"
                  className="rounded-full border border-ink-900/15 px-3 py-2 text-xs dark:border-white/15"
                  onClick={() =>
                    addColorToList(modelColors, modelColorDraft, setModelColors, setModelColorDraft)
                  }
                >
                  إضافة للقائمة
                </button>
              </div>
              {modelColors.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modelColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => removeColorFromList(modelColors, color, setModelColors)}
                      className="rounded-full bg-ink-900/5 px-2.5 py-1 text-xs dark:bg-white/10"
                      title="إزالة اللون"
                    >
                      {color} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <ImagePickerField
                label="صورة الموديل"
                required
                hint="صورة تمثّل الموديل — إلزامية"
                value={modelImage}
                onChange={setModelImage}
              />
            </div>
            <button
              type="button"
              className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-sand-100 dark:text-ink-900"
              onClick={() => {
                const colors = resolveColors(modelColors, modelColorDraft);
                if (!colors.length) {
                  setError("اكتب لون الجهاز مرة واحدة على الأقل (لون واحد يكفي).");
                  setMessage(null);
                  return;
                }
                if (!modelImage?.dataUrl) {
                  setError("صورة الموديل إلزامية.");
                  setMessage(null);
                  return;
                }
                if (
                  run(
                    () =>
                      addModel({
                        name: modelName,
                        deviceTypeId: modelTypeId,
                        brandId: modelBrandId,
                        colors,
                        imageDataUrl: modelImage.dataUrl,
                      }),
                    "تمت إضافة الموديل.",
                  )
                ) {
                  setModelName("");
                  setModelColors([]);
                  setModelColorDraft("");
                  setModelImage(null);
                }
              }}
            >
              إضافة موديل
            </button>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
            <h2 className="font-display text-xl">الموديلات</h2>
            <div className="arms-scroll-x mt-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-900/10 text-right text-ink-700/70 dark:border-white/10 dark:text-sand-100/70">
                    <th className="px-2 py-2 font-medium">الصورة</th>
                    <th className="px-2 py-2 font-medium">الموديل</th>
                    <th className="px-2 py-2 font-medium">اللون</th>
                    <th className="px-2 py-2 font-medium">التصنيف</th>
                    <th className="px-2 py-2 font-medium">البراند</th>
                    <th className="px-2 py-2 font-medium">ملحقات</th>
                    <th className="px-2 py-2 font-medium">قطع غيار</th>
                    <th className="px-2 py-2 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.models.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-ink-700/60 dark:text-sand-100/60">
                        لا توجد موديلات بعد.
                      </td>
                    </tr>
                  ) : (
                    catalog.models.map((model) => {
                      const typeName =
                        catalog.deviceTypes.find((item) => item.id === model.deviceTypeId)?.name ??
                        "—";
                      const brandLabel =
                        catalog.brands.find((item) => item.id === model.brandId)?.name ?? "—";
                      const isEditing = editingModelId === model.id;

                      return (
                        <tr
                          key={model.id}
                          className={`border-b border-ink-900/5 dark:border-white/5 ${
                            selectedModelId === model.id ? "bg-aroma-50/40 dark:bg-aroma-900/20" : ""
                          }`}
                        >
                          {isEditing ? (
                            <>
                              <td className="align-top px-2 py-3">
                                <ImagePickerField
                                  label="صورة"
                                  required
                                  value={editModelImage}
                                  onChange={setEditModelImage}
                                  className="min-w-[7.5rem] text-xs"
                                />
                              </td>
                              <td className="align-top px-2 py-3">
                                <input
                                  value={editModelName}
                                  onChange={(e) => setEditModelName(e.target.value)}
                                  placeholder="اسم الموديل *"
                                  aria-label="اسم الموديل"
                                  className="w-full min-w-[7rem] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-950"
                                />
                              </td>
                              <td className="align-top px-2 py-3">
                                <div className="min-w-[8rem] space-y-1.5">
                                  <div className="flex gap-1">
                                    <input
                                      value={editModelColorDraft}
                                      onChange={(e) => setEditModelColorDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          addColorToList(
                                            editModelColors,
                                            editModelColorDraft,
                                            setEditModelColors,
                                            setEditModelColorDraft,
                                          );
                                        }
                                      }}
                                      placeholder="أبيض، أسود"
                                      aria-label="ألوان الموديل"
                                      className="w-full rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-950"
                                    />
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-lg border border-ink-900/15 px-2 text-xs dark:border-white/15"
                                      onClick={() =>
                                        addColorToList(
                                          editModelColors,
                                          editModelColorDraft,
                                          setEditModelColors,
                                          setEditModelColorDraft,
                                        )
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {editModelColors.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() =>
                                          removeColorFromList(
                                            editModelColors,
                                            color,
                                            setEditModelColors,
                                          )
                                        }
                                        className="rounded-full bg-ink-900/5 px-2 py-0.5 text-[11px] dark:bg-white/10"
                                      >
                                        {color} ×
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </td>
                              <td className="align-top px-2 py-3">
                                <select
                                  value={editModelTypeId}
                                  onChange={(e) => setEditModelTypeId(e.target.value)}
                                  aria-label="التصنيف"
                                  className="w-full min-w-[6.5rem] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-950"
                                >
                                  {catalog.deviceTypes.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="align-top px-2 py-3">
                                <select
                                  value={editModelBrandId}
                                  onChange={(e) => setEditModelBrandId(e.target.value)}
                                  aria-label="البراند"
                                  className="w-full min-w-[6.5rem] rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-ink-950"
                                >
                                  {catalog.brands.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="align-top px-2 py-3 text-ink-700/70 dark:text-sand-100/70">
                                {model.accessories.length}
                              </td>
                              <td className="align-top px-2 py-3 text-ink-700/70 dark:text-sand-100/70">
                                {model.spareParts.length}
                              </td>
                              <td className="align-top px-2 py-3">
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    className="text-start text-aroma-700 dark:text-aroma-200"
                                    onClick={() => {
                                      const colors = resolveColors(
                                        editModelColors,
                                        editModelColorDraft,
                                      );
                                      if (!colors.length) {
                                        setError("اكتب لون الجهاز مرة واحدة على الأقل (لون واحد يكفي).");
                                        setMessage(null);
                                        return;
                                      }
                                      if (!editModelImage?.dataUrl) {
                                        setError("صورة الموديل إلزامية.");
                                        setMessage(null);
                                        return;
                                      }
                                      if (
                                        run(
                                          () =>
                                            updateModel({
                                              id: model.id,
                                              name: editModelName,
                                              deviceTypeId: editModelTypeId,
                                              brandId: editModelBrandId,
                                              colors,
                                              imageDataUrl: editModelImage.dataUrl,
                                            }),
                                          "تم تعديل الموديل.",
                                        )
                                      ) {
                                        setEditingModelId(null);
                                        setEditModelImage(null);
                                        setEditModelColors([]);
                                        setEditModelColorDraft("");
                                      }
                                    }}
                                  >
                                    حفظ التعديل
                                  </button>
                                  <button
                                    type="button"
                                    className="text-start text-ink-700/60 dark:text-sand-100/60"
                                    onClick={() => {
                                      setEditingModelId(null);
                                      setEditModelImage(null);
                                      setEditModelColors([]);
                                      setEditModelColorDraft("");
                                    }}
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-3">
                                {model.imageDataUrl ? (
                                  <ClickableImage
                                    src={model.imageDataUrl}
                                    alt={model.name}
                                    size="sm"
                                  />
                                ) : (
                                  <ImagePlaceholder size="sm" />
                                )}
                              </td>
                              <td className="px-2 py-3">
                                <button
                                  type="button"
                                  className="text-right font-medium text-aroma-700 dark:text-aroma-200"
                                  onClick={() => setSelectedModelId(model.id)}
                                >
                                  {model.name}
                                </button>
                              </td>
                              <td className="px-2 py-3">
                                {getModelColors(model).length
                                  ? getModelColors(model).join(" · ")
                                  : "—"}
                              </td>
                              <td className="px-2 py-3">{typeName}</td>
                              <td className="px-2 py-3">{brandLabel}</td>
                              <td className="px-2 py-3">{model.accessories.length}</td>
                              <td className="px-2 py-3">{model.spareParts.length}</td>
                              <td className="px-2 py-3">
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    className="text-ink-900 dark:text-sand-50"
                                    onClick={() => {
                                      setEditingModelId(model.id);
                                      setEditModelName(model.name);
                                      setEditModelColors(getModelColors(model));
                                      setEditModelColorDraft("");
                                      setEditModelTypeId(model.deviceTypeId);
                                      setEditModelBrandId(model.brandId);
                                      setEditModelImage(
                                        model.imageDataUrl
                                          ? { name: model.name, dataUrl: model.imageDataUrl }
                                          : null,
                                      );
                                      setSelectedModelId(model.id);
                                    }}
                                  >
                                    تعديل
                                  </button>
                                  <button
                                    type="button"
                                    className="text-rose-700 dark:text-rose-300"
                                    onClick={() => {
                                      run(() => deleteModel(model.id), "تم حذف الموديل.");
                                      if (selectedModelId === model.id) setSelectedModelId("");
                                      if (editingModelId === model.id) setEditingModelId(null);
                                    }}
                                  >
                                    حذف
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selectedModel ? (
            <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
              <h2 className="font-display text-xl">تفاصيل: {selectedModel.name}</h2>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">الملحقات الخاصة بالموديل</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
                    <CatalogSuggestInput
                      value={accessoryName}
                      onChange={setAccessoryName}
                      suggestions={accessorySuggestions}
                      onPick={(item) => {
                        setAccessoryName(item.name);
                        setAccessoryColor(item.color ?? "");
                      }}
                      placeholder="اسم الملحق *"
                      hint="اكتب لعرض أسماء مشابهة من موديلات أخرى"
                    />
                    <input
                      value={accessoryColor}
                      onChange={(e) => setAccessoryColor(e.target.value)}
                      placeholder="اللون (اختياري)"
                      className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        if (
                          run(
                            () =>
                              addModelAccessory(selectedModel.id, accessoryName, accessoryColor),
                            "تمت إضافة الملحق.",
                          )
                        ) {
                          setAccessoryName("");
                          setAccessoryColor("");
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
                                onPick={(suggestion) => {
                                  setEditingAccessoryName(suggestion.name);
                                  setEditingAccessoryColor(suggestion.color ?? "");
                                }}
                                placeholder="اسم الملحق *"
                              />
                              <input
                                value={editingAccessoryColor}
                                onChange={(e) => setEditingAccessoryColor(e.target.value)}
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
                                          updateModelAccessory(
                                            selectedModel.id,
                                            item.id,
                                            editingAccessoryName,
                                            editingAccessoryColor,
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
                                    setEditingAccessoryId(item.id);
                                    setEditingAccessoryName(item.name);
                                    setEditingAccessoryColor(item.color ?? "");
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
                      className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-sand-100 dark:text-ink-900"
                      onClick={() => {
                        if (
                          run(
                            () =>
                              addModelSparePart(
                                selectedModel.id,
                                spareName,
                                spareColor,
                                spareImage?.dataUrl,
                              ),
                            "تمت إضافة قطعة الغيار.",
                          )
                        ) {
                          setSpareName("");
                          setSpareColor("");
                          setSpareImage(null);
                        }
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                  <div className="mt-3">
                    <ImagePickerField
                      label="صورة قطعة الغيار"
                      value={spareImage}
                      onChange={setSpareImage}
                      hint="اختيارية"
                    />
                  </div>
                  <ul className="mt-3 space-y-2">
                    {selectedModel.spareParts.length === 0 ? (
                      <li className="text-xs text-ink-700/60 dark:text-sand-100/60">لا توجد قطع غيار بعد.</li>
                    ) : (
                      selectedModel.spareParts.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 px-3 py-2 text-sm dark:border-white/10"
                        >
                          {editingSpareId === item.id ? (
                            <div className="flex w-full flex-col gap-2">
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
                                  className="min-w-[120px] flex-1 rounded-xl border border-ink-900/15 px-3 py-1.5 dark:border-white/15 dark:bg-ink-950"
                                />
                              </div>
                              <ImagePickerField
                                label="صورة قطعة الغيار"
                                value={editingSpareImage}
                                onChange={setEditingSpareImage}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="text-aroma-700 dark:text-aroma-200"
                                  onClick={() => {
                                    if (
                                      run(
                                        () =>
                                          updateModelSparePart(
                                            selectedModel.id,
                                            item.id,
                                            editingSpareName,
                                            editingSpareColor,
                                            editingSpareImage?.dataUrl,
                                          ),
                                        "تم تعديل قطعة الغيار.",
                                      )
                                    ) {
                                      setEditingSpareId(null);
                                      setEditingSpareImage(null);
                                    }
                                  }}
                                >
                                  حفظ
                                </button>
                                <button
                                  type="button"
                                  className="text-ink-700/60 dark:text-sand-100/60"
                                  onClick={() => {
                                    setEditingSpareId(null);
                                    setEditingSpareImage(null);
                                  }}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                {item.imageDataUrl ? (
                                  <ClickableImage
                                    src={item.imageDataUrl}
                                    alt={item.name}
                                    size="sm"
                                  />
                                ) : (
                                  <ImagePlaceholder size="sm" />
                                )}
                                <span>
                                  {item.name}
                                  {item.color ? (
                                    <span className="text-ink-700/60 dark:text-sand-100/60">
                                      {" "}
                                      · لون: {item.color}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  className="text-ink-900 dark:text-sand-50"
                                  onClick={() => {
                                    setEditingSpareId(item.id);
                                    setEditingSpareName(item.name);
                                    setEditingSpareColor(item.color ?? "");
                                    setEditingSpareImage(
                                      item.imageDataUrl
                                        ? { name: item.name, dataUrl: item.imageDataUrl }
                                        : null,
                                    );
                                  }}
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-700 dark:text-rose-300"
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
    <RoleGuard allow={["system_admin", "manager"]} permission="manage_catalog">
      <CatalogAdminContent />
    </RoleGuard>
  );
}
