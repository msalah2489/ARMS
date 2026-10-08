"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/role-guard";
import { PageHeader } from "@/components/page-header";
import { TechnicianWorkModal } from "@/components/technician-work-modal";
import {
  deviceStatusLabel,
  formatMaintenanceDuration,
  listAllRequestDevices,
  subscribeMaintenanceRequestsChanged,
  type TechnicianQueueItem,
} from "@/lib/branch-store";
import { normalizeRole } from "@/lib/auth";
import {
  createShippingBatch,
} from "@/lib/shipping-store";
import {
  CLAIM_RACE_MESSAGE,
  getEligibleQueueForTechnician,
  getTechnicianWorkPageStats,
  listMaintenanceFailedDevices,
  listMyInProgressDevices,
  returnFailedDeviceToBranchEmployee,
  startDeviceWork,
} from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import type { Profile } from "@/types/domain";

/** Light re-pull so another technician's claim disappears without a full page reload. */
const QUEUE_POLL_MS = 20_000;

function TechnicianWorkContent() {
  const searchParams = useSearchParams();
  const claimHandled = useRef<string | null>(null);
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
    setUser(current);
    setQueue(getEligibleQueueForTechnician(current));
    setInProgress(listMyInProgressDevices(current.id));
    if (normalizeRole(current.role) === "mobile_technician") {
      setFailed(listMaintenanceFailedDevices(current.opsBranchId));
    } else {
      setFailed([]);
    }
  }

  function pullAndRefresh() {
    void hydrateOpsFromSupabase({ force: true }).then(() => {
      refresh(readSession());
    });
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (session) refresh(session);
    // Fresh cloud snapshot on open so claims from other sessions are visible.
    pullAndRefresh();

    const unsubscribe = subscribeMaintenanceRequestsChanged(() => {
      refresh(readSession());
    });

    const onHydrated = () => refresh(readSession());
    window.addEventListener("arms-ops-hydrated", onHydrated);

    const onVisible = () => {
      if (document.visibilityState === "visible") pullAndRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const pollId = window.setInterval(pullAndRefresh, QUEUE_POLL_MS);

    return () => {
      unsubscribe();
      window.removeEventListener("arms-ops-hydrated", onHydrated);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(pollId);
    };
  }, []);

  // Deep-link from QR scan: /technician/work/?claim=<localId>
  useEffect(() => {
    const claimId = searchParams?.get("claim")?.trim();
    if (!claimId || !user) return;
    if (claimHandled.current === claimId) return;
    claimHandled.current = claimId;

    const fromQueue =
      getEligibleQueueForTechnician(user).find((item) => item.device.localId === claimId) ||
      listMyInProgressDevices(user.id).find((item) => item.device.localId === claimId) ||
      listAllRequestDevices().find((item) => item.device.localId === claimId);

    if (!fromQueue) {
      setClaimError("الجهاز غير موجود أو غير متاح لطابورك.");
      return;
    }

    const result = startDeviceWork(fromQueue, user);
    if (!result.ok) {
      setClaimError(result.error || CLAIM_RACE_MESSAGE);
      refresh(user);
      return;
    }
    setClaimError(null);
    setActionMessage(`تم فتح صيانة ${fromQueue.device.deviceCode} من المسح.`);
    setSelected(fromQueue);
    setModalOpen(true);
    refresh(user);
  }, [searchParams, user]);

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

  const workStats = getTechnicianWorkPageStats(user);
  const showingUrgentOnly =
    workStats.awaitingUrgent > 0 &&
    queue.length > 0 &&
    queue.every((item) => item.request.priority === "urgent");

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
            {isMobile ? "بانتظار الصيانة (الإجمالي)" : "بانتظار الصيانة"}
          </p>
          <p className="mt-1 text-[11px] text-ink-700/50 dark:text-sand-100/50">
            عاجل + عادي (قبل فلتر العرض)
          </p>
          <p className="mt-2 font-display text-4xl dark:text-sand-50">{workStats.awaitingTotal}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">منها عاجلة</p>
          <p className="mt-2 font-display text-4xl dark:text-sand-50">{workStats.awaitingUrgent}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">قيد التنفيذ لديّ</p>
          <p className="mt-2 font-display text-4xl dark:text-sand-50">{inProgress.length}</p>
        </div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-900">
          <p className="text-sm text-ink-700/70 dark:text-sand-100/70">أجهزة صيّنتُها</p>
          <p className="mt-1 text-[11px] text-ink-700/50 dark:text-sand-100/50">منجزة بواسطة هذا الموظف</p>
          <p className="mt-2 font-display text-4xl dark:text-sand-50">{workStats.myCompleted}</p>
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
                    const assigned = String(item.device.assignedTechnicianId ?? "").trim();
                    if (!assigned || assigned !== user.id) {
                      setClaimError(CLAIM_RACE_MESSAGE);
                      refresh(user);
                      return;
                    }
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
    <RoleGuard
      allow={["technician", "mobile_technician"]}
      permission="view_work_queue"
    >
      <Suspense fallback={<p className="text-sm text-ink-700/70">جاري التحميل…</p>}>
        <TechnicianWorkContent />
      </Suspense>
    </RoleGuard>
  );
}
