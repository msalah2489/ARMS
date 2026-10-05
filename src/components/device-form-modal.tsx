"use client";

import { useEffect, useMemo, useState } from "react";
import { EXTERNAL_CONDITION_LABELS, generateDeviceCode } from "@/lib/branch-catalog";
import { getBrands, getDeviceTypes, getModels } from "@/lib/catalog-store";
import type { CatalogItem, DraftRequestDevice, ExternalCondition, ModelItem } from "@/types/domain";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (device: DraftRequestDevice, addAnother: boolean) => void;
};

const CONDITIONS = Object.keys(EXTERNAL_CONDITION_LABELS) as ExternalCondition[];

export function DeviceFormModal({ open, onClose, onSave }: Props) {
  const [deviceTypes, setDeviceTypes] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [deviceCode, setDeviceCode] = useState(generateDeviceCode());
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [fault, setFault] = useState("");
  const [externalCondition, setExternalCondition] = useState<ExternalCondition | "">("");
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [extraDetails, setExtraDetails] = useState("");
  const [devicePhotoNames, setDevicePhotoNames] = useState<string[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptPhotoName, setReceiptPhotoName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDeviceTypes(getDeviceTypes());
    setBrands(getBrands());
    setModels(getModels());
  }, [open]);

  const filteredModels = useMemo(
    () =>
      models.filter(
        (model) =>
          (!deviceTypeId || model.deviceTypeId === deviceTypeId) &&
          (!brandId || model.brandId === brandId),
      ),
    [models, deviceTypeId, brandId],
  );

  const selectedModel = models.find((model) => model.id === modelId);

  if (!open) return null;

  function resetForm(keepOpen: boolean) {
    setDeviceCode(generateDeviceCode());
    setDeviceTypeId("");
    setBrandId("");
    setModelId("");
    setSerialNumber("");
    setFault("");
    setExternalCondition("");
    setAccessoryIds([]);
    setExtraDetails("");
    setDevicePhotoNames([]);
    setReceiptNumber("");
    setReceiptPhotoName("");
    setError(null);
    if (!keepOpen) onClose();
  }

  function buildDevice(): DraftRequestDevice | null {
    if (!deviceTypeId || !brandId || !modelId || !externalCondition || !receiptNumber || !receiptPhotoName) {
      setError(
        "يرجى تعبئة الحقول الإلزامية: النوع، البراند، الموديل، الحالة الخارجية، رقم وصورة سند الاستلام.",
      );
      return null;
    }
    const typeName = deviceTypes.find((item) => item.id === deviceTypeId)?.name ?? "";
    const brandName = brands.find((item) => item.id === brandId)?.name ?? "";
    const model = models.find((item) => item.id === modelId);
    return {
      localId: crypto.randomUUID(),
      deviceCode: deviceCode.trim(),
      deviceTypeId,
      deviceTypeName: typeName,
      brandId,
      brandName,
      modelId,
      modelName: model?.name ?? "",
      serialNumber: serialNumber.trim(),
      fault: fault.trim(),
      externalCondition,
      accessoryIds,
      accessoryNames: (model?.accessories ?? [])
        .filter((item) => accessoryIds.includes(item.id))
        .map((item) => item.name),
      extraDetails: extraDetails.trim(),
      devicePhotoNames,
      receiptNumber: receiptNumber.trim(),
      receiptPhotoName,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">إضافة جهاز</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-700/70">
            إغلاق
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            كود الجهاز
            <input
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            نوع الجهاز *
            <select
              value={deviceTypeId}
              onChange={(e) => {
                setDeviceTypeId(e.target.value);
                setModelId("");
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر النوع</option>
              {deviceTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            البراند *
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setModelId("");
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر البراند</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            الموديل *
            <select
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setAccessoryIds([]);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر الموديل</option>
              {filteredModels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            الرقم التسلسلي
            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            العطل
            <input
              value={fault}
              onChange={(e) => setFault(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            الحالة الخارجية *
            <select
              value={externalCondition}
              onChange={(e) => setExternalCondition(e.target.value as ExternalCondition)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              <option value="">اختر الحالة</option>
              {CONDITIONS.map((item) => (
                <option key={item} value={item}>
                  {EXTERNAL_CONDITION_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium">الملحقات</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {(selectedModel?.accessories ?? []).length === 0 ? (
              <p className="text-xs text-ink-700/60">اختر الموديل لعرض الملحقات.</p>
            ) : (
              selectedModel?.accessories.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accessoryIds.includes(item.id)}
                    onChange={(e) => {
                      setAccessoryIds((prev) =>
                        e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                      );
                    }}
                  />
                  {item.name}
                </label>
              ))
            )}
          </div>
        </div>

        <label className="mt-6 block text-sm">
          تفاصيل إضافية
          <textarea
            value={extraDetails}
            onChange={(e) => setExtraDetails(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            rows={3}
          />
        </label>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            صورة الجهاز
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setDevicePhotoNames(Array.from(e.target.files ?? []).map((file) => file.name))
              }
              className="mt-1 w-full text-sm"
            />
          </label>
          <label className="block text-sm">
            رقم سند الاستلام *
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            صورة سند الاستلام *
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptPhotoName(e.target.files?.[0]?.name ?? "")}
              className="mt-1 w-full text-sm"
            />
            {receiptPhotoName ? (
              <span className="mt-1 block text-xs text-ink-700/60">{receiptPhotoName}</span>
            ) : null}
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const device = buildDevice();
              if (!device) return;
              onSave(device, false);
              resetForm(false);
            }}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
          >
            حفظ الجهاز
          </button>
          <button
            type="button"
            onClick={() => {
              const device = buildDevice();
              if (!device) return;
              onSave(device, true);
              resetForm(true);
            }}
            className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm"
          >
            حفظ وإضافة جهاز آخر
          </button>
          <button
            type="button"
            onClick={() => resetForm(false)}
            className="rounded-full px-5 py-2.5 text-sm text-ink-700/70"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
