"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { readSession } from "@/lib/session";
import {
  SHIPPING_BATCH_STATUS_LABELS,
  confirmReceivedAtService,
  createReturnShippingBatch,
  createShippingBatch,
  listDevicesEligibleForReturn,
  listDevicesEligibleForShipment,
  listOpsBranches,
  listShippingBatches,
} from "@/lib/shipping-store";
import {
  MANAGER_DECISION_LABELS,
  getDeviceHoldSummary,
  listAwaitingManagerDecisionDevices,
  resolveManagerDecision,
  returnSuspendedDeviceToMaintenance,
} from "@/lib/technician-store";
import { deviceStatusLabel } from "@/lib/branch-store";
import type { ManagerDeviceDecision, Profile, ShippingBatch } from "@/types/domain";

function MaintenanceShippingContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [batches, setBatches] = useState<ShippingBatch[]>([]);
  const [pendingManager, setPendingManager] = useState(
    () => listAwaitingManagerDecisionDevices(),
  );
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

  const branches = useMemo(() => listOpsBranches(), []);
  const eligible = useMemo(() => listDevicesEligibleForShipment(branchId), [branchId, batches]);
  const returnEligible = useMemo(
    () => listDevicesEligibleForReturn(returnBranchId),
    [returnBranchId, batches, pendingManager],
  );

  function refresh() {
    setBatches(listShippingBatches());
    setPendingManager(listAwaitingManagerDecisionDevices());
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    refresh();
    const first = listOpsBranches()[0]?.id ?? "";
    setBranchId((current) => current || first);
    setReturnBranchId((current) => current || first);
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const branchName = branches.find((item) => item.id === branchId)?.name ?? "فرع";
  const returnBranchName = branches.find((item) => item.id === returnBranchId)?.name ?? "فرع";

  return (
    <div className="space-y-6">
      <PageHeader
        title="بوالص الشحن — مدير الصيانة"
        description="إرسال أجهزة فرع واحد إلى الصيانة، استلامها بعد تسليم الفرع للشحن، ثم إرجاعها لنفس الفرع."
      />

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-aroma-700">{message}</p> : null}

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">1) بوليصة إرسال إلى الصيانة</h2>
        <p className="mt-1 text-sm text-ink-700/70">أجهزة من فرع واحد فقط. الفرع يؤكد التسليم للشحن قبل الاستلام هنا.</p>
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
                  {branch.name}
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
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">2) بوليصة إرجاع إلى الفرع</h2>
        <p className="mt-1 text-sm text-ink-700/70">
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
              {branches.map((branch) => (
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
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-800">
        <h2 className="font-display text-xl dark:text-sand-50">
          أجهزة معلقة ({pendingManager.length})
        </h2>
        <p className="mt-1 text-sm text-ink-700/70 dark:text-sand-100/70">
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
      </section>

      <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
        <h2 className="font-display text-xl">البوالص</h2>
        <div className="mt-4 space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-ink-700/60">لا توجد بوالص بعد.</p>
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
      </section>
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
    >
      <MaintenanceShippingContent />
    </RoleGuard>
  );
}
