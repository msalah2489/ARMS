"use client";

import { useRef, useState } from "react";
import { ClickableImage } from "@/components/clickable-image";
import { compressImageFile } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

export type ImageValue = {
  name: string;
  dataUrl: string;
};

type Props = {
  label: string;
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  required?: boolean;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** Smaller defaults for profile photos keep sync/storage light. */
  compressOptions?: { maxEdge?: number; quality?: number };
  /** Round thumbnail (e.g. profile photo). */
  roundPreview?: boolean;
};

/** File picker with compression, thumbnail preview, and click-to-enlarge. */
export function ImagePickerField({
  label,
  value,
  onChange,
  required = false,
  hint,
  className,
  disabled = false,
  compressOptions,
  roundPreview = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, compressOptions);
      onChange(compressed);
    } catch {
      setError("تعذر معالجة الصورة. جرّب صورة أخرى.");
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("block text-sm", className)}>
      <span className="font-medium">
        {label}
        {required ? " *" : " (اختياري)"}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-ink-700/60 dark:text-sand-100/60">{hint}</span>
      ) : null}

      <div className="mt-2 flex flex-wrap items-start gap-3">
        {value?.dataUrl ? (
          <div className="flex flex-col items-center gap-1">
            <ClickableImage
              src={value.dataUrl}
              alt={value.name || label}
              size="lg"
              className={roundPreview ? "rounded-full" : undefined}
            />
            <button
              type="button"
              disabled={disabled || busy}
              className="text-xs text-rose-700 dark:text-rose-300"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              إزالة
            </button>
          </div>
        ) : null}

        <label className="min-w-[12rem] flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || busy}
            className="w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-xs file:text-white dark:file:bg-sand-100 dark:file:text-ink-900"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {busy ? (
            <span className="mt-1 block text-xs text-ink-700/60 dark:text-sand-100/60">
              جاري ضغط الصورة…
            </span>
          ) : value?.name ? (
            <span className="mt-1 block text-xs text-ink-700/60 dark:text-sand-100/60">
              {value.name}
            </span>
          ) : null}
        </label>
      </div>

      {error ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}
