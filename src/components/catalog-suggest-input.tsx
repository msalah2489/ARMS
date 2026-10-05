"use client";

import { useMemo, useState } from "react";
import type { CatalogNameSuggestion } from "@/lib/catalog-store";

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: CatalogNameSuggestion[];
  onPick: (suggestion: CatalogNameSuggestion) => void;
  placeholder?: string;
  className?: string;
  /** Extra note under the field */
  hint?: string;
};

export function CatalogSuggestInput({
  value,
  onChange,
  suggestions,
  onPick,
  placeholder,
  className,
  hint,
}: Props) {
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => {
    if (!open) return [];
    return suggestions;
  }, [open, suggestions]);

  return (
    <div className="relative min-w-[160px] flex-1">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Allow click on suggestion before closing.
          window.setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={
          className ??
          "w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
        }
        autoComplete="off"
      />
      {hint ? <p className="mt-1 text-[11px] text-ink-700/50">{hint}</p> : null}
      {visible.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink-900/10 bg-white py-1 text-sm shadow-panel">
          <li className="px-3 py-1 text-[11px] text-ink-700/50">
            أسماء مشابهة مسجّلة على موديلات أخرى — اختر لتوحيد التسمية
          </li>
          {visible.map((item) => (
            <li key={`${item.name}::${item.color ?? ""}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-right hover:bg-sand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(item);
                  setOpen(false);
                }}
              >
                <span className="font-medium">
                  {item.name}
                  {item.color ? (
                    <span className="font-normal text-ink-700/70"> · لون: {item.color}</span>
                  ) : null}
                </span>
                <span className="text-[11px] text-ink-700/55">
                  مستخدمة في: {item.modelNames.slice(0, 3).join("، ")}
                  {item.modelNames.length > 3 ? "…" : ""} ({item.count})
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
