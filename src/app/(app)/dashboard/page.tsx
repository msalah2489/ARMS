"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import {
  ROLE_LABELS,
  isBranchRole,
  isMaintenanceManagerRole,
  isPickupCourierRole,
  isSystemAdminRole,
  isTechnicianRole,
} from "@/lib/auth";
import {
  listPickupReceipts,
  PICKUP_RECEIPT_STATUS_LABELS,
} from "@/lib/pickup-receipt-store";
import {
  listMaintenanceRequests,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import {
  getDashboardAttentionCounts,
  type DashboardAttentionCounts,
} from "@/lib/dashboard-attention";
import {
  getBranchDailyWorkCounts,
  getManagerDailyWorkCounts,
  getTechnicianHomeQueues,
  type BranchDailyWorkCounts,
  type ManagerDailyWorkCounts,
  type TechnicianHomeQueues,
} from "@/lib/dashboard-work-queues";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import type { MessageKey } from "@/lib/i18n/messages";
import { readSession } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { formatDate } from "@/lib/utils";
import type { DashboardStats, MaintenanceRequestRecord, Profile, ServiceRequest } from "@/types/domain";

type WorkCard = {
  key: string;
  title: string;
  hint: string;
  count: number;
  href: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function DashboardPage() {
  const { t } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [attention, setAttention] = useState<DashboardAttentionCounts | null>(null);
  const [techQueues, setTechQueues] = useState<TechnicianHomeQueues | null>(null);
  const [branchWork, setBranchWork] = useState<BranchDailyWorkCounts | null>(null);
  const [managerWork, setManagerWork] = useState<ManagerDailyWorkCounts | null>(null);

  useEffect(() => {
    function load() {
      const session = readSession();
      setUser(session);
      if (!session) return;

      if (isBranchRole(session.role)) {
        setBranchRequests(listMaintenanceRequests(session.opsBranchId));
        setAttention(getDashboardAttentionCounts(session.opsBranchId));
        setManagerWork(null);
        setBranchWork(
          session.opsBranchId
            ? getBranchDailyWorkCounts(session.opsBranchId)
            : {
                customersAtBranch: 0,
                sendToService: 0,
                incomingFromService: 0,
                handToMobile: 0,
                handToCustomer: 0,
              },
        );
      } else {
        setBranchWork(null);
        setAttention(getDashboardAttentionCounts());
        if (isMaintenanceManagerRole(session.role)) {
          setManagerWork(getManagerDailyWorkCounts());
        } else {
          setManagerWork(null);
        }
      }

      if (isTechnicianRole(session.role)) {
        setTechQueues(getTechnicianHomeQueues(session));
      } else {
        setTechQueues(null);
      }

      void Promise.all([getDashboardStats(), getServiceRequests()]).then(([nextStats, nextRequests]) => {
        setStats(nextStats);
        setRequests(nextRequests);
      });
    }

    load();
    void hydrateOpsFromSupabase().then(() => load());
    return subscribeMaintenanceRequestsChanged(load);
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("dashboard.loading")}</p>;
  }

  const firstName = user.fullName.split(" ")[0];
  const welcome = t("dashboard.welcome").replace("{name}", firstName);

  if (isPickupCourierRole(user.role)) {
    const mine = listPickupReceipts({ courierId: user.id });
    const pending = mine.filter((r) => r.status === "pending_courier");
    const held = mine.filter((r) => r.status === "approved" || r.status === "pending_supervisor");

    return (
      <div>
        <PageHeader
          title={welcome}
          description="لوحة مندوب الاستلام — نماذج بانتظار المراجعة والأجهزة لديك"
          action={
            <Link
              href="/courier/receipts"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
            >
              نماذج الاستلام
            </Link>
          }
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DashboardColumn title="بانتظار المراجعة">
            <StatRow label="نماذج معلّقة" value={pending.length} />
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-ink-700/70">لا توجد نماذج جديدة.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {pending.slice(0, 6).map((r) => (
                  <li key={r.id} className="rounded-xl border border-ink-900/10 px-3 py-2">
                    {r.receiptNumber} · {r.opsBranchName} ·{" "}
                    {PICKUP_RECEIPT_STATUS_LABELS[r.status]}
                  </li>
                ))}
              </ul>
            )}
          </DashboardColumn>
          <DashboardColumn title="لدى المندوب">
            <StatRow label="نماذج معتمدة / قيد التسليم" value={held.length} />
          </DashboardColumn>
        </div>
      </div>
    );
  }

  if (isTechnicianRole(user.role)) {
    const queues = techQueues ?? { waitingQueue: [], myRepairedDevices: [] };
    const queuePreview = queues.waitingQueue.slice(0, 8);
    const repairedPreview = queues.myRepairedDevices.slice(0, 8);

    return (
      <div>
        <PageHeader
          title={welcome}
          description={t("dashboard.techDescription")}
          action={
            <Link
              href="/technician/work"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
            >
              {t("dashboard.techWork")}
            </Link>
          }
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-900">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">
                {t("dashboard.tech.waitingQueue")}
              </h2>
              <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-ink-900 px-3 py-1 text-sm font-semibold text-white dark:bg-aroma-600">
                {queues.waitingQueue.length}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
              {t("dashboard.tech.waitingQueueHint")}
            </p>
            {queuePreview.length === 0 ? (
              <p className="mt-4 text-sm text-ink-700/70 dark:text-sand-100/70">
                {t("dashboard.tech.noWaiting")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {queuePreview.map(({ request, device }) => (
                  <li
                    key={`${request.id}-${device.localId}`}
                    className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href="/technician/work"
                        className="font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 dark:text-aroma-200"
                      >
                        {device.deviceCode}
                      </Link>
                      {request.priority === "urgent" ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                          {t("dashboard.mgr.badge.urgent")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                      {request.requestNumber} · {device.deviceTypeName} · {request.opsBranchName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/technician/work"
              className="mt-4 inline-flex w-fit rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
            >
              {t("dashboard.tech.openWork")}
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-900">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">
                {t("dashboard.tech.myRepaired")}
              </h2>
              <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-ink-900 px-3 py-1 text-sm font-semibold text-white dark:bg-aroma-600">
                {queues.myRepairedDevices.length}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">
              {t("dashboard.tech.myRepairedHint")}
            </p>
            {repairedPreview.length === 0 ? (
              <p className="mt-4 text-sm text-ink-700/70 dark:text-sand-100/70">
                {t("dashboard.tech.noRepaired")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {repairedPreview.map((record) => (
                  <li
                    key={record.id}
                    className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                  >
                    <p className="font-semibold text-ink-900 dark:text-sand-50">
                      {record.deviceCode}
                    </p>
                    <p
                      className={`text-sm ${
                        record.resultKind === "success"
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {record.resultLabel}
                    </p>
                    <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
                      {record.requestNumber}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isBranchRole(user.role)) {
    const branchName = user.opsBranchName || t("dashboard.branchFallback");
    const work = branchWork ?? {
      customersAtBranch: 0,
      sendToService: 0,
      incomingFromService: 0,
      handToMobile: 0,
      handToCustomer: 0,
    };

    const workCards: WorkCard[] = [
      {
        key: "customers",
        title: t("dashboard.work.customersAtBranch"),
        hint: t("dashboard.work.customersAtBranchHint"),
        count: work.customersAtBranch,
        href: "/devices?focus=customers_at_branch",
      },
      {
        key: "send",
        title: t("dashboard.work.sendToService"),
        hint: t("dashboard.work.sendToServiceHint"),
        count: work.sendToService,
        href: "/devices?focus=send_to_service",
        actionHref: "/branch/shipping",
        actionLabel: t("dashboard.work.openShipping"),
      },
      {
        key: "incoming",
        title: t("dashboard.work.incoming"),
        hint: t("dashboard.work.incomingHint"),
        count: work.incomingFromService,
        href: "/devices?focus=returning",
        actionHref: "/branch/shipping",
        actionLabel: t("dashboard.work.openShipping"),
      },
      {
        key: "mobile",
        title: t("dashboard.work.handToMobile"),
        hint: t("dashboard.work.handToMobileHint"),
        count: work.handToMobile,
        href: "/devices?focus=hand_to_mobile",
      },
      {
        key: "customer",
        title: t("dashboard.work.handToCustomer"),
        hint: t("dashboard.work.handToCustomerHint"),
        count: work.handToCustomer,
        href: "/devices?focus=awaiting_customer",
      },
    ];

    return (
      <div>
        <PageHeader
          title={welcome}
          description={t("dashboard.branchDescription").replace("{branch}", branchName)}
          action={
            <>
              <Link
                href="/branch/receiving"
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
              >
                {t("dashboard.goReceiving")}
              </Link>
              <Link
                href="/service-requests/new"
                className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
              >
                {t("dashboard.createRequest")}
              </Link>
            </>
          }
        />

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workCards.map((card) => (
            <WorkCardPanel key={card.key} card={card} openListLabel={t("dashboard.work.openList")} />
          ))}
        </div>

        <div className="mt-6">
          <DashboardColumn title={t("dashboard.col.branchRequests")}>
            {branchRequests.length === 0 ? (
              <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                {t("dashboard.noBranchRequests")}
              </p>
            ) : (
              <ul className="space-y-2">
                {branchRequests.slice(0, 8).map((request) => (
                  <li
                    key={request.id}
                    className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
                          className="inline-flex font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 hover:decoration-aroma-600 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100 dark:hover:decoration-aroma-300"
                        >
                          {request.requestNumber}
                        </Link>
                        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                          {request.contactName} ·{" "}
                          {t("dashboard.deviceCount").replace(
                            "{count}",
                            String(request.devices.length),
                          )}
                        </p>
                      </div>
                      <div className="text-sm text-ink-700/70 dark:text-sand-100/70">
                        {formatDate(request.receivedAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardColumn>
        </div>
      </div>
    );
  }

  if (isMaintenanceManagerRole(user.role) && managerWork) {
    const mgrCards: WorkCard[] = [
      {
        key: "branchesNeed",
        title: t("dashboard.mgr.branchesNeedMaintenance"),
        hint: t("dashboard.mgr.branchesNeedMaintenanceHint"),
        count: managerWork.branchesNeedMaintenance,
        href: "/devices?focus=branches_need_maintenance",
        actionHref: "/maintenance/shipping",
        actionLabel: t("dashboard.work.openShipping"),
      },
      {
        key: "decision",
        title: t("dashboard.mgr.needDecision"),
        hint: t("dashboard.mgr.needDecisionHint"),
        count: managerWork.needMaintenanceDecision,
        href: "/devices?focus=need_decision",
      },
      {
        key: "lowStock",
        title: t("dashboard.mgr.lowStock"),
        hint: t("dashboard.mgr.lowStockHint"),
        count: managerWork.lowStockParts,
        href: "/spare-parts",
      },
      {
        key: "replaced",
        title: t("dashboard.mgr.replacedStock"),
        hint: t("dashboard.mgr.replacedStockHint"),
        count: managerWork.replacedDevicesStock,
        href: "/replaced-devices",
      },
      {
        key: "readyReturn",
        title: t("dashboard.mgr.readyToReturn"),
        hint: t("dashboard.mgr.readyToReturnHint"),
        count: managerWork.readyToReturnToBranches,
        href: "/devices?focus=ready_to_return",
        actionHref: "/maintenance/shipping",
        actionLabel: t("dashboard.work.openShipping"),
      },
      {
        key: "delivering",
        title: t("dashboard.mgr.deliveringToBranches"),
        hint: t("dashboard.mgr.deliveringToBranchesHint"),
        count: managerWork.deliveringToBranches,
        href: "/devices?focus=delivering_to_branches",
      },
      {
        key: "needReceive",
        title: t("dashboard.mgr.needReceiveAtService"),
        hint: t("dashboard.mgr.needReceiveAtServiceHint"),
        count: managerWork.needReceiveAtService,
        href: "/devices?focus=need_receive_at_service",
        actionHref: "/maintenance/shipping",
        actionLabel: t("dashboard.work.openShipping"),
      },
      {
        key: "inMaint",
        title: t("dashboard.mgr.inMaintenance"),
        hint: t("dashboard.mgr.inMaintenanceHint"),
        count: managerWork.inMaintenance,
        href: "/devices?focus=in_maintenance",
      },
    ];

    return (
      <div>
        <PageHeader
          title={welcome}
          description={t("dashboard.opsDescription").replace("{role}", ROLE_LABELS[user.role])}
          action={
            <>
              <Link
                href="/service-requests/new"
                className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
              >
                {t("dashboard.createRequest")}
              </Link>
              <Link
                href="/maintenance/shipping"
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
              >
                {t("dashboard.quickWaybill")}
              </Link>
              <Link
                href="/spare-parts"
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
              >
                {t("dashboard.quickReceiveSpare")}
              </Link>
            </>
          }
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mgrCards.map((card) => (
            <WorkCardPanel key={card.key} card={card} openListLabel={t("dashboard.work.openList")} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("dashboard.loading")}</p>;
  }

  const showOpsQuickActions =
    isSystemAdminRole(user.role) || isMaintenanceManagerRole(user.role);

  return (
    <div>
      <PageHeader
        title={welcome}
        description={t("dashboard.opsDescription").replace("{role}", ROLE_LABELS[user.role])}
        action={
          showOpsQuickActions || user.role === "maintenance_supervisor" ? (
            <>
              <Link
                href="/service-requests/new"
                className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
              >
                {t("dashboard.createRequest")}
              </Link>
              <Link
                href="/maintenance/shipping"
                className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
              >
                {t("dashboard.quickWaybill")}
              </Link>
            </>
          ) : undefined
        }
      />
      <AttentionWidgets
        counts={attention}
        t={t}
        urgentHref="/service-requests?focus=urgent_today"
        pendingHref="/service-requests?focus=on_hold"
        awaitingHref="/devices?focus=awaiting_customer"
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardColumn title={t("dashboard.col.requests")}>
          <StatRow label={t("dashboard.openRequests")} value={stats.openRequests} />
          <StatRow label={t("dashboard.completedThisMonth")} value={stats.completedThisMonth} />
        </DashboardColumn>
        <DashboardColumn title={t("dashboard.col.devices")}>
          <StatRow label={t("dashboard.underMaintenance")} value={stats.devicesUnderMaintenance} />
          <StatRow label={t("dashboard.atServiceCenter")} value={stats.dispatchedDevices} />
          <StatRow label={t("dashboard.activeDevices")} value={stats.activeDevices} />
        </DashboardColumn>
        <DashboardColumn title={t("dashboard.col.inventory")}>
          <StatRow label={t("dashboard.lowStock")} value={stats.lowStockParts} />
        </DashboardColumn>
        <DashboardColumn title={t("dashboard.col.recentRequests")}>
          {requests.length === 0 ? (
            <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
              {t("dashboard.noRecentRequests")}
            </p>
          ) : (
            <ul className="space-y-2">
              {requests.slice(0, 6).map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
                    className="block rounded-xl border border-ink-900/10 px-3 py-2 hover:border-aroma-400 dark:border-white/10 dark:hover:border-aroma-400"
                  >
                    <p className="font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 dark:text-aroma-200 dark:decoration-aroma-500/80">
                      {request.requestNumber}
                    </p>
                    <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                      {request.customerName} · {request.deviceCode} · {request.reportedProblem}
                    </p>
                    <span className="mt-1 block text-xs text-ink-700/60 dark:text-sand-100/60">
                      {formatDate(request.requestedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardColumn>
      </div>
    </div>
  );
}

function WorkCardPanel({
  card,
  openListLabel,
}: {
  card: WorkCard;
  openListLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">{card.title}</h2>
        <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-ink-900 px-3 py-1 text-sm font-semibold text-white dark:bg-aroma-600">
          {card.count}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-ink-700/70 dark:text-sand-100/70">{card.hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={card.href}
          className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
        >
          {openListLabel}
        </Link>
        {card.actionHref && card.actionLabel ? (
          <Link
            href={card.actionHref}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900 dark:border-white/15 dark:text-sand-50"
          >
            {card.actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DashboardColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/15 dark:bg-ink-800">
      <h2 className="font-display text-xl dark:text-sand-50">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-ink-900/10 bg-sand-50/60 px-3 py-3 dark:border-white/15 dark:bg-ink-950/40">
      <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{label}</p>
      <p className="font-display text-3xl dark:text-sand-50">{value}</p>
    </div>
  );
}

function AttentionWidgets({
  counts,
  t,
  urgentHref,
  pendingHref,
  awaitingHref,
}: {
  counts: DashboardAttentionCounts | null;
  t: (key: MessageKey) => string;
  urgentHref: string;
  pendingHref: string;
  awaitingHref: string;
}) {
  const items = [
    {
      key: "urgent",
      label: t("dashboard.widget.urgentToday"),
      value: counts?.urgentToday ?? 0,
      href: urgentHref,
      tone: "urgent" as const,
    },
    {
      key: "pending",
      label: t("dashboard.widget.pendingSupervisor"),
      value: counts?.pendingSupervisor ?? 0,
      href: pendingHref,
      tone: "hold" as const,
    },
    {
      key: "awaiting",
      label: t("dashboard.widget.awaitingCustomer"),
      value: counts?.awaitingCustomer ?? 0,
      href: awaitingHref,
      tone: "ready" as const,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 font-display text-lg dark:text-sand-50">{t("dashboard.attention")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "rounded-2xl border px-4 py-4 shadow-panel transition hover:border-aroma-400 dark:hover:border-aroma-400",
              item.tone === "urgent"
                ? "border-rose-300/70 bg-rose-50/80 dark:border-rose-400/40 dark:bg-rose-950/45"
                : item.tone === "hold"
                  ? "border-amber-300/70 bg-amber-50/80 dark:border-amber-400/40 dark:bg-amber-950/45"
                  : "border-emerald-300/70 bg-emerald-50/80 dark:border-emerald-400/40 dark:bg-emerald-950/45",
            ].join(" ")}
          >
            <p className="text-sm font-medium text-ink-800 dark:text-sand-100">{item.label}</p>
            <p className="mt-2 font-display text-4xl dark:text-sand-50">{item.value}</p>
            <p className="mt-2 text-xs text-ink-700/65 underline underline-offset-2 dark:text-sand-100/65">
              {t("dashboard.widget.viewList")}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
