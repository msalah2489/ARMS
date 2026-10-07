"use client";

import { useEffect, useMemo, useState } from "react";
import { ExpandableSection } from "@/components/expandable-section";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { deviceStatusLabel, subscribeMaintenanceRequestsChanged } from "@/lib/branch-store";
import { readSession } from "@/lib/session";
import {
  REPAIRABLE_SHIPPING_STATUSES,
  canRepairShippingStatus,
  listRepairBatchOptions,
  listShippingStatusInconsistencies,
  repairDeviceShippingStatus,
  repairInconsistentShippingStatuses,
  repairStatusNeedsBatch,
  type RepairBatchOption,
  type RepairableShippingStatus,
  type ShippingStatusInconsistency,
} from "@/lib/shipping-store";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type { Profile } from "@/types/domain";

const inputClass =
  "mt-1 w-full rounded-xl border border-ink-900/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50";

const STATUS_OPTIONS: Array<{ value: RepairableShippingStatus | ""; label: string }> = [
  { value: "", label: "تلقائي (حسب البوليصة أو إزالة القفل)" },
  { value: "received_at_branch", label: deviceStatusLabel("received_at_branch") },
  { value: "in_transit_to_service", label: deviceStatusLabel("in_transit_to_service") },
  { value: "excluded_from_shipment", label: deviceStatusLabel("excluded_from_shipment") },
  { value: "ready_to_return", label: deviceStatusLabel("ready_to_return") },
  { value: "in_return_transit", label: deviceStatusLabel("in_return_transit") },
];

function ShippingRepairContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [issues, setIssues] = useState<ShippingStatusInconsistency[]>([]);
  const [deviceCode, setDeviceCode] = useState("ARMS-MUY1TC0E-336");
  const [targetStatus, setTargetStatus] = useState<RepairableShippingStatus | "">("");
  const [batchId, setBatchId] = useState("");
  const [batchOptions, setBatchOptions] = useState<RepairBatchOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setIssues(listShippingStatusInconsistencies());
  }

  function refreshBatchOptions(code: string, status: RepairableShippingStatus | "") {
    const options = listRepairBatchOptions({
      deviceLocalIdOrCode: code,
      forStatus: status,
    });
    setBatchOptions(options);
    setBatchId((prev) => {
      if (prev && options.some((opt) => opt.id === prev)) return prev;
      const onDevice = options.find((opt) => opt.containsDevice);
      return onDevice?.id ?? "";
    });
  }

  useEffect(() => {
    function load() {
      setUser(readSession());
      refresh();
      refreshBatchOptions(deviceCode, targetStatus);
    }
    load();
    void hydrateOpsFromSupabase().then(() => load());
    return subscribeMaintenanceRequestsChanged(load);
    // deviceCode/targetStatus refreshed explicitly on change; hydrate subscription is mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBatchPicker = useMemo(() => {
    if (repairStatusNeedsBatch(targetStatus)) return true;
    // Auto mode: still useful when the device already sits on an open waybill.
    return targetStatus === "" && batchOptions.some((opt) => opt.containsDevice);
  }, [targetStatus, batchOptions]);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">جاري التحميل…</p>;
  }

  if (!canRepairShippingStatus(user)) {
    return (
      <p className="text-sm text-rose-700 dark:text-rose-300">
        تحتاج صلاحية «إصلاح حالات الشحن غير المتسقة» لاستخدام هذه الصفحة.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إصلاح حالات الشحن"
        description="مزامنة حالة الجهاز مع البوليصات النشطة، وإزالة أقفال الشحن العالقة بعد سباق المزامنة."
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? (
        <p className="whitespace-pre-wrap text-sm text-aroma-700 dark:text-aroma-200">{message}</p>
      ) : null}

      <ExpandableSection title="إصلاح كل التناقضات" defaultOpen>
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          يمر على الطلبات والبوالص النشطة: إن كان الجهاز على بوليصة جاهزة/مُسلَّمة للشحن تُضبط حالته
          إلى «جاري الشحن»، وإن كان عالقاً بقفل شحن دون بوليصة يُعاد مؤهلاً للإرسال. لا يغيّر
          عضوية البوليصات — الإصلاح الجماعي يصحّح الحالة فقط.
        </p>
        <p className="mt-2 text-sm dark:text-sand-50">
          التناقضات المكتشفة الآن:{" "}
          <span className="font-medium">{issues.length}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-50 dark:bg-sand-50 dark:text-ink-900"
          onClick={() => {
            setBusy(true);
            setError(null);
            setMessage(null);
            try {
              const result = repairInconsistentShippingStatuses({ user });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(
                result.fixed === 0
                  ? "لا توجد تناقضات لإصلاحها."
                  : `تم إصلاح ${result.fixed} جهاز/أجهزة.\n${result.details.join("\n")}`,
              );
              refresh();
              refreshBatchOptions(deviceCode, targetStatus);
            } finally {
              setBusy(false);
            }
          }}
        >
          إصلاح حالات الشحن غير المتسقة
        </button>
      </ExpandableSection>

      <ExpandableSection title="تصحيح جهاز واحد" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm dark:text-sand-100">
            كود الجهاز
            <input
              className={inputClass}
              value={deviceCode}
              onChange={(event) => {
                const next = event.target.value;
                setDeviceCode(next);
                refreshBatchOptions(next, targetStatus);
              }}
              placeholder="ARMS-MUY1TC0E-336"
            />
          </label>
          <label className="block text-sm dark:text-sand-100">
            الحالة المستهدفة
            <select
              className={inputClass}
              value={targetStatus}
              onChange={(event) => {
                const next = event.target.value as RepairableShippingStatus | "";
                setTargetStatus(next);
                refreshBatchOptions(deviceCode, next);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "auto"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {showBatchPicker ? (
          <div className="mt-4 space-y-2">
            <label className="block text-sm dark:text-sand-100">
              البوليصة
              <select
                className={inputClass}
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
              >
                <option value="">
                  {repairStatusNeedsBatch(targetStatus)
                    ? "— اختر بوليصة مفتوحة —"
                    : "— تلقائي (أول بوليصة نشطة للجهاز) —"}
                </option>
                {batchOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
              عند اختيار بوليصة لحالة إرسال أو إرجاع: يُربط الجهاز كعنصر نشط عليها إن لم يكن
              موجوداً (وتُزال عضويته من أي بوليصة مفتوحة أخرى)، ثم تُضبط حالته لتطابق اتجاه
              البوليصة. إن كان الجهاز أصلاً على البوليصة تُحدَّث الحالة فقط.
            </p>
            {batchOptions.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-200">
                لا توجد بوالص مفتوحة مناسبة لهذا الجهاز/الاتجاه. أنشئ بوليصة أولاً أو اختر حالة
                لا تتطلب بوليصة.
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={
            busy ||
            !deviceCode.trim() ||
            (repairStatusNeedsBatch(targetStatus) && !batchId && !batchOptions.some((o) => o.containsDevice))
          }
          className="mt-4 rounded-xl border border-ink-900/15 px-4 py-2 text-sm dark:border-white/15 dark:text-sand-50 disabled:opacity-50"
          onClick={() => {
            setBusy(true);
            setError(null);
            setMessage(null);
            try {
              const result = repairDeviceShippingStatus({
                user,
                deviceLocalIdOrCode: deviceCode,
                targetStatus: targetStatus || undefined,
                batchId: batchId || undefined,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(
                `${result.deviceCode}: ${result.before} → ${result.after}. ${result.note}`,
              );
              refresh();
              refreshBatchOptions(deviceCode, targetStatus);
            } finally {
              setBusy(false);
            }
          }}
        >
          إصلاح هذا الجهاز
        </button>
        <p className="mt-2 text-xs text-ink-700/50 dark:text-sand-100/50">
          الحالات المسموحة يدوياً: {REPAIRABLE_SHIPPING_STATUSES.join(" · ")}
        </p>
      </ExpandableSection>

      <ExpandableSection title="التناقضات الحالية" defaultOpen={issues.length > 0}>
        {issues.length === 0 ? (
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">لا توجد تناقضات مكتشفة.</p>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={`${issue.deviceLocalId}-${issue.issue}`}
                className="rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <p className="font-medium dark:text-sand-50">
                  {issue.deviceCode}{" "}
                  <span className="text-xs font-normal text-ink-700/60 dark:text-sand-100/60">
                    · {issue.opsBranchName}
                  </span>
                </p>
                <p className="mt-1 text-ink-700/80 dark:text-sand-100/80">{issue.issue}</p>
                <p className="mt-1 text-xs text-ink-700/60 dark:text-sand-100/60">
                  الآن: {deviceStatusLabel(issue.currentStatus)}
                  {issue.currentLocked ? " · مقفول بعد الشحن" : ""} → المقترح:{" "}
                  {deviceStatusLabel(issue.suggestedStatus)}
                  {issue.batchShipmentNumber
                    ? ` · بوليصة ${issue.batchShipmentNumber}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-aroma-700 dark:text-aroma-200"
                    onClick={() => {
                      setDeviceCode(issue.deviceCode);
                      setTargetStatus("");
                      setError(null);
                      setMessage(null);
                      const result = repairDeviceShippingStatus({
                        user,
                        deviceLocalIdOrCode: issue.deviceLocalId,
                        batchId: issue.batchId,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(
                        `${result.deviceCode}: ${result.before} → ${result.after}. ${result.note}`,
                      );
                      refresh();
                      refreshBatchOptions(issue.deviceCode, "");
                    }}
                  >
                    إصلاح هذا السطر
                  </button>
                  <button
                    type="button"
                    className="text-ink-700/70 dark:text-sand-100/70"
                    onClick={() => {
                      setDeviceCode(issue.deviceCode);
                      setTargetStatus(
                        issue.suggestedStatus === "in_transit_to_service" ||
                          issue.suggestedStatus === "in_return_transit"
                          ? issue.suggestedStatus
                          : "",
                      );
                      refreshBatchOptions(
                        issue.deviceCode,
                        issue.suggestedStatus === "in_transit_to_service" ||
                          issue.suggestedStatus === "in_return_transit"
                          ? issue.suggestedStatus
                          : "",
                      );
                      if (issue.batchId) setBatchId(issue.batchId);
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    تعبئة النموذج اليدوي
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ExpandableSection>
    </div>
  );
}

export default function ShippingRepairPage() {
  return (
    <RoleGuard
      allow={["system_admin", "manager", "maintenance_manager"]}
      permission="repair_shipping_status"
    >
      <ShippingRepairContent />
    </RoleGuard>
  );
}
