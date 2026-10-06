"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { PageHeader } from "@/components/page-header";
import { TechnicianWorkModal } from "@/components/technician-work-modal";
import {
  deviceStatusLabel,
  formatMaintenanceDuration,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { normalizeRole } from "@/lib/auth";
import {
  createShippingBatch,
} from "@/lib/shipping-store";
import {
  getEligibleQueueForTechnician,
  listMaintenanceFailedDevices,
  listMyInProgressDevices,
  returnFailedDeviceToBranchEmployee,
  startDeviceWork,
} from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

function TechnicianWorkContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [queue, setQueue] = useState<TechnicianQueueItem[]>([]);
  const [inProgress, setInProgress] = useState<TechnicianQueueItem[]>([]);
  const [failed, setFailed] = useState<TechnicianQueueItem[]>([]);
  const [selected, setSelected] = useState<TechnicianQueueItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shipDraft, setShipDraft] = useState<
    Record<string, { shipmentNumber: string; carrier: string }>
  >({});
  const [, setTick] = useState(0);

  function refresh(session?: Profile | null) {
    const current = session ?? readSession();
    if (!current) return;
    setQueue(getEligibleQueueForTechnician(current));
    setInProgress(listMyInProgressDevices(current.id));
    if (normalizeRole(current.role) === "mobile_technician") {
      setFailed(listMaintenanceFailedDevices(current.opsBranchId));
    } else {
      setFailed([]);
    }
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (session) refresh(session);
  }, []);

  // Refresh elapsed duration display every 30s for in-progress work.
  useEffect(() => {
    if (inProgress.length === 0) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [inProgress.length]);

  const isMobile = useMemo(
    () => (user ? normalizeRole(user.role) === "mobile_technician" : false),
    [user],
  );

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const urgentCount = queue.filter((item) => item.request.priority === "urgent").length;
  const showingUrgentOnly =
    urgentCount > 0 && queue.every((item) => item.request.priority === "urgent");

  return (
    <div className="space-y-6">
      <PageHeader
        title="عمل الفني"
        description={
          isMobile
            ? "أجهزة فرعك بحالة «جاري الصيانة بالفرع». إن وُجد جهاز عاجل يظهر العاجل فقط. عند بدء العمل يختفي الجهاز من طابور الفنيين الآخرين."
            : "أجهزة مركز الصيانة بحالة «بانتظار الصيانة». إن وُجد جهاز عاجل يظهر العاجل فقط. عند بدء العمل يختفي الجهاز من طابور الفنيين الآخرين."
        }
      />

      {claimError ? <p className="text-sm text-rose-700">{claimError}</p> : null}
      {actionMessage ? <p className="text-sm text-aroma-700">{actionMessage}</p> : null}
      {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <p className="text-sm text-ink-700/70">
            {isMobile ? "جاري الصيانة بالفرع" : "بانتظار الصيانة"}
          </p>
          <p className="mt-2 font-display text-4xl">{queue.length}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <p className="text-sm text-ink-700/70">منها عاجلة</p>
          <p className="mt-2 font-display text-4xl">{urgentCount}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <p className="text-sm text-ink-700/70">قيد التنفيذ لديّ</p>
          <p className="mt-2 font-display text-4xl">{inProgress.length}</p>
        </div>
      </div>

      {showingUrgentOnly ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          يوجد أجهزة عاجلة في طابورك — تُعرض العاجلة فقط حتى تُنجز.
        </p>
      ) : null}

      {inProgress.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">استئناف العمل</h2>
          {inProgress.map((item) => (
            <div
              key={`ip-${item.request.id}-${item.device.localId}`}
              className="rounded-2xl border border-amber-200 bg-white p-4 shadow-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.device.deviceCode}{" "}
                    <span className="text-xs text-amber-700">
                      {deviceStatusLabel(item.device.lifecycleStatus, "technician")}
                    </span>
                  </p>
                  <p className="text-sm text-ink-700/70">
                    {item.request.requestNumber} · {item.request.opsBranchName} ·{" "}
                    {item.device.modelName}
                  </p>
                  <p className="mt-1 text-xs text-ink-700/60">
                    مدة الصيانة:{" "}
                    {formatMaintenanceDuration(item.device.maintenanceStartedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClaimError(null);
                    setSelected(item);
                    setModalOpen(true);
                  }}
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm text-white"
                >
                  استئناف العمل
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl">طابور الانتظار</h2>
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 bg-white px-4 py-8 text-sm text-ink-700/70">
            {isMobile
              ? "لا توجد أجهزة معيّنة للفني المتنقل في فرعك حاليًا."
              : "لا توجد أجهزة جاهزة للصيانة في مركز الصيانة. تظهر هنا فقط بعد استلام مدير الصيانة للبوليصة."}
          </p>
        ) : (
          queue.map((item) => (
            <div
              key={`${item.request.id}-${item.device.localId}`}
              className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.device.deviceCode}{" "}
                    <span className="text-xs text-ink-700/60">
                      ({item.request.priority === "urgent" ? "عاجل" : "عادي"})
                    </span>
                  </p>
                  <p className="text-sm text-ink-700/70">
                    {item.request.requestNumber} · {item.request.contactName} ·{" "}
                    {item.request.opsBranchName} · {item.device.deviceTypeName} /{" "}
                    {item.device.modelName}
                  </p>
                  <p className="mt-1 text-xs text-ink-700/60">
                    الشكوى: {item.device.fault || "—"} · الحالة:{" "}
                    {deviceStatusLabel(item.device.lifecycleStatus, "technician")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClaimError(null);
                    const claim = startDeviceWork(item, user);
                    if (!claim.ok) {
                      setClaimError(claim.error);
                      refresh(user);
                      return;
                    }
                    setSelected(item);
                    setModalOpen(true);
                    refresh(user);
                  }}
                  className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
                >
                  استلام الجهاز
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {isMobile && failed.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">تعذر الصيانة — إجراء لاحق</h2>
          <p className="text-sm text-ink-700/70">
            أعد الجهاز لموظف الفرع للشحن، أو اشحنه مباشرة لمركز الصيانة.
          </p>
          {failed.map((item) => {
            const key = item.device.localId;
            const draft = shipDraft[key] ?? { shipmentNumber: "", carrier: "SMSA" };
            return (
              <div
                key={`fail-${item.request.id}-${item.device.localId}`}
                className="space-y-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-panel"
              >
                <div>
                  <p className="font-medium">
                    {item.device.deviceCode}{" "}
                    <span className="text-xs text-rose-700">تعذر الصيانة</span>
                  </p>
                  <p className="text-sm text-ink-700/70">
                    {item.request.requestNumber} · {item.device.modelName}
                  </p>
                  {item.device.maintenanceStartedAt ? (
                    <p className="mt-1 text-xs text-ink-700/60">
                      مدة المحاولة:{" "}
                      {formatMaintenanceDuration(
                        item.device.maintenanceStartedAt,
                        item.device.maintenanceFinishedAt,
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-ink-900/15 px-4 py-2 text-sm"
                    onClick={() => {
                      setActionError(null);
                      setActionMessage(null);
                      const result = returnFailedDeviceToBranchEmployee({
                        user,
                        requestId: item.request.id,
                        deviceLocalId: item.device.localId,
                      });
                      if (!result.ok) {
                        setActionError(result.error);
                        return;
                      }
                      setActionMessage(
                        `أُعيد ${item.device.deviceCode} لموظف الفرع للشحن لمركز الصيانة.`,
                      );
                      refresh(user);
                    }}
                  >
                    إرجاع لموظف الفرع للشحن
                  </button>
                </div>
                <div className="grid gap-2 border-t border-ink-900/10 pt-3 md:grid-cols-3">
                  <input
                    value={draft.shipmentNumber}
                    onChange={(e) =>
                      setShipDraft((prev) => ({
                        ...prev,
                        [key]: { ...draft, shipmentNumber: e.target.value },
                      }))
                    }
                    placeholder="رقم البوليصة *"
                    className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                  />
                  <input
                    value={draft.carrier}
                    onChange={(e) =>
                      setShipDraft((prev) => ({
                        ...prev,
                        [key]: { ...draft, carrier: e.target.value },
                      }))
                    }
                    placeholder="شركة الشحن *"
                    className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-rose-700 px-4 py-2 text-sm text-white"
                    onClick={() => {
                      setActionError(null);
                      setActionMessage(null);
                      if (!user.opsBranchId) {
                        setActionError("حسابك غير مرتبط بفرع.");
                        return;
                      }
                      const result = createShippingBatch({
                        user,
                        shipmentNumber: draft.shipmentNumber,
                        carrier: draft.carrier,
                        opsBranchId: user.opsBranchId,
                        sourceName: user.opsBranchName || "فرع",
                        deviceLocalIds: [item.device.localId],
                        notes: "شحن مباشر من الفني المتنقل بعد تعذر الصيانة",
                      });
                      if (!result.ok) {
                        setActionError(result.error);
                        return;
                      }
                      setActionMessage(
                        `تم إنشاء بوليصة ${result.batch.shipmentNumber} وشحن ${item.device.deviceCode} لمركز الصيانة.`,
                      );
                      refresh(user);
                    }}
                  >
                    شحن مباشر لمركز الصيانة
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <TechnicianWorkModal
        open={modalOpen}
        item={selected}
        technician={user}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
          refresh(user);
        }}
        onDone={() => {
          setModalOpen(false);
          setSelected(null);
          refresh(user);
        }}
        onClaimError={(message) => {
          setClaimError(message);
          setModalOpen(false);
          setSelected(null);
          refresh(user);
        }}
      />
    </div>
  );
}

export default function TechnicianWorkPage() {
  return (
    <RoleGuard allow={["technician", "mobile_technician"]}>
      <TechnicianWorkContent />
    </RoleGuard>
  );
}
