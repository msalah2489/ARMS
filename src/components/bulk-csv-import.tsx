"use client";

import { useRef, useState } from "react";

/**
 * Download template + upload CSV/Excel-compatible file.
 * Shown only to system_admin (caller gates visibility).
 */
export function BulkCsvImportBar({
  title,
  hint,
  onDownloadTemplate,
  onUpload,
  disabled,
}: {
  title: string;
  hint?: string;
  onDownloadTemplate: () => void;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-ink-900/20 bg-ink-900/[0.02] p-4 dark:border-white/15 dark:bg-white/[0.02]">
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
            onClick={onDownloadTemplate}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/15 dark:text-sand-50"
          >
            تحميل القالب
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/15 dark:text-sand-50"
          >
            {busy ? "جاري الرفع…" : "رفع الملف"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              void (async () => {
                try {
                  await onUpload(file);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
        </div>
      </div>
    </div>
  );
}
