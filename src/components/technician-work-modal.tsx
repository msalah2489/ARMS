"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClickableImage, ImagePlaceholder } from "@/components/clickable-image";
import {
  formatMaintenanceDuration,
  getDeviceAssignmentPath,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { normalizeRole } from "@/lib/auth";
import {
  ACTION_OPTIONS,
  FAULT_CAUSE_OPTIONS,
  HOLD_REASON_LABELS,
  OUTCOME_LABELS,
  TECH_DAMAGE_LABELS,
  getModelSpareParts,
} from "@/lib/technician-catalog";
import {
  CLAIM_RACE_MESSAGE,
  completeTechnicianWork,
  findOpenWorkForDevice,
  holdTechnicianWork,
  markMaintenanceFailed,
  saveTechnicianWork,
  startDeviceWork,
} from "@/lib/technician-store";
import { getAvailableQty } from "@/lib/spare-inventory-store";
import type {
  DamageOption,
  HoldReason,
  MaintenanceOutcome,
  Profile,
  TechnicianDeviceState,
  TechnicianExternalCheck,
  TechnicianWorkRecord,
} from "@/types/domain";

type Props = {
  open: boolean;
  item: TechnicianQueueItem | null;
  technician: Profile;
  onClose: () => void;
  onDone: () => void;
  onClaimError?: (message: string) => void;
};

const TEST_LABELS = {
  power: "تشغيل الجهاز",
  pump: "الضخ",
  light: "الإضاءة",
  sound: "الصوت",
  programming: "البرمجة",
} as const;

const MAINTENANCE_STEPS = [
  { id: "started", label: "تم البدء" },
  { id: "in_progress", label: "جاري الصيانة" },
  { id: "tests", label: "اختبارات إنهاء الصيانة" },
  { id: "closing_notes", label: "ملاحظات الإنهاء" },
  { id: "finish", label: "إنهاء الصيانة" },
] as const;

function emptyTests() {
  return {
    power: null,
    pump: null,
    light: null,
    sound: null,
    programming: null,
  } as Record<keyof typeof TEST_LABELS, boolean | null>;
}

function resolveActiveStepIndex(input: {
  hasStarted: boolean;
  deviceState: TechnicianDeviceState | "";
  externalCheck: TechnicianExternalCheck | "";
  tests: Record<keyof typeof TEST_LABELS, boolean | null>;
  faultCause: string;
  actionTaken: string;
  actionOther: string;
  outcome: MaintenanceOutcome | "";
}): number {
  const testsAllAnswered = Object.values(input.tests).every((value) => value !== null);
  const testsAllPass = Object.values(input.tests).every((value) => value === true);
  const notesReady =
    Boolean(input.faultCause) &&
    Boolean(input.actionTaken) &&
    Boolean(input.outcome) &&
    (input.actionTaken !== "أخرى" || Boolean(input.actionOther.trim()));

  if (!input.hasStarted) return 0;
  if (!input.deviceState && !input.externalCheck) return 1;
  if (!testsAllAnswered || !testsAllPass) return 2;
  if (!notesReady) return 3;
  return 4;
}

export function TechnicianWorkModal({
  open,
  item,
  technician,
  onClose,
  onDone,
  onClaimError,
}: Props) {
  const [work, setWork] = useState<TechnicianWorkRecord | null>(null);
  const [externalCheck, setExternalCheck] = useState<TechnicianExternalCheck | "">("");
  const [damageOptions, setDamageOptions] = useState<DamageOption[]>([]);
  const [damageOtherNote, setDamageOtherNote] = useState("");
  const [deviceState, setDeviceState] = useState<TechnicianDeviceState | "">("");
  const [tests, setTests] = useState(emptyTests);
  const [faultCause, setFaultCause] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [actionOther, setActionOther] = useState("");
  const [spareQty, setSpareQty] = useState<Record<string, number>>({});
  const [returnedMap, setReturnedMap] = useState<Record<string, boolean>>({});
  const [notReturnedReason, setNotReturnedReason] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<MaintenanceOutcome | "">("");
  const [showHold, setShowHold] = useState(false);
  const [holdReason, setHoldReason] = useState<HoldReason | "">("");
  const [holdOtherNote, setHoldOtherNote] = useState("");
  const [failNote, setFailNote] = useState("");
  const [showFail, setShowFail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const hadFailedTestRef = useRef(false);

  useEffect(() => {
    if (!open || !item) return;
    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
    if (assigned && assigned !== technician.id) {
      setWork(null);
      setError(CLAIM_RACE_MESSAGE);
      onClaimError?.(CLAIM_RACE_MESSAGE);
      return;
    }
    const existing = findOpenWorkForDevice(item.device.localId, technician.id);
    setWork(existing);
    setExternalCheck(existing?.externalCheck ?? "");
    setDamageOptions(existing?.damageOptions ?? []);
    setDamageOtherNote(existing?.damageOtherNote ?? "");
    setDeviceState(existing?.deviceState ?? "");
    setTests({
      power: existing?.tests?.power ?? null,
      pump: existing?.tests?.pump ?? null,
      light: existing?.tests?.light ?? null,
      sound: existing?.tests?.sound ?? null,
      programming: existing?.tests?.programming ?? null,
    });
    setFaultCause(existing?.faultCause ?? "");
    setActionTaken(existing?.actionTaken ?? "");
    setActionOther(existing?.actionOther ?? "");
    const qty: Record<string, number> = {};
    for (const part of existing?.sparePartsUsed ?? []) qty[part.partId] = part.qty;
    setSpareQty(qty);
    const returned: Record<string, boolean> = {};
    const reasons: Record<string, string> = {};
    for (const accessory of existing?.returnedAccessories ?? []) {
      returned[accessory.accessoryId] = accessory.returned;
      if (accessory.notReturnedReason) reasons[accessory.accessoryId] = accessory.notReturnedReason;
    }
    setReturnedMap(returned);
    setNotReturnedReason(reasons);
    setOutcome(existing?.outcome ?? "");
    setShowHold(false);
    setHoldReason("");
    setHoldOtherNote("");
    setFailNote("");
    setShowFail(false);
    setError(null);
    hadFailedTestRef.current = false;
  }, [open, item, technician.id]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [open]);

  const showClosing = useMemo(() => {
    return Object.values(tests).every((value) => value === true);
  }, [tests]);

  /** Any «لا يعمل» hides finish — only return-to-supervisor remains. */
  const hasFailedTest = useMemo(() => {
    return Object.values(tests).some((value) => value === false);
  }, [tests]);

  const showFinishProcess = showClosing && !hasFailedTest;

  // Derive hold / error UI from current tests — collapse forced return after recovery only.
  useEffect(() => {
    const clearTestErrors = (prev: string | null) => {
      if (!prev) return null;
      if (
        prev.includes("اختبارات إنهاء") ||
        prev.includes("نجاح الاختبارات") ||
        prev.includes("فشل أحد اختبارات")
      ) {
        return null;
      }
      return prev;
    };

    if (hasFailedTest) {
      hadFailedTestRef.current = true;
      setShowHold(true);
      setShowFail(false);
      setError(clearTestErrors);
      return;
    }

    if (hadFailedTestRef.current) {
      hadFailedTestRef.current = false;
      setShowHold(false);
      setHoldReason("");
      setHoldOtherNote("");
      setError(clearTestErrors);
    }
  }, [hasFailedTest]);

  if (!open || !item) return null;

  const spareParts = getModelSpareParts(item.device.modelId);
  const isResume = Boolean(work);
  const isMobilePath =
    normalizeRole(technician.role) === "mobile_technician" ||
    getDeviceAssignmentPath(item.request, item.device) === "mobile_technician";

  function ensureWork(): TechnicianWorkRecord | null {
    if (work) return work;
    const existing = findOpenWorkForDevice(item!.device.localId, technician.id);
    if (existing) {
      setWork(existing);
      return existing;
    }
    const result = startDeviceWork(item!, technician);
    if (!result.ok) {
      setError(result.error);
      onClaimError?.(result.error);
      return null;
    }
    setWork(result.record);
    return result.record;
  }

  function patchWork(partial: Partial<TechnicianWorkRecord>) {
    const base = ensureWork();
    if (!base) return null;
    const next = { ...base, ...partial };
    setWork(next);
    saveTechnicianWork(next);
    return next;
  }

  const startedAt = work?.startedAt ?? item.device.maintenanceStartedAt;
  const hasStarted = Boolean(startedAt);
  const activeStepIndex = resolveActiveStepIndex({
    hasStarted,
    deviceState,
    externalCheck,
    tests,
    faultCause,
    actionTaken,
    actionOther,
    outcome,
  });
  const elapsedLabel = formatMaintenanceDuration(startedAt);
  const accessoryLabels =
    item.device.accessoryNames?.filter((name) => Boolean(name?.trim())) ?? [];

  const sidebar = (
    <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
      <section className="rounded-2xl border border-ink-900/10 bg-sand-50 p-4 dark:border-white/10 dark:bg-ink-950/40">
        <h3 className="font-display text-base text-ink-900 dark:text-sand-50">معلومات الجهاز</h3>
        <div className="mt-3 flex gap-3">
          {item.device.deviceImageDataUrl ? (
            <ClickableImage
              src={item.device.deviceImageDataUrl}
              alt={item.device.deviceCode}
              size="lg"
              className="h-24 w-24"
            />
          ) : (
            <ImagePlaceholder label="بدون صورة" size="lg" className="h-24 w-24" />
          )}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <div>
              <p className="text-xs text-ink-700/60 dark:text-sand-100/60">نوع الجهاز</p>
              <p className="font-medium text-ink-900 dark:text-sand-50">
                {item.device.deviceTypeName || "—"}
              </p>
              <p className="text-xs text-ink-700/55 dark:text-sand-100/55">
                {[item.device.brandName, item.device.modelName].filter(Boolean).join(" · ") ||
                  item.device.deviceCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-700/60 dark:text-sand-100/60">كود الجهاز</p>
              <p className="font-medium text-ink-900 dark:text-sand-50">{item.device.deviceCode}</p>
            </div>
          </div>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-ink-700/60 dark:text-sand-100/60">شكوى العميل</dt>
            <dd className="mt-0.5 font-medium text-ink-900 dark:text-sand-50">
              {item.device.fault?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-700/60 dark:text-sand-100/60">وصف العطل (من الفرع)</dt>
            <dd className="mt-0.5 whitespace-pre-wrap font-medium text-ink-900 dark:text-sand-50">
              {item.device.extraDetails?.trim() || item.device.fault?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-700/60 dark:text-sand-100/60">الملحقات</dt>
            <dd className="mt-1">
              {accessoryLabels.length === 0 ? (
                <span className="text-ink-700/55 dark:text-sand-100/55">لا توجد ملحقات مسجّلة</span>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {accessoryLabels.map((name) => (
                    <li
                      key={name}
                      className="rounded-lg bg-white px-2 py-1 text-xs text-ink-800 dark:bg-ink-900 dark:text-sand-100"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base text-ink-900 dark:text-sand-50">مراحل الصيانة</h3>
          <div className="rounded-xl bg-sand-100 px-3 py-1.5 text-center dark:bg-ink-950">
            <p className="text-[10px] text-ink-700/60 dark:text-sand-100/60">الوقت المنقضي</p>
            <p className="font-display text-sm tabular-nums text-ink-900 dark:text-sand-50">
              {hasStarted ? elapsedLabel : "—"}
            </p>
          </div>
        </div>

        <ol className="mt-4 space-y-2">
          {MAINTENANCE_STEPS.map((step, index) => {
            const done = index < activeStepIndex;
            const active = index === activeStepIndex;
            return (
              <li
                key={step.id}
                className={[
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
                  active
                    ? "border-aroma-500/40 bg-aroma-50 text-ink-900 dark:border-aroma-400/40 dark:bg-aroma-950/40 dark:text-sand-50"
                    : done
                      ? "border-ink-900/10 bg-sand-50 text-ink-800 dark:border-white/10 dark:bg-ink-950/50 dark:text-sand-100"
                      : "border-ink-900/5 bg-white text-ink-700/55 dark:border-white/5 dark:bg-ink-900 dark:text-sand-100/45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    active
                      ? "bg-aroma-600 text-white dark:bg-aroma-500"
                      : done
                        ? "bg-ink-900 text-white dark:bg-sand-100 dark:text-ink-900"
                        : "bg-sand-100 text-ink-700/50 dark:bg-ink-800 dark:text-sand-100/50",
                  ].join(" ")}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className={active ? "font-semibold" : undefined}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-3 sm:p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4 shadow-panel sm:p-6 dark:bg-ink-900 dark:text-sand-50">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">
            {isResume ? "استئناف صيانة الجهاز" : "استلام الجهاز للصيانة"}
          </h2>
          <button
            type="button"
            className="text-sm text-ink-700/70 dark:text-sand-100/70"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
          <div className="min-w-0">
            <dl className="grid gap-3 rounded-xl bg-sand-50 p-4 text-sm sm:grid-cols-3 dark:bg-ink-950/40">
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">نوع الجهاز</dt>
                <dd className="font-medium">{item.device.deviceTypeName}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">كود الجهاز</dt>
                <dd className="font-medium">{item.device.deviceCode}</dd>
              </div>
              <div>
                <dt className="text-ink-700/60 dark:text-sand-100/60">مدة الصيانة</dt>
                <dd className="font-medium tabular-nums">{hasStarted ? elapsedLabel : "—"}</dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                الحالة الخارجية *
                <select
                  value={externalCheck}
                  onChange={(e) => setExternalCheck(e.target.value as TechnicianExternalCheck)}
                  className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                >
                  <option value="">اختر</option>
                  <option value="damaged">به تلفيات</option>
                  <option value="intact">سليم</option>
                </select>
              </label>
              <label className="block text-sm">
                حالة الجهاز *
                <select
                  value={deviceState}
                  onChange={(e) => setDeviceState(e.target.value as TechnicianDeviceState)}
                  className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50"
                >
                  <option value="">اختر</option>
                  <option value="works_fine">يعمل بدون مشكلة</option>
                  <option value="start_maintenance">بدء الصيانة</option>
                </select>
              </label>
            </div>

            {externalCheck === "damaged" ? (
              <div className="mt-4">
                <p className="text-sm font-medium">نوع التلفيات *</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(Object.keys(TECH_DAMAGE_LABELS) as DamageOption[]).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={damageOptions.includes(key)}
                        onChange={(e) =>
                          setDamageOptions((prev) =>
                            e.target.checked ? [...prev, key] : prev.filter((item) => item !== key),
                          )
                        }
                      />
                      {TECH_DAMAGE_LABELS[key]}
                    </label>
                  ))}
                </div>
                {damageOptions.includes("other") ? (
                  <input
                    value={damageOtherNote}
                    onChange={(e) => setDamageOtherNote(e.target.value)}
                    placeholder="وضح نوع التلف (أخرى)"
                    className="mt-3 w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
                  />
                ) : null}
              </div>
            ) : null}

            {deviceState ? (
              <div className="mt-6">
                <h3 className="font-display text-xl">اختبارات إنهاء الصيانة *</h3>
                <div className="mt-3 space-y-3">
                  {(Object.keys(TEST_LABELS) as Array<keyof typeof TEST_LABELS>).map((key) => (
                    <div
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                    >
                      <span className="text-sm font-medium">{TEST_LABELS[key]}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setTests((prev) => ({ ...prev, [key]: true }));
                          }}
                          className={`rounded-full px-3 py-1 text-xs ${
                            tests[key] === true
                              ? "bg-aroma-500 text-white"
                              : "bg-sand-100 dark:bg-ink-800 dark:text-sand-100"
                          }`}
                        >
                          يعمل
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setTests((prev) => ({ ...prev, [key]: false }));
                          }}
                          className={`rounded-full px-3 py-1 text-xs ${
                            tests[key] === false
                              ? "bg-rose-700 text-white"
                              : "bg-sand-100 dark:bg-ink-800 dark:text-sand-100"
                          }`}
                        >
                          لا يعمل
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showClosing ? (
              <div className="mt-6 space-y-4 rounded-2xl border border-ink-900/10 p-4 dark:border-white/10">
                <h3 className="font-display text-xl">بيانات إنهاء العملية</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    سبب العطل *
                    <select
                      value={faultCause}
                      onChange={(e) => setFaultCause(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                    >
                      <option value="">اختر</option>
                      {FAULT_CAUSE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    الإجراء الذي تم *
                    <select
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                    >
                      <option value="">اختر</option>
                      {ACTION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {actionTaken === "أخرى" ? (
                  <input
                    value={actionOther}
                    onChange={(e) => setActionOther(e.target.value)}
                    placeholder="سجّل الإجراء يدويًا"
                    className="w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
                  />
                ) : null}

                <div>
                  <p className="text-sm font-medium">قطع الغيار المستخدمة (تُخصم من المخزون)</p>
                  <div className="mt-2 space-y-2">
                    {spareParts.length === 0 ? (
                      <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                        لا توجد قطع غيار مسجّلة لهذا الموديل.
                      </p>
                    ) : (
                      spareParts.map((part) => {
                        const available = getAvailableQty(item.device.modelId, part.id);
                        return (
                          <div
                            key={part.id}
                            className="flex flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <span>
                              {part.name}
                              {part.color ? (
                                <span className="text-ink-700/60 dark:text-sand-100/60">
                                  {" "}
                                  · لون: {part.color}
                                </span>
                              ) : null}
                              <span className="mr-2 text-xs text-ink-700/50 dark:text-sand-100/50">
                                (المتاح: {available})
                              </span>
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={spareQty[part.id] ?? 0}
                              onChange={(e) =>
                                setSpareQty((prev) => ({
                                  ...prev,
                                  [part.id]: Number(e.target.value),
                                }))
                              }
                              className="w-24 rounded-xl border border-ink-900/15 px-3 py-1 dark:border-white/15 dark:bg-ink-950"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">الملحقات التي تم إرجاعها مع الجهاز</p>
                  <div className="mt-2 space-y-3">
                    {item.device.accessoryIds.length === 0 ? (
                      <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                        لا توجد ملحقات مسجّلة من الفرع.
                      </p>
                    ) : (
                      item.device.accessoryIds.map((id, index) => {
                        const name = item.device.accessoryNames[index] ?? id;
                        const returned = returnedMap[id] ?? false;
                        return (
                          <div
                            key={id}
                            className="rounded-xl border border-ink-900/10 p-3 text-sm dark:border-white/10"
                          >
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={returned}
                                onChange={(e) =>
                                  setReturnedMap((prev) => ({ ...prev, [id]: e.target.checked }))
                                }
                              />
                              إرجاع: {name}
                            </label>
                            {!returned ? (
                              <input
                                value={notReturnedReason[id] ?? ""}
                                onChange={(e) =>
                                  setNotReturnedReason((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                placeholder="سبب عدم الإرجاع (إلزامي)"
                                className="mt-2 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                              />
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <label className="block text-sm">
                  النتيجة النهائية *
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as MaintenanceOutcome)}
                    className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-950"
                  >
                    <option value="">اختر</option>
                    {(Object.keys(OUTCOME_LABELS) as MaintenanceOutcome[]).map((key) => (
                      <option key={key} value={key}>
                        {OUTCOME_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {showHold ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/40">
                <h3 className="font-display text-lg dark:text-sand-50">إرجاع الجهاز للمشرف</h3>
                <p className="mt-1 text-xs text-ink-700/70 dark:text-sand-100/70">
                  سيُحرَّر الجهاز من عملك وتظهر لك الأجهزة الجاهزة للصيانة فورًا. المشرف يمكنه إعادة
                  الجهاز لطابور الصيانة لاحقًا.
                </p>
                <label className="mt-3 block text-sm dark:text-sand-100">
                  سبب الإرجاع *
                  <select
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value as HoldReason)}
                    className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
                  >
                    <option value="">اختر</option>
                    {(Object.keys(HOLD_REASON_LABELS) as HoldReason[]).map((key) => (
                      <option key={key} value={key}>
                        {HOLD_REASON_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                {holdReason === "other" ? (
                  <input
                    value={holdOtherNote}
                    onChange={(e) => setHoldOtherNote(e.target.value)}
                    placeholder="سجّل سبب الإرجاع"
                    className="mt-3 w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
                  />
                ) : null}
              </div>
            ) : null}

            {isMobilePath && showFail ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/40">
                <h3 className="font-display text-lg">تعذر الصيانة</h3>
                <p className="mt-1 text-xs text-ink-700/70 dark:text-sand-100/70">
                  بعد التأكيد يمكنك إرجاع الجهاز لموظف الفرع للشحن، أو شحنه مباشرة لمركز الصيانة من
                  صفحة عمل الفني.
                </p>
                <input
                  value={failNote}
                  onChange={(e) => setFailNote(e.target.value)}
                  placeholder="ملاحظة اختيارية عن سبب التعذر"
                  className="mt-3 w-full rounded-xl border border-ink-900/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-ink-950"
                />
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {!isResume ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    const created = ensureWork();
                    if (!created) return;
                  }}
                  className="rounded-full bg-aroma-600 px-5 py-2.5 text-sm text-white"
                >
                  بدء العمل على الجهاز
                </button>
              ) : null}
              {showFinishProcess ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (!externalCheck || !deviceState) {
                      setError("اختر الحالة الخارجية وحالة الجهاز.");
                      return;
                    }
                    if (externalCheck === "damaged") {
                      if (!damageOptions.length) {
                        setError("حدد نوع التلفيات.");
                        return;
                      }
                      if (damageOptions.includes("other") && !damageOtherNote.trim()) {
                        setError("وضح نوع التلف عند اختيار أخرى.");
                        return;
                      }
                    }
                    if (!Object.values(tests).every((value) => value !== null)) {
                      setError("أكمل اختبارات إنهاء الصيانة الخمسة.");
                      return;
                    }
                    if (!showClosing) {
                      setError("يجب نجاح الاختبارات الخمسة قبل إنهاء العملية.");
                      return;
                    }
                    if (!faultCause || !actionTaken || !outcome) {
                      setError("أكمل سبب العطل والإجراء والنتيجة النهائية.");
                      return;
                    }
                    if (actionTaken === "أخرى" && !actionOther.trim()) {
                      setError("سجّل الإجراء يدويًا.");
                      return;
                    }
                    for (const id of item.device.accessoryIds) {
                      if (!(returnedMap[id] ?? false) && !(notReturnedReason[id] ?? "").trim()) {
                        setError("سبب عدم إرجاع الملحق إلزامي لكل ملحق غير مُرجع.");
                        return;
                      }
                    }

                    const record = patchWork({
                      externalCheck,
                      damageOptions,
                      damageOtherNote,
                      deviceState,
                      tests,
                      faultCause,
                      actionTaken,
                      actionOther,
                      sparePartsUsed: spareParts
                        .filter((part) => (spareQty[part.id] ?? 0) > 0)
                        .map((part) => ({
                          partId: part.id,
                          partName: part.name,
                          qty: spareQty[part.id] ?? 0,
                          color: part.color,
                        })),
                      returnedAccessories: item.device.accessoryIds.map((id, index) => ({
                        accessoryId: id,
                        accessoryName: item.device.accessoryNames[index] ?? id,
                        returned: returnedMap[id] ?? false,
                        notReturnedReason: notReturnedReason[id],
                      })),
                      outcome,
                    });
                    if (!record) return;
                    const result = completeTechnicianWork(record, {
                      modelId: item.device.modelId,
                      modelName: item.device.modelName,
                      user: technician,
                    });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    onDone();
                  }}
                  className="rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white dark:bg-sand-100 dark:text-ink-900"
                >
                  إنهاء العملية
                </button>
              ) : null}
              {hasFailedTest ? (
                <p className="w-full text-sm text-rose-700 dark:text-rose-300">
                  فشل أحد اختبارات الإنهاء — استخدم «إرجاع للمشرف» فقط.
                </p>
              ) : null}
              {isMobilePath ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!showFail) {
                      setShowFail(true);
                      setShowHold(false);
                      return;
                    }
                    setError(null);
                    const record = patchWork({
                      externalCheck: externalCheck || undefined,
                      deviceState: deviceState || undefined,
                      tests,
                      outcome: "not_repairable",
                    });
                    if (!record) return;
                    markMaintenanceFailed(record, failNote);
                    onDone();
                  }}
                  className="rounded-full border border-rose-400 px-5 py-2.5 text-sm text-rose-800 dark:border-rose-700 dark:text-rose-300"
                >
                  {showFail ? "تأكيد تعذر الصيانة" : "تعذر الصيانة"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!showHold) {
                    setShowHold(true);
                    setShowFail(false);
                    return;
                  }
                  setError(null);
                  if (!holdReason) {
                    setError("سبب الإرجاع للمشرف إلزامي.");
                    return;
                  }
                  if (holdReason === "other" && !holdOtherNote.trim()) {
                    setError("سجّل سبب الإرجاع.");
                    return;
                  }
                  const record = patchWork({
                    externalCheck: externalCheck || undefined,
                    deviceState: deviceState || undefined,
                    tests,
                    holdReason,
                    holdOtherNote,
                  });
                  if (!record) return;
                  holdTechnicianWork(record);
                  onDone();
                }}
                className="rounded-full border border-rose-300 px-5 py-2.5 text-sm text-rose-700 dark:border-rose-700 dark:text-rose-300"
              >
                {showHold ? "تأكيد الإرجاع للمشرف" : "إرجاع للمشرف"}
              </button>
            </div>
          </div>

          {/* In RTL: second grid column sits visually on the left */}
          <div className="order-first lg:order-none">{sidebar}</div>
        </div>
      </div>
    </div>
  );
}
