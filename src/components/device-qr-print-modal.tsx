"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  buildDeviceQrUrl,
  ensureDeviceQrFields,
  isDeviceQrPrinted,
  markDeviceQrPrinted,
} from "@/lib/device-qr";
import { formatDate } from "@/lib/utils";
import type { DraftRequestDevice } from "@/types/domain";

type Props = {
  open: boolean;
  device: DraftRequestDevice | null;
  /** Parent request id when device is already saved; omit for draft-only print */
  requestId?: string | null;
  /** Called after print/confirm with the updated device (includes qrPrintedAt) */
  onPrinted: (device: DraftRequestDevice) => void;
  onClose: () => void;
  /** When true, closing without printing is blocked (branch create gate) */
  requirePrint?: boolean;
};

export function DeviceQrPrintModal({
  open,
  device,
  requestId,
  onPrinted,
  onClose,
  requirePrint = true,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensured = device ? ensureDeviceQrFields(device) : null;
  const qrUrl = ensured ? buildDeviceQrUrl(ensured) : "";
  const alreadyPrinted = ensured ? isDeviceQrPrinted(ensured) : false;

  useEffect(() => {
    if (!open || !ensured) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void QRCode.toDataURL(qrUrl, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("تعذر إنشاء رمز QR. حاول مرة أخرى.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, qrUrl, ensured?.localId]);

  if (!open || !ensured) return null;

  function confirmPrinted() {
    if (!ensured) return;
    const current = ensured;
    setBusy(true);
    setError(null);
    const printedAt = new Date().toISOString();
    const next: DraftRequestDevice = {
      ...current,
      qrPrintedAt: printedAt,
    };

    if (requestId) {
      const saved = markDeviceQrPrinted({
        requestId,
        deviceLocalId: current.localId,
        printedAt,
      });
      if (!saved) {
        setError("تعذر حفظ تأكيد الطباعة. حدّث الصفحة وحاول مجددًا.");
        setBusy(false);
        return;
      }
      onPrinted(saved.device);
    } else {
      onPrinted(next);
    }
    setBusy(false);
    onClose();
  }

  function handlePrint() {
    if (!ensured) return;
    const current = ensured;
    setError(null);
    const node = printRef.current;
    if (!node || !dataUrl) {
      setError("انتظر اكتمال رمز QR ثم أعد المحاولة.");
      return;
    }

    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!win) {
      setError("اسمح بالنوافذ المنبثقة لتتمكن من الطباعة.");
      return;
    }

    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>ملصق QR — ${current.deviceCode}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #111; }
  .label { text-align: center; max-width: 320px; margin: 0 auto; }
  img { width: 240px; height: 240px; }
  h1 { font-size: 18px; margin: 12px 0 4px; }
  p { margin: 4px 0; font-size: 13px; }
  .muted { color: #555; font-size: 11px; word-break: break-all; }
</style></head><body>
<div class="label">
  <img src="${dataUrl}" alt="QR" />
  <h1>${current.deviceCode}</h1>
  <p>${current.brandName} ${current.modelName}</p>
  <p>سيريال: ${current.serialNumber || "—"}</p>
  <p class="muted">${qrUrl}</p>
</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 print:static print:bg-white">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900 print:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">طباعة ملصق QR</h2>
            <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
              اطبع الملصق والصقه على الجهاز قبل أي خطوة تالية (شحن أو تسليم للمندوب).
            </p>
          </div>
          {!requirePrint || alreadyPrinted ? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-ink-700/70 dark:text-sand-100/70"
            >
              إغلاق
            </button>
          ) : null}
        </div>

        <div
          ref={printRef}
          className="mt-6 flex flex-col items-center rounded-2xl border border-ink-900/10 bg-sand-50 p-5 dark:border-white/10 dark:bg-ink-950"
        >
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL QR for print
            <img src={dataUrl} alt={`QR ${ensured.deviceCode}`} className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-ink-700/60">
              جاري إنشاء الرمز…
            </div>
          )}
          <p className="mt-4 font-display text-xl">{ensured.deviceCode}</p>
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
            {ensured.brandName} {ensured.modelName}
          </p>
          <p className="mt-1 text-xs text-ink-700/50 dark:text-sand-100/50">
            سيريال: {ensured.serialNumber || "—"}
          </p>
          {alreadyPrinted && ensured.qrPrintedAt ? (
            <p className="mt-2 text-xs text-aroma-700 dark:text-aroma-200">
              مطبوع سابقًا: {formatDate(ensured.qrPrintedAt)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              لم يُؤكَّد طباعة الملصق بعد
            </p>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!dataUrl || busy}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-sand-100 dark:text-ink-900"
          >
            طباعة الملصق
          </button>
          <button
            type="button"
            onClick={confirmPrinted}
            disabled={busy || !dataUrl}
            className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {alreadyPrinted ? "تأكيد إعادة الطباعة" : "تمّت الطباعة — متابعة"}
          </button>
          {!requirePrint ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-sm text-ink-700/70 dark:text-sand-100/70"
            >
              لاحقًا
            </button>
          ) : null}
        </div>
        {requirePrint && !alreadyPrinted ? (
          <p className="mt-3 text-xs text-ink-700/60 dark:text-sand-100/60">
            لا يمكن إغلاق هذه النافذة قبل تأكيد الطباعة — حتى لا يُشحن جهاز بلا ملصق.
          </p>
        ) : null}
      </div>
    </div>
  );
}
