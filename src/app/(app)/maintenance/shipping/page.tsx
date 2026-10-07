"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExpandableSection } from "@/components/expandable-section";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { readSession } from "@/lib/session";
import {
  SHIPPING_BATCH_STATUS_LABELS,
  confirmReceivedAtService,
  createReturnShippingBatch,
  createShippingBatch,
  listBranchesReadyToShip,
  listDevicesEligibleForReturn,
  listDevicesEligibleForShipment,
  listOpsBranchesWithReadyCounts,
  listShippingBatches,
  type BranchReadyToShipSummary,
} from "@/lib/shipping-store";
import {
  MANAGER_DECISION_LABELS,
  getDeviceHoldSummary,
  listAwaitingManagerDecisionDevices,
  listMobilePathDevicesAtBranch,
  resolveManagerDecision,
  returnSuspendedDeviceToMaintenance,
} from "@/lib/technician-store";
import {
  deviceStatusLabel,
  formatMaintenanceDuration,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type { ManagerDeviceDecision, Profile, ShippingBatch } from "@/types/domain";

function MaintenanceShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [pendingManager, setPendingManager] = useState(
    () => listAwaitingManagerDecisionDevices(),
  );
  const [mobileAtBranch, setMobileAtBranch] = useState(() => listMobilePathDevicesAtBranch());
  const [readyBranches, setReadyBranches] = useState<BranchReadyToShipSummary[]>([]);
  const [branches, setBranches] = useState(() => listOpsBranchesWithReadyCounts());
  const [branchId, setBranchId] = useState("");
  const [returnBranchId, setReturnBranchId] = useState("");
  const [shipmentNumber, setShipmentNumber] = useState("");
  const [returnShipmentNumber, setReturnShipmentNumber] = useState("");
  const [carrier, setCarrier] = useState("SMSA");
  const [returnCarrier, setReturnCarrier] = useState("SMSA");
  const [notes, setNotes] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [returnSelected, setReturnSelected] = useState<string[]>([]);
  const [managerDraft, setManagerDraft] = useState<
    Record<string, { decision: ManagerDeviceDecision | ""; note: string }>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = useMemo(() => listDevicesEligibleForShipment(branchId), [branchId, batches, readyBranches]);
  const returnEligible = useMemo(
    () => listDevicesEligibleForReturn(returnBranchId),
    [returnBranchId, batches, pendingManager],
  );

  function refresh() {
    setBatches(listShippingBatches());
    setPendingManager(listAwaitingManagerDecisionDevices());
    setMobileAtBranch(listMobilePathDevicesAtBranch());
    setReadyBranches(listBranchesReadyToShip());
    setBranches(listOpsBranchesWithReadyCounts());
  }

  useEffect(() => {
    function load() {
      const session = readSession();
      setUser(session);
      refresh();
      const preferred =
        listBranchesReadyToShip()[0]?.branchId ??
        listOpsBranchesWithReadyCounts()[0]?.id ??
        "";
      setBranchId((current) => current || preferred);
      setReturnBranchId((current) => current || preferred);
    }

    load();
    void hydrateOpsFromSupabase().then(() => load());
    return subscribeMaintenanceRequestsChanged(load);
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const branchName = branches.find((item) => item.id === branchId)?.name ?? "فرع";
  const returnBranchName = branches.find((item) => item.id === returnBranchId)?.name ?? "فرع";
  const readyDeviceTotal = readyBranches.reduce((sum, item) => sum + item.readyCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="بوليصات الشحن — مدير الصيانة"
        description="إرسال أجهزة فرع واحد إلى الصيانة، استلامها بعد تسليم الفرع للشحن، ثم إرجاعها لنفس الفرع."
        action={
          <>
            <Link
              href="/service-requests/new"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
            >
              طلب جديد
            </Link>
            <Link
              href="/spare-parts"
              className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
            >
              استلام قطع
            </Link>
          </>
        }
      />

      {error ? <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700 dark:text-aroma-200">{message}</p> : null}

      <ExpandableSection title="صيانة بالفرع (فني متنقل)" defaultOpen={mobileAtBranch.length > 0}>
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          أجهزة معيّنة للفني المتنقل — ظاهرة لمدير/مشرف الصيانة ومدير النظام. لا تظهر لفنّيي مركز
          الصيانة.
        </p>
        <div className="mt-3 space-y-2">
          {mobileAtBranch.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد أجهزة في مسار الفني المتنقل حاليًا.</p>
          ) : (
            mobileAtBranch.map(({ request, device }) => (
              <div
                key={`mob-${request.id}-${device.localId}`}
                className="rounded-xl border border-ink-900/10 px-3 py-3 text-sm dark:border-white/10"
              >
                <p className="font-medium dark:text-sand-50">
                  {device.deviceCode} · {request.requestNumber} · {request.opsBranchName}
                </p>
                <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                  {deviceStatusLabel(device.lifecycleStatus, "technician")}
                  {device.assignedTechnicianName
                    ? ` · الفني: ${device.assignedTechnicianName}`
                    : " · بانتظار فني متنقل"}
                  {device.maintenanceStartedAt
                    ? ` · المدة: ${formatMaintenanceDuration(
                        device.maintenanceStartedAt,
                        device.maintenanceFinishedAt,
                      )}`
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </ExpandableSection>

      <ExpandableSection title="1) بوليصة إرسال إلى الصيانة" defaultOpen>
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">أجهزة من فرع واحد فقط. الفرع يؤكد التسليم للشحن قبل الاستلام هنا.</p>

        <div className="mt-4 rounded-2xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink-800 dark:text-sand-100">
              فروع لديها أجهزة جاهزة للإرسال إلى مركز الصيانة
            </p>
            <p className="text-xs text-ink-700/65 dark:text-sand-100/65">
              {readyBranches.length === 0
                ? "لا توجد أجهزة جاهزة حاليًا"
                : `${readyBranches.length} فرع · ${readyDeviceTotal} جهاز`}
            </p>
          </div>
          {readyBranches.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {readyBranches.map((branch) => {
                const selectedBranch = branch.branchId === branchId;
                return (
                  <button
                    key={branch.branchId}
                    type="button"
                    onClick={() => {
                      setBranchId(branch.branchId);
                      setSelected([]);
                    }}
                    className={[
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selectedBranch
                        ? "border-aroma-500 bg-aroma-600 text-white"
                        : "border-ink-900/15 bg-white text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400",
                    ].join(" ")}
                  >
                    {branch.branchName}
                    <span className="ms-2 font-display text-base">{branch.readyCount}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            الفرع
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelected([]);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.readyCount > 0
                    ? `${branch.name} (${branch.readyCount} جاهز)`
                    : branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            رقم البوليصة *
            <input
              value={shipmentNumber}
              onChange={(e) => setShipmentNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
              placeholder="WB-123456"
            />
          </label>
          <label className="block text-sm">
            شركة الشحن *
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            ملاحظات
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
        </div>

        <h3 className="mt-6 text-sm font-medium">أجهزة متاحة في {branchName}</h3>
        <div className="mt-2 space-y-2">
          {eligible.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا توجد أجهزة متاحة في هذا الفرع.</p>
          ) : (
            eligible.map(({ request, device }) => (
              <label
                key={device.localId}
                className="flex items-start gap-3 rounded-xl border border-ink-900/10 px-3 py-3 text-sm"
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
                  <span className="font-medium">{device.deviceCode}</span> · {device.modelName} ·{" "}
                  {request.requestNumber}
                </span>
              </label>
            ))
          )}
        </div>

        <button
          type="button"
          className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            const result = createShippingBatch({
              user,
              shipmentNumber,
              carrier,
              opsBranchId: branchId,
              sourceName: branchName,
              deviceLocalIds: selected,
              notes,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(`تم إنشاء بوليصة الإرسال ${result.batch.batchNumber}. الحالة: جاري الشحن.`);
            setShipmentNumber("");
            setSelected([]);
            refresh();
          }}
        >
          إنشاء بوليصة الإرسال
        </button>
      </ExpandableSection>

      <ExpandableSection title="2) بوليصة إرجاع إلى الفرع" defaultOpen={false}>
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          أجهزة جاهزة للإرجاع تخص فرعًا واحدًا؛ الوجهة = نفس الفرع الوارد منه.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            الفرع الوجهة
            <select
              value={returnBranchId}
              onChange={(e) => {
                setReturnBranchId(e.target.value);
                setReturnSelected([]);
              }}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            >
              {[...branches]
                .sort((a, b) => a.name.localeCompare(b.name, "ar"))
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            رقم البوليصة *
            <input
              value={returnShipmentNumber}
              onChange={(e) => setReturnShipmentNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            شركة الشحن *
            <input
              value={returnCarrier}
              onChange={(e) => setReturnCarrier(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            ملاحظات
            <input
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2"
            />
          </label>
        </div>

        <h3 className="mt-6 text-sm font-medium">جاهز للإرجاع → {returnBranchName}</h3>
        <div className="mt-2 space-y-2">
          {returnEligible.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا توجد أجهزة جاهزة للإرجاع لهذا الفرع.</p>
          ) : (
            returnEligible.map(({ request, device }) => (
              <label
                key={device.localId}
                className="flex items-start gap-3 rounded-xl border border-ink-900/10 px-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={returnSelected.includes(device.localId)}
                  onChange={(e) =>
                    setReturnSelected((prev) =>
                      e.target.checked
                        ? [...prev, device.localId]
                        : prev.filter((id) => id !== device.localId),
                    )
                  }
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{device.deviceCode}</span> · {device.modelName} ·{" "}
                  {request.requestNumber}
                </span>
              </label>
            ))
          )}
        </div>

        <button
          type="button"
          className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-sm text-white"
          onClick={() => {
            setError(null);
            setMessage(null);
            const result = createReturnShippingBatch({
              user,
              shipmentNumber: returnShipmentNumber,
              carrier: returnCarrier,
              opsBranchId: returnBranchId,
              destinationName: returnBranchName,
              deviceLocalIds: returnSelected,
              notes: returnNotes,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(
              `تم إنشاء بوليصة الإرجاع ${result.batch.batchNumber}. الحالة: فى الطريق الى الفرع.`,
            );
            setReturnShipmentNumber("");
            setReturnSelected([]);
            refresh();
          }}
        >
          إنشاء بوليصة الإرجاع
        </button>
      </ExpandableSection>

      <ExpandableSection
        title={`أجهزة معلقة (${pendingManager.length})`}
        defaultOpen={pendingManager.length > 0}
        className="dark:bg-ink-800"
      >
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          أجهزة أرجعها الفني أو تحتاج قرارًا — يمكنك إعادتها للصيانة لتظهر للفنيين كـ«بانتظار الصيانة».
        </p>
        <div className="mt-4 space-y-3">
          {pendingManager.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد أجهزة معلقة.</p>
          ) : (
            pendingManager.map((item) => {
              const key = `${item.request.id}:${item.device.localId}`;
              const draft = managerDraft[key] ?? { decision: "", note: "" };
              const hold = getDeviceHoldSummary(item.request.id, item.device.localId);
              return (
                <div
                  key={key}
                  className="rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-white/10"
                >
                  <p className="font-medium dark:text-sand-50">
                    {item.device.deviceCode} · {item.request.requestNumber}
                  </p>
                  <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                    {item.request.opsBranchName} · {item.device.modelName} ·{" "}
                    {deviceStatusLabel(item.device.lifecycleStatus, "technician")}
                  </p>
                  {hold ? (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                      {hold.technicianName} · {hold.reason}
                    </p>
                  ) : null}
                  {item.device.extraDetails ? (
                    <p className="mt-1 text-xs text-ink-700/50 dark:text-sand-100/50">
                      {item.device.extraDetails}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-aroma-600 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        const result = returnSuspendedDeviceToMaintenance({
                          user,
                          requestId: item.request.id,
                          deviceLocalId: item.device.localId,
                          note: draft.note,
                        });
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        setMessage(
                          `أُعيد الجهاز ${item.device.deviceCode} للصيانة — أصبح متاحًا للفنيين.`,
                        );
                        setManagerDraft((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        refresh();
                      }}
                    >
                      إعادة للصيانة
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block dark:text-sand-100">
                      قرار آخر (اختياري)
                      <select
                        value={draft.decision}
                        onChange={(e) =>
                          setManagerDraft((prev) => ({
                            ...prev,
                            [key]: {
                              ...draft,
                              decision: e.target.value as ManagerDeviceDecision | "",
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
                      >
                        <option value="">اختر القرار</option>
                        {(Object.keys(MANAGER_DECISION_LABELS) as ManagerDeviceDecision[])
                          .filter((decision) => decision !== "requeue_technician")
                          .map((decision) => (
                            <option key={decision} value={decision}>
                              {MANAGER_DECISION_LABELS[decision]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block dark:text-sand-100">
                      ملاحظة (اختياري)
                      <input
                        value={draft.note}
                        onChange={(e) =>
                          setManagerDraft((prev) => ({
                            ...prev,
                            [key]: { ...draft, note: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="mt-3 rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-700"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      if (!draft.decision) {
                        setError("اختر قرارًا للجهاز أو استخدم «إعادة للصيانة».");
                        return;
                      }
                      const result = resolveManagerDecision({
                        user,
                        requestId: item.request.id,
                        deviceLocalId: item.device.localId,
                        decision: draft.decision,
                        note: draft.note,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setMessage(
                        `تم تطبيق «${MANAGER_DECISION_LABELS[draft.decision]}» على ${item.device.deviceCode}.`,
                      );
                      setManagerDraft((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      });
                      refresh();
                    }}
                  >
                    تنفيذ القرار
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ExpandableSection>

      <ExpandableSection title="قائمة بوليصات الشحن" defaultOpen>
        <div className="space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-ink-700/60 dark:text-sand-100/60">لا توجد بوليصات بعد.</p>
          ) : (
            batches.map((batch) => {
              const activeItems = batch.items.filter((item) => item.status === "active");
              const canReceive =
                batch.direction === "to_service" &&
                batch.status === "handed_to_carrier" &&
                activeItems.length > 0;

              return (
                <div key={batch.id} className="rounded-xl border border-ink-900/10 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {batch.batchNumber} · {batch.direction === "return" ? "إرجاع" : "إرسال"} ·{" "}
                      {batch.shipmentNumber}
                    </p>
                    <span className="text-xs text-ink-700/60">
                      {SHIPPING_BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-700/70">
                    من {batch.sourceName} إلى {batch.destinationName} · {activeItems.length} جهاز
                  </p>
                  <p className="mt-1 text-xs text-ink-700/50">
                    {activeItems.map((item) => item.deviceCode).join("، ") || "—"}
                  </p>
                  {batch.status === "ready" && batch.direction === "to_service" ? (
                    <p className="mt-2 text-xs text-ink-700/60">
                      بانتظار تأكيد الفرع للتسليم لشركة الشحن.
                    </p>
                  ) : null}
                  {canReceive ? (
                    <button
                      type="button"
                      className="mt-3 rounded-full bg-aroma-600 px-4 py-2 text-sm text-white"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        const result = confirmReceivedAtService({ user, batchId: batch.id });
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        setMessage(
                          `تم استلام ${batch.batchNumber}. الأجهزة بانتظار الصيانة لدى الفنيين.`,
                        );
                        refresh();
                      }}
                    >
                      استلام البوليصة في مركز الصيانة
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </ExpandableSection>
    </div>
  );
}

export default function MaintenanceShippingPage() {
  return (
    <RoleGuard
      allow={[
        "maintenance_manager",
        "maintenance_supervisor",
        "system_admin",
        "manager",
        "supervisor",
      ]}
      permission={["receive_inbound_waybill", "create_return_waybill", "manager_decisions"]}
    >
      <MaintenanceShippingContent />
    </RoleGuard>
  );
}
