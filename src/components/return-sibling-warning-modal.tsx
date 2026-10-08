"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReturnSiblingGapGroup } from "@/lib/shipping-store";

type Phase = "warn" | "select";

type Props = {
  open: boolean;
  groups: ReturnSiblingGapGroup[];
  onClose: () => void;
  /** Continue creating the bill with the original device selection only. */
  onContinueWithout: () => void;
  /** Add chosen eligible sibling device localIds, then continue create. */
  onAddAndContinue: (deviceLocalIds: string[]) => void;
};

function deviceLine(device: ReturnSiblingGapGroup["missingDevices"][number]) {
  const parts = [device.deviceCode, device.modelName];
  if (device.serialNumber.trim()) parts.push(device.serialNumber.trim());
  return parts.filter(Boolean).join(" · ");
}

export function ReturnSiblingWarningModal({
  open,
  groups,
  onClose,
  onContinueWithout,
  onAddAndContinue,
}: Props) {
  const [phase, setPhase] = useState<Phase>("warn");
  const [selected, setSelected] = useState<string[]>([]);

  const eligible = useMemo(
    () => groups.flatMap((group) => group.missingDevices.filter((d) => d.eligibleForReturn)),
    [groups],
  );

  useEffect(() => {
    if (!open) return;
    setPhase("warn");
    setSelected(
      groups.flatMap((group) =>
        group.missingDevices.filter((d) => d.eligibleForReturn).map((d) => d.localId),
      ),
    );
  }, [open, groups]);

  if (!open || groups.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-sibling-warning-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-panel dark:bg-ink-900"
      >
        {phase === "warn" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2
                id="return-sibling-warning-title"
                className="font-display text-2xl text-ink-900 dark:text-sand-50"
              >
                أجهزة أخرى في نفس الطلب
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-ink-700/70 dark:text-sand-100/70"
              >
                إغلاق
              </button>
            </div>

            <p className="mt-3 text-sm text-ink-700/80 dark:text-sand-100/80">
              البوليصة الحالية لا تشمل كل أجهزة الطلبات التالية. راجع الحالة الحالية لكل جهاز غير
              مدرج:
            </p>

            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div
                  key={group.requestId}
                  className="rounded-xl border border-amber-500/30 bg-amber-50/70 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-950/30"
                >
                  <p className="text-sm font-medium text-ink-900 dark:text-sand-50">
                    الطلب {group.requestNumber}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-800 dark:text-sand-100">
                    {group.missingDevices.map((device) => (
                      <li key={device.localId}>
                        <span className="font-medium">{deviceLine(device)}</span>
                        <span className="text-ink-700/70 dark:text-sand-100/70">
                          {" "}
                          — {device.statusLabel}
                          {device.eligibleForReturn ? " (جاهز للإضافة)" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
                onClick={() => {
                  if (eligible.length === 0) {
                    onContinueWithout();
                    return;
                  }
                  setPhase("select");
                }}
              >
                {eligible.length > 0 ? "إضافة أجهزة" : "متابعة"}
              </button>
              {eligible.length > 0 ? (
                <button
                  type="button"
                  className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                  onClick={onContinueWithout}
                >
                  متابعة بدونها
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                  onClick={onClose}
                >
                  إلغاء
                </button>
              )}
            </div>

            {eligible.length === 0 ? (
              <p className="mt-3 text-xs text-ink-700/60 dark:text-sand-100/60">
                لا توجد أجهزة أخرى جاهزة للإرجاع حاليًا ضمن هذه الطلبات. يمكنك المتابعة بالأجهزة
                المختارة فقط.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2
                id="return-sibling-warning-title"
                className="font-display text-2xl text-ink-900 dark:text-sand-50"
              >
                اختيار أجهزة للإضافة
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-ink-700/70 dark:text-sand-100/70"
              >
                إغلاق
              </button>
            </div>

            <p className="mt-3 text-sm text-ink-700/80 dark:text-sand-100/80">
              اختر الأجهزة الجاهزة للإرجاع التي تريد إضافتها إلى البوليصة (ليس إلزاميًا اختيار الكل).
            </p>

            <div className="mt-4 space-y-2">
              {eligible.map((device) => (
                <label
                  key={device.localId}
                  className="flex items-start gap-3 rounded-xl border border-ink-900/10 px-3 py-3 text-sm dark:border-white/10"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(device.localId)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, device.localId]
                          : prev.filter((id) => id !== device.localId),
                      )
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium dark:text-sand-50">{deviceLine(device)}</span>
                    <span className="block text-xs text-ink-700/60 dark:text-sand-100/60">
                      {device.statusLabel}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-aroma-600"
                onClick={() => onAddAndContinue(selected)}
              >
                إضافة والمتابعة
              </button>
              <button
                type="button"
                className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                onClick={() => setPhase("warn")}
              >
                رجوع
              </button>
              <button
                type="button"
                className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                onClick={onContinueWithout}
              >
                متابعة بدونها
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
