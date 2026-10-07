"use client";

import { useRef, useState, type ReactNode } from "react";

export type BulkPreviewColumn = { key: string; label: string };

export type BulkPreviewTableRow = {
  /** Unique key for React */
  id: string;
  /** When true, row is highlighted in red */
  hasError: boolean;
  cells: Record<string, ReactNode>;
};

/**
 * Download Excel template + upload with preview → موافقة → تأكيد.
 * Shown only to system_admin (caller gates visibility).
 */
export function BulkCsvImportBar({
  title,
  hint,
  onDownloadTemplate,
  onParseFile,
  onConfirmApply,
  disabled,
}: {
  title: string;
  hint?: string;
  onDownloadTemplate: () => void | Promise<void>;
  onParseFile: (file: File) => Promise<
    | {
        ok: true;
        columns: BulkPreviewColumn[];
        rows: BulkPreviewTableRow[];
        validCount: number;
        errorCount: number;
      }
    | { ok: false; error: string }
  >;
  onConfirmApply: () => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    columns: BulkPreviewColumn[];
    rows: BulkPreviewTableRow[];
    validCount: number;
    errorCount: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function clearPreview() {
    setPreview(null);
    setParseError(null);
    setConfirmOpen(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-ink-900/20 bg-ink-900/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium dark:text-sand-50">{title}</p>
          {hint ? (
            <p className="mt-1 text-xs text-ink-700/60 dark:text-sand-100/60">{hint}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await onDownloadTemplate();
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/15 dark:text-sand-50"
          >
            تحميل القالب Excel
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/15 dark:text-sand-50"
          >
            {busy && !preview ? "جاري القراءة…" : "رفع الملف"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setParseError(null);
              setConfirmOpen(false);
              void (async () => {
                try {
                  const result = await onParseFile(file);
                  if (!result.ok) {
                    setPreview(null);
                    setParseError(result.error);
                    return;
                  }
                  setPreview({
                    columns: result.columns,
                    rows: result.rows,
                    validCount: result.validCount,
                    errorCount: result.errorCount,
                  });
                } catch (err) {
                  setPreview(null);
                  setParseError(
                    err instanceof Error ? err.message : "تعذر قراءة الملف.",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
        </div>
      </div>

      {parseError ? (
        <p className="text-sm text-rose-700 dark:text-rose-300">{parseError}</p>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-lg border border-ink-900/10 bg-white/70 p-3 dark:border-white/10 dark:bg-ink-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium dark:text-sand-50">
              معاينة البيانات قبل التسجيل
            </p>
            <p className="text-xs text-ink-700/70 dark:text-sand-100/60">
              صالح: {preview.validCount} · أخطاء: {preview.errorCount} · إجمالي:{" "}
              {preview.rows.length}
            </p>
          </div>

          <div className="max-h-72 overflow-auto rounded-md border border-ink-900/10 dark:border-white/10">
            <table className="min-w-full text-right text-xs">
              <thead className="sticky top-0 bg-ink-900/5 dark:bg-white/10">
                <tr>
                  {preview.columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-2 py-2 font-medium dark:text-sand-50"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.hasError
                        ? "bg-rose-100/80 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                        : "border-t border-ink-900/5 dark:border-white/5 dark:text-sand-100"
                    }
                  >
                    {preview.columns.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-2 py-1.5">
                        {row.cells[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy || preview.validCount === 0}
              onClick={() => setConfirmOpen(true)}
              className="rounded-full bg-aroma-700 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-aroma-600"
            >
              موافقة / تسجيل
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={clearPreview}
              className="rounded-full border border-ink-900/15 px-4 py-2 text-sm dark:border-white/15 dark:text-sand-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-import-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg dark:bg-ink-900 dark:text-sand-50">
            <h2 id="bulk-import-confirm-title" className="text-base font-semibold">
              هل أنت متأكد؟
            </h2>
            <p className="mt-2 text-sm text-ink-700/80 dark:text-sand-100/70">
              سيتم تسجيل {preview?.validCount ?? 0} صفًا في النظام
              {(preview?.errorCount ?? 0) > 0
                ? ` (وتجاهل ${preview?.errorCount} صفًا به أخطاء)`
                : ""}
              . لا يمكن التراجع بسهولة بعد التنفيذ.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="rounded-full border border-ink-900/15 px-4 py-2 text-sm dark:border-white/15"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void (async () => {
                    try {
                      await onConfirmApply();
                      clearPreview();
                    } finally {
                      setBusy(false);
                      setConfirmOpen(false);
                    }
                  })();
                }}
                className="rounded-full bg-aroma-700 px-4 py-2 text-sm text-white dark:bg-aroma-600"
              >
                {busy ? "جاري التسجيل…" : "تأكيد التسجيل"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
