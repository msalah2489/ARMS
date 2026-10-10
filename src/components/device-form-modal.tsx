"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePickerField, type ImageValue } from "@/components/image-picker-field";
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
  const [color, setColor] = useState("");
  const [fault, setFault] = useState("");
  const [externalCondition, setExternalCondition] = useState<ExternalCondition | "">("");
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [extraDetails, setExtraDetails] = useState("");
  const [deviceImage, setDeviceImage] = useState<ImageValue | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptImage, setReceiptImage] = useState<ImageValue | null>(null);
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
    setColor("");
    setFault("");
    setExternalCondition("");
    setAccessoryIds([]);
    setExtraDetails("");
    setDeviceImage(null);
    setReceiptNumber("");
    setReceiptImage(null);
    setError(null);
    if (!keepOpen) onClose();
  }

  function buildDevice(): DraftRequestDevice | null {
    const colorTrimmed = color.trim();
    if (
      !deviceTypeId ||
      !brandId ||
      !modelId ||
      !colorTrimmed ||
      !externalCondition ||
      !receiptNumber ||
      !deviceImage?.dataUrl ||
      !receiptImage?.dataUrl
    ) {
      setError(
        "يرجى تعبئة الحقول الإلزامية: النوع، البراند، الموديل، لون الجهاز، الحالة الخارجية، صورة الجهاز، رقم وصورة سند الاستلام.",
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
      color: colorTrimmed,
      fault: fault.trim(),
      externalCondition,
      accessoryIds,
      accessoryNames: (model?.accessories ?? [])
        .filter((item) => accessoryIds.includes(item.id))
        .map((item) => (item.color ? `${item.name} · ${item.color}` : item.name)),
      extraDetails: extraDetails.trim(),
      devicePhotoNames: deviceImage.name ? [deviceImage.name] : [],
      deviceImageDataUrl: deviceImage.dataUrl,
      deviceImageName: deviceImage.name,
      receiptNumber: receiptNumber.trim(),
      receiptPhotoName: receiptImage.name,
      receiptPhotoDataUrl: receiptImage.dataUrl,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">إضافة جهاز</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-700/70 dark:text-sand-100/70">
            إغلاق
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            كود الجهاز
            <input
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
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
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
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
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
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
                const nextModelId = e.target.value;
                setModelId(nextModelId);
                setAccessoryIds([]);
                const nextModel = models.find((item) => item.id === nextModelId);
                if (nextModel?.color?.trim()) {
                  setColor(nextModel.color.trim());
                }
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
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
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
            />
          </label>
          <label className="block text-sm">
            لون الجهاز *
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="مثال: أسود / فضي"
              required
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
            />
          </label>
          <label className="block text-sm">
            العطل
            <input
              value={fault}
              onChange={(e) => setFault(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            الحالة الخارجية *
            <select
              value={externalCondition}
              onChange={(e) => setExternalCondition(e.target.value as ExternalCondition)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
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
              <p className="text-xs text-ink-700/60 dark:text-sand-100/60">اختر الموديل لعرض الملحقات.</p>
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
                  {item.color ? <span className="text-ink-700/60 dark:text-sand-100/60">· لون: {item.color}</span> : null}
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
            className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
            rows={3}
          />
        </label>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ImagePickerField
            label="صورة الجهاز"
            required
            hint="صورة واضحة للجهاز — إلزامية"
            value={deviceImage}
            onChange={setDeviceImage}
          />
          <label className="block text-sm">
            رقم سند الاستلام *
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
            />
          </label>
          <ImagePickerField
            className="md:col-span-2"
            label="صورة سند الاستلام"
            required
            value={receiptImage}
            onChange={setReceiptImage}
          />
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const device = buildDevice();
              if (!device) return;
              onSave(device, false);
              resetForm(false);
            }}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-sand-100 dark:text-ink-900"
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
            className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm dark:border-white/20"
          >
            حفظ وإضافة جهاز آخر
          </button>
          <button
            type="button"
            onClick={() => resetForm(false)}
            className="rounded-full px-5 py-2.5 text-sm text-ink-700/70 dark:text-sand-100/70"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
