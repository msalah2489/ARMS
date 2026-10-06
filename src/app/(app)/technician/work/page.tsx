"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/role-guard";
import { PageHeader } from "@/components/page-header";
import { TechnicianWorkModal } from "@/components/technician-work-modal";
import { deviceStatusLabel, type TechnicianQueueItem } from "@/lib/branch-store";
import {
  getSortedAwaitingDevices,
  listMyInProgressDevices,
} from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import type { Profile } from "@/types/domain";

function TechnicianWorkContent() {
  const [user, setUser] = useState<Profile | null>(null);
  const [queue, setQueue] = useState<TechnicianQueueItem[]>([]);
  const [inProgress, setInProgress] = useState<TechnicianQueueItem[]>([]);
  const [selected, setSelected] = useState<TechnicianQueueItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function refresh(technicianId?: string) {
    setQueue(getSortedAwaitingDevices());
    if (technicianId) setInProgress(listMyInProgressDevices(technicianId));
  }

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (session) refresh(session.id);
  }, []);

  if (!user) return <p className="text-sm text-ink-700/70">جاري التحميل…</p>;

  const urgentCount = queue.filter((item) => item.request.priority === "urgent").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="عمل الفني"
        description="أجهزة بحالة «جاهز للصيانة» بعد استلام مدير الصيانة للبوليصة. إن أرجعت جهازًا للمشرف تظل باقي الأجهزة الجاهزة متاحة لك."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
          <p className="text-sm text-ink-700/70">بانتظار الصيانة</p>
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
                    <span className="text-xs text-amber-700">جاري الصيانة</span>
                  </p>
                  <p className="text-sm text-ink-700/70">
                    {item.request.requestNumber} · {item.request.opsBranchName} ·{" "}
                    {item.device.modelName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
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
            لا توجد أجهزة جاهزة للصيانة. تظهر هنا فقط بعد استلام مدير الصيانة للبوليصة.
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
                    setSelected(item);
                    setModalOpen(true);
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

      <TechnicianWorkModal
        open={modalOpen}
        item={selected}
        technician={user}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
          refresh(user.id);
        }}
        onDone={() => {
          setModalOpen(false);
          setSelected(null);
          refresh(user.id);
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
