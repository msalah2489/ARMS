"use client";

import { useEffect, useState } from "react";
import {
  REQUEST_FOLLOW_UP_REASON_LABELS,
  REQUEST_FOLLOW_UP_REASON_OPTIONS,
  REQUEST_REOPEN_REASON_LABELS,
  REQUEST_REOPEN_REASON_OPTIONS,
  validateReturnReason,
  type ReturnReasonMode,
} from "@/lib/request-return";
import type { RequestReturnReason } from "@/types/domain";

type Mode = ReturnReasonMode;

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  onConfirm: (reason: RequestReturnReason, note: string) => void;
};

const TITLES: Record<Mode, string> = {
  follow_up: "سبب الإرجاع — طلب متابعة",
  reopen: "سبب إعادة فتح الطلب",
};

const HINTS: Record<Mode, string> = {
  follow_up:
    "المسار الأساسي: إنشاء طلب صيانة جديد مرتبط بالطلب السابق (بعد التسليم للعميل). الطلب القديم يبقى في السجل منتهيًا.",
  reopen:
    "مسار خاص: إعادة فتح نفس الطلب عند الإغلاق بالخطأ أو قبل التسليم النهائي للعميل.",
};

function noteRequired(mode: Mode, reason: RequestReturnReason | ""): boolean {
  if (!reason) return false;
  if (reason === "other") return true;
  return mode === "reopen" && reason === "customer_refusal";
}

export function RequestReturnReasonModal({ open, mode, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<RequestReturnReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setError(null);
  }, [open, mode]);

  if (!open) return null;

  const options =
    mode === "reopen" ? REQUEST_REOPEN_REASON_OPTIONS : REQUEST_FOLLOW_UP_REASON_OPTIONS;
  const labels =
    mode === "reopen" ? REQUEST_REOPEN_REASON_LABELS : REQUEST_FOLLOW_UP_REASON_LABELS;
  const requiresNote = noteRequired(mode, reason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-return-reason-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="request-return-reason-title"
            className="font-display text-2xl text-ink-900 dark:text-sand-50"
          >
            {TITLES[mode]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-700/70 dark:text-sand-100/70"
          >
            إغلاق
          </button>
        </div>

        <p className="mt-3 text-sm text-ink-700/80 dark:text-sand-100/80">{HINTS[mode]}</p>

        <label className="mt-4 block text-sm text-ink-900 dark:text-sand-50">
          السبب *
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RequestReturnReason | "")}
            className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
          >
            <option value="">اختر السبب</option>
            {options.map((key) => (
              <option key={key} value={key}>
                {labels[key as keyof typeof labels]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm text-ink-900 dark:text-sand-50">
          ملاحظة {requiresNote ? "*" : "(اختياري)"}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              requiresNote
                ? reason === "customer_refusal"
                  ? "اكتب ملاحظة / سبب رفض العميل…"
                  : "اكتب تفصيل السبب…"
                : "تفاصيل إضافية إن وُجدت"
            }
            className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const err = validateReturnReason(reason, note, mode);
              if (err) {
                setError(err);
                return;
              }
              onConfirm(reason as RequestReturnReason, note.trim());
            }}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
          >
            {mode === "follow_up" ? "متابعة لإنشاء الطلب" : "تأكيد إعادة الفتح"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
