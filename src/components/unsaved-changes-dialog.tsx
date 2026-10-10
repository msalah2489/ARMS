"use client";

type Props = {
  open: boolean;
  onConfirmStay: () => void;
  onDiscardAndLeave: () => void;
};

/**
 * RTL modal: ask whether to keep editing when leaving with unsaved drafts.
 * نعم = stay · لا = discard and proceed.
 */
export function UnsavedChangesDialog({ open, onConfirmStay, onDiscardAndLeave }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900"
      >
        <h2
          id="unsaved-changes-title"
          className="font-display text-xl text-ink-900 dark:text-sand-50"
        >
          تعديلات غير محفوظة
        </h2>
        <p className="mt-3 text-sm text-ink-700/80 dark:text-sand-100/80">
          لم يتم حفظ التعديلات. هل ترغب في إكمال التعديل؟
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
            onClick={onConfirmStay}
          >
            نعم
          </button>
          <button
            type="button"
            className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
            onClick={onDiscardAndLeave}
          >
            لا
          </button>
        </div>
      </div>
    </div>
  );
}
