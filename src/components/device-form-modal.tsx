"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { ImagePickerField, type ImageValue } from "@/components/image-picker-field";
import { EXTERNAL_CONDITION_LABELS, generateDeviceCode } from "@/lib/branch-catalog";
import {
  getBrands,
  getDeviceTypes,
  getModelColors,
  getModels,
  listModelAccessories,
} from "@/lib/catalog-store";
import {
  buildReturningDeviceDraft,
  parseDeviceQrPayload,
  resolveReturningDevice,
  type ReturningDeviceLookupMode,
} from "@/lib/device-qr";
import { useUnsavedChanges } from "@/lib/unsaved-changes";
import type { CatalogItem, DraftRequestDevice, ExternalCondition, ModelItem } from "@/types/domain";

type DeviceEntryMode = "choice" | "new" | "returning";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (device: DraftRequestDevice, addAnother: boolean) => void;
  /** Existing draft localIds — block adding the same returning device twice */
  existingLocalIds?: string[];
  /** Prefill request customer fields from the matched prior visit */
  onReturningCustomer?: (customer: {
    mobile: string;
    contactName: string;
    purchaseInvoice: string;
  }) => void;
};

const CONDITIONS = Object.keys(EXTERNAL_CONDITION_LABELS) as ExternalCondition[];
const DIRTY_SCOPE = "device-form-modal";

function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "تم رفض إذن الكاميرا. اسمح بالوصول من إعدادات المتصفح أو الصق الكود يدويًا.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "لم يتم العثور على كاميرا — الصق الكود أو ابحث بالسيريال.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "الكاميرا مشغولة بتطبيق آخر. أغلقه ثم أعد المحاولة، أو الصق الكود يدويًا.";
  }
  return "تعذر فتح الكاميرا. الصق كود الجهاز أو رابط QR يدويًا.";
}

export function DeviceFormModal({
  open,
  onClose,
  onSave,
  existingLocalIds = [],
  onReturningCustomer,
}: Props) {
  const { setDirty, clearDirty, confirmIfDirty } = useUnsavedChanges(DIRTY_SCOPE);
  const [entryMode, setEntryMode] = useState<DeviceEntryMode>("choice");
  const [deviceTypes, setDeviceTypes] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [deviceCode, setDeviceCode] = useState(generateDeviceCode());
  const [baselineCode, setBaselineCode] = useState("");
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

  /** Stable identity when editing a returning device */
  const [returningLocalId, setReturningLocalId] = useState<string | null>(null);
  const [returningQrToken, setReturningQrToken] = useState<string | null>(null);
  const [returningQrPrintedAt, setReturningQrPrintedAt] = useState<string | null>(null);
  const [returningHistoryHref, setReturningHistoryHref] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [serialLookup, setSerialLookup] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledScanRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const isReturning = entryMode === "returning" && Boolean(returningLocalId);
  const fieldsLocked = isReturning;

  function stopCamera() {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    handledScanRef.current = false;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    setCameraStarting(false);
  }

  function resetBlankForm() {
    const code = generateDeviceCode();
    setDeviceCode(code);
    setBaselineCode(code);
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
    setReturningLocalId(null);
    setReturningQrToken(null);
    setReturningQrPrintedAt(null);
    setReturningHistoryHref(null);
    setLookupQuery("");
    setSerialLookup("");
    setError(null);
  }

  useEffect(() => {
    if (!open) {
      clearDirty();
      stopCamera();
      return;
    }
    setDeviceTypes(getDeviceTypes());
    setBrands(getBrands());
    setModels(getModels());
    setEntryMode("choice");
    resetBlankForm();
    clearDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open, clearDirty]);

  const formDirty = useMemo(() => {
    if (!open || entryMode === "choice") return false;
    if (entryMode === "returning" && !returningLocalId) {
      return Boolean(lookupQuery.trim() || serialLookup.trim());
    }
    return (
      deviceCode !== baselineCode ||
      Boolean(deviceTypeId) ||
      Boolean(brandId) ||
      Boolean(modelId) ||
      Boolean(serialNumber.trim()) ||
      Boolean(color.trim()) ||
      Boolean(fault.trim()) ||
      Boolean(externalCondition) ||
      accessoryIds.length > 0 ||
      Boolean(extraDetails.trim()) ||
      Boolean(deviceImage) ||
      Boolean(receiptNumber.trim()) ||
      Boolean(receiptImage) ||
      Boolean(returningLocalId)
    );
  }, [
    open,
    entryMode,
    returningLocalId,
    lookupQuery,
    serialLookup,
    baselineCode,
    deviceCode,
    deviceTypeId,
    brandId,
    modelId,
    serialNumber,
    color,
    fault,
    externalCondition,
    accessoryIds,
    extraDetails,
    deviceImage,
    receiptNumber,
    receiptImage,
  ]);

  useEffect(() => {
    if (!open) return;
    setDirty(formDirty);
  }, [open, formDirty, setDirty]);

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
  const modelAccessories = listModelAccessories(selectedModel, color);

  if (!open) return null;

  function applyReturningResolve(
    query: string,
    mode: ReturningDeviceLookupMode,
  ): boolean {
    setLookupBusy(true);
    setError(null);
    try {
      const resolved = resolveReturningDevice(query, mode);
      if (!resolved) {
        setError(
          mode === "serial"
            ? "لا يوجد جهاز بهذا الرقم التسلسلي."
            : "لا يوجد جهاز مطابق لهذا الرمز. تأكد من المسح أو أدخل الكود يدويًا.",
        );
        return false;
      }
      if (existingLocalIds.includes(resolved.device.localId)) {
        setError("هذا الجهاز مضاف مسبقًا في الطلب الحالي.");
        return false;
      }
      const draft = buildReturningDeviceDraft(resolved.device, {
        forceReprint: resolved.forceReprint,
      });
      setReturningLocalId(draft.localId);
      setReturningQrToken(draft.qrToken || draft.localId);
      setReturningQrPrintedAt(draft.qrPrintedAt ?? null);
      setReturningHistoryHref(`/devices/detail/?id=${encodeURIComponent(draft.localId)}`);
      setDeviceCode(draft.deviceCode);
      setBaselineCode(draft.deviceCode);
      setDeviceTypeId(draft.deviceTypeId);
      setBrandId(draft.brandId);
      setModelId(draft.modelId);
      setSerialNumber(draft.serialNumber || "");
      setColor(draft.color || "");
      setFault(draft.fault || "");
      setExternalCondition(draft.externalCondition);
      setAccessoryIds(draft.accessoryIds || []);
      setExtraDetails(draft.extraDetails || "");
      setDeviceImage(
        draft.deviceImageDataUrl
          ? { dataUrl: draft.deviceImageDataUrl, name: draft.deviceImageName || "device.jpg" }
          : null,
      );
      setReceiptNumber("");
      setReceiptImage(null);
      onReturningCustomer?.({
        mobile: resolved.request.customerMobile || "",
        contactName: resolved.request.contactName || "",
        purchaseInvoice: resolved.request.purchaseInvoice || "",
      });
      stopCamera();
      return true;
    } finally {
      setLookupBusy(false);
    }
  }

  async function startCamera() {
    setError(null);
    stopCamera();

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("الكاميرا تحتاج سياقًا آمنًا (HTTPS أو localhost).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("الكاميرا غير متاحة — الصق الكود يدويًا أو ابحث بالسيريال.");
      return;
    }

    setCameraStarting(true);
    setCameraOn(true);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const video = videoRef.current;
    if (!video) {
      setCameraStarting(false);
      setCameraOn(false);
      setError("تعذر تجهيز معاينة الكاميرا.");
      return;
    }

    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 800,
      });
      handledScanRef.current = false;
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        video,
        (result, _err, ctrl) => {
          if (!result || handledScanRef.current) return;
          const raw = result.getText()?.trim();
          if (!raw) return;
          handledScanRef.current = true;
          try {
            ctrl.stop();
          } catch {
            /* ignore */
          }
          stopCamera();
          setLookupQuery(parseDeviceQrPayload(raw) || raw);
          applyReturningResolve(raw, "qr");
        },
      );
      controlsRef.current = controls;
      setCameraStarting(false);
    } catch (err) {
      stopCamera();
      setError(cameraErrorMessage(err));
    }
  }

  function resetForm(keepOpen: boolean) {
    stopCamera();
    resetBlankForm();
    clearDirty();
    if (keepOpen) {
      setEntryMode("choice");
    } else {
      setEntryMode("choice");
      onClose();
    }
  }

  function requestClose() {
    confirmIfDirty(() => {
      clearDirty();
      resetForm(false);
    });
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
    const modelColors = getModelColors(model);
    if (
      modelColors.length > 0 &&
      !modelColors.some((item) => item.toLowerCase() === colorTrimmed.toLowerCase())
    ) {
      setError("اختر لون الجهاز من ألوان الموديل المتاحة.");
      return null;
    }

    const localId = returningLocalId || crypto.randomUUID();
    const qrToken = returningQrToken || localId;
    if (existingLocalIds.includes(localId)) {
      setError("هذا الجهاز مضاف مسبقًا في الطلب الحالي.");
      return null;
    }

    return {
      localId,
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
      accessoryNames: listModelAccessories(model, colorTrimmed)
        .filter((item) => accessoryIds.includes(item.id))
        .map((item) => (item.color ? `${item.name} · ${item.color}` : item.name)),
      extraDetails: extraDetails.trim(),
      devicePhotoNames: deviceImage.name ? [deviceImage.name] : [],
      deviceImageDataUrl: deviceImage.dataUrl,
      deviceImageName: deviceImage.name,
      receiptNumber: receiptNumber.trim(),
      receiptPhotoName: receiptImage.name,
      receiptPhotoDataUrl: receiptImage.dataUrl,
      qrToken,
      qrPrintedAt: returningLocalId ? returningQrPrintedAt : undefined,
    };
  }

  const lockedInputClass =
    "mt-1 w-full rounded-xl border border-ink-900/15 bg-sand-50 px-3 py-2 dark:border-white/15 dark:bg-ink-950";
  const inputClass =
    "mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">
            {entryMode === "choice"
              ? "إضافة جهاز"
              : entryMode === "returning"
                ? "جهاز سابق"
                : "جهاز جديد"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="text-sm text-ink-700/70 dark:text-sand-100/70"
          >
            إغلاق
          </button>
        </div>

        {entryMode === "choice" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setEntryMode("returning");
                setError(null);
              }}
              className="rounded-2xl border border-ink-900/15 bg-sand-50 p-5 text-right transition hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950"
            >
              <p className="font-display text-lg">جهاز سابق (مسح QR)</p>
              <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
                امسح الملصق أو أدخل الكود لتحميل بيانات الجهاز والعميل مع نفس الهوية.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                resetBlankForm();
                setEntryMode("new");
                setError(null);
              }}
              className="rounded-2xl border border-ink-900/15 bg-sand-50 p-5 text-right transition hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950"
            >
              <p className="font-display text-lg">جهاز جديد</p>
              <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
                أول مرة لهذا الجهاز — إنشاء كود جديد وطباعة ملصق QR.
              </p>
            </button>
          </div>
        ) : null}

        {entryMode === "returning" && !returningLocalId ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
              امسح ملصق QR أو الصق الكود / رابط الجهاز. إذا ضاع الملصق، ابحث بالرقم التسلسلي
              لإعادة طباعة نفس الرمز.
            </p>
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                applyReturningResolve(lookupQuery, "qr");
              }}
            >
              <input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="كود الجهاز / رابط QR"
                className="min-w-[220px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
              />
              <button
                type="submit"
                disabled={lookupBusy}
                className="rounded-full bg-ink-900 px-5 py-2 text-sm text-white disabled:opacity-50 dark:bg-sand-100 dark:text-ink-900"
              >
                تحميل الجهاز
              </button>
              <button
                type="button"
                disabled={cameraStarting}
                onClick={() => (cameraOn ? stopCamera() : void startCamera())}
                className="rounded-full border border-ink-900/20 px-5 py-2 text-sm disabled:opacity-60 dark:border-white/20"
              >
                {cameraStarting
                  ? "جاري فتح الكاميرا…"
                  : cameraOn
                    ? "إيقاف الكاميرا"
                    : "فتح الكاميرا"}
              </button>
            </form>

            {cameraOn ? (
              <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-ink-950">
                <video
                  ref={videoRef}
                  className="mx-auto max-h-64 w-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />
              </div>
            ) : null}

            <div className="rounded-2xl border border-dashed border-ink-900/20 p-4 dark:border-white/20">
              <p className="text-sm font-medium">ملصق مفقود؟ ابحث بالسيريال</p>
              <p className="mt-1 text-xs text-ink-700/60 dark:text-sand-100/60">
                يُعاد استخدام نفس هوية الجهاز وطباعة نفس رمز QR (وليس كودًا جديدًا).
              </p>
              <form
                className="mt-3 flex flex-wrap gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyReturningResolve(serialLookup, "serial");
                }}
              >
                <input
                  value={serialLookup}
                  onChange={(e) => setSerialLookup(e.target.value)}
                  placeholder="الرقم التسلسلي"
                  className="min-w-[200px] flex-1 rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                />
                <button
                  type="submit"
                  disabled={lookupBusy}
                  className="rounded-full border border-ink-900/20 px-5 py-2 text-sm disabled:opacity-50 dark:border-white/20"
                >
                  بحث وإعادة طباعة نفس QR
                </button>
              </form>
            </div>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                setEntryMode("choice");
                setError(null);
              }}
              className="text-sm text-ink-700/70 dark:text-sand-100/70"
            >
              ← رجوع للاختيار
            </button>
          </div>
        ) : null}

        {entryMode === "new" || (entryMode === "returning" && returningLocalId) ? (
          <>
            {isReturning ? (
              <div className="mt-4 rounded-xl border border-aroma-400/40 bg-aroma-50/60 px-4 py-3 text-sm dark:bg-aroma-950/30">
                <p className="font-medium text-ink-900 dark:text-sand-50">
                  جهاز سابق — الحقول مقفلة ما عدا سند الاستلام لهذه الزيارة
                </p>
                <p className="mt-1 text-ink-700/70 dark:text-sand-100/70">
                  يُحفظ بنفس الكود والهوية ({deviceCode}) لربط السجل السابق.
                  {returningQrPrintedAt
                    ? " الملصق موجود مسبقًا — يمكن المتابعة دون إعادة طباعة."
                    : " ستُطلب طباعة/تأكيد نفس ملصق QR قبل الحفظ."}
                </p>
                {returningHistoryHref ? (
                  <Link
                    href={returningHistoryHref}
                    target="_blank"
                    className="mt-2 inline-block text-aroma-700 underline dark:text-aroma-200"
                  >
                    عرض سجل الجهاز
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                كود الجهاز
                <input
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  readOnly={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
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
                  disabled={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
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
                  disabled={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
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
                    const colors = getModelColors(nextModel);
                    setColor(colors.length === 1 ? colors[0] : "");
                  }}
                  disabled={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
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
                  readOnly={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
                />
              </label>
              <label className="block text-sm">
                لون الجهاز *
                {getModelColors(selectedModel).length > 0 ? (
                  <select
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setAccessoryIds([]);
                    }}
                    required
                    disabled={fieldsLocked}
                    className={fieldsLocked ? lockedInputClass : inputClass}
                  >
                    <option value="">اختر اللون</option>
                    {getModelColors(selectedModel).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      setAccessoryIds([]);
                    }}
                    placeholder={
                      modelId ? "لا ألوان على الموديل — أدخل اللون يدوياً" : "اختر الموديل أولاً"
                    }
                    required
                    readOnly={fieldsLocked}
                    className={fieldsLocked ? lockedInputClass : inputClass}
                  />
                )}
              </label>
              <label className="block text-sm">
                العطل
                <input
                  value={fault}
                  onChange={(e) => setFault(e.target.value)}
                  readOnly={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
                />
              </label>
              <label className="block text-sm md:col-span-2">
                الحالة الخارجية *
                <select
                  value={externalCondition}
                  onChange={(e) => setExternalCondition(e.target.value as ExternalCondition)}
                  disabled={fieldsLocked}
                  className={fieldsLocked ? lockedInputClass : inputClass}
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
                {!selectedModel || !color.trim() ? (
                  <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                    اختر الموديل ولون الجهاز لعرض الملحقات.
                  </p>
                ) : modelAccessories.length === 0 ? (
                  <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                    لا توجد ملحقات لهذا اللون.
                  </p>
                ) : (
                  modelAccessories.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={accessoryIds.includes(item.id)}
                        disabled={fieldsLocked}
                        onChange={(e) => {
                          setAccessoryIds((prev) =>
                            e.target.checked
                              ? [...prev, item.id]
                              : prev.filter((id) => id !== item.id),
                          );
                        }}
                      />
                      {item.name}
                      {item.color ? (
                        <span className="text-ink-700/60 dark:text-sand-100/60">
                          · لون: {item.color}
                        </span>
                      ) : null}
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
                readOnly={fieldsLocked}
                className={fieldsLocked ? lockedInputClass : inputClass}
                rows={3}
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {fieldsLocked && deviceImage?.dataUrl ? (
                <div className="text-sm">
                  <p className="font-medium">صورة الجهاز</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- locked preview of stored data URL */}
                  <img
                    src={deviceImage.dataUrl}
                    alt="صورة الجهاز"
                    className="mt-2 h-32 w-32 rounded-xl object-cover"
                  />
                </div>
              ) : (
                <ImagePickerField
                  label="صورة الجهاز"
                  required
                  hint="صورة واضحة للجهاز — إلزامية"
                  value={deviceImage}
                  onChange={setDeviceImage}
                />
              )}
              <label className="block text-sm">
                رقم سند الاستلام *
                <input
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className={inputClass}
                />
                {isReturning ? (
                  <span className="mt-1 block text-xs text-ink-700/60 dark:text-sand-100/60">
                    سند استلام هذه الزيارة (لا يُعاد استخدام رقم الزيارة السابقة).
                  </span>
                ) : null}
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
                  clearDirty();
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
                  clearDirty();
                  onSave(device, true);
                  resetForm(true);
                }}
                className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm dark:border-white/20"
              >
                حفظ وإضافة جهاز آخر
              </button>
              {!isReturning ? (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    resetBlankForm();
                    setEntryMode("choice");
                    clearDirty();
                  }}
                  className="rounded-full px-5 py-2.5 text-sm text-ink-700/70 dark:text-sand-100/70"
                >
                  ← رجوع للاختيار
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    resetBlankForm();
                    setEntryMode("returning");
                    clearDirty();
                  }}
                  className="rounded-full px-5 py-2.5 text-sm text-ink-700/70 dark:text-sand-100/70"
                >
                  مسح جهاز آخر
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="rounded-full px-5 py-2.5 text-sm text-ink-700/70 dark:text-sand-100/70"
              >
                إلغاء
              </button>
            </div>
          </>
        ) : null}

        {entryMode === "returning" && !returningLocalId && error ? (
          <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
