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
  deviceStatusLabel,
  listAllRequestDevices,
  listMaintenanceRequests,
  subscribeMaintenanceRequestsChanged,
} from "@/lib/branch-store";
import {
  getDashboardAttentionCounts,
  getDashboardOpsShippingAttention,
  type DashboardAttentionCounts,
  type DashboardOpsShippingAttention,
} from "@/lib/dashboard-attention";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import type { MessageKey } from "@/lib/i18n/messages";
import { getTechnicianDashboardStats } from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import { hydrateOpsFromSupabase } from "@/lib/supabase/hydrate";
import { formatDate } from "@/lib/utils";
import type { DashboardStats, MaintenanceRequestRecord, Profile, ServiceRequest } from "@/types/domain";

export default function DashboardPage() {
  const { t } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [attention, setAttention] = useState<DashboardAttentionCounts | null>(null);
  const [shippingAttention, setShippingAttention] =
    useState<DashboardOpsShippingAttention | null>(null);
  const [techStats, setTechStats] = useState<ReturnType<typeof getTechnicianDashboardStats> | null>(
    null,
  );

  useEffect(() => {
    function load() {
      const session = readSession();
      setUser(session);
      if (!session) return;

      if (isBranchRole(session.role)) {
        setBranchRequests(listMaintenanceRequests(session.opsBranchId));
        setAttention(getDashboardAttentionCounts(session.opsBranchId));
        setShippingAttention(null);
      } else {
        setAttention(getDashboardAttentionCounts());
        if (isMaintenanceManagerRole(session.role)) {
          setShippingAttention(getDashboardOpsShippingAttention());
        } else {
          setShippingAttention(null);
        }
      }

      if (isTechnicianRole(session.role)) {
        setTechStats(getTechnicianDashboardStats(session.id, session));
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
    const todayDevices = listAllRequestDevices().filter((item) =>
      item.request.receivedAt.startsWith(new Date().toISOString().slice(0, 10)),
    );

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
        <AttentionWidgets
          counts={attention}
          t={t}
          urgentHref="/service-requests?focus=urgent_today"
          pendingHref="/service-requests?focus=on_hold"
          awaitingHref="/devices?focus=awaiting_customer"
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <DashboardColumn title={t("dashboard.col.workload")}>
            <StatRow label={t("dashboard.availableRequests")} value={techStats?.availableRequests ?? 0} />
            <StatRow label={t("dashboard.availableDevices")} value={techStats?.availableDevices ?? 0} />
          </DashboardColumn>
          <DashboardColumn title={t("dashboard.col.readiness")}>
            <StatRow
              label={t("dashboard.readyToReturn")}
              value={techStats?.readyToReturn ?? techStats?.readyToSend ?? 0}
            />
            <StatRow
              label={t("dashboard.awaitingManager")}
              value={techStats?.awaitingManager ?? techStats?.excluded ?? 0}
            />
          </DashboardColumn>
          <DashboardColumn title={t("dashboard.col.todayRequests")}>
            {todayDevices.length === 0 ? (
              <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                {t("dashboard.noTodayRequests")}
              </p>
            ) : (
              <ul className="space-y-2">
                {todayDevices.map(({ request, device }) => (
                  <li
                    key={`${request.id}-${device.localId}`}
                    className="rounded-xl border border-ink-900/10 px-3 py-2 dark:border-white/10"
                  >
                    <Link
                      href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
                      className="inline-flex font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 hover:decoration-aroma-600 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100 dark:hover:decoration-aroma-300"
                    >
                      {request.requestNumber}
                    </Link>
                    <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                      {request.contactName} · {request.opsBranchName} · {device.deviceTypeName} ·{" "}
                      {deviceStatusLabel(device.lifecycleStatus, "technician")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DashboardColumn>
        </div>
      </div>
    );
  }

  if (isBranchRole(user.role)) {
    const openCount = branchRequests.length;
    const deviceCount = branchRequests.reduce((sum, item) => sum + item.devices.length, 0);
    const urgentCount = branchRequests.filter((item) => item.priority === "urgent").length;
    const branchName = user.opsBranchName || t("dashboard.branchFallback");

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
        <AttentionWidgets
          counts={attention}
          t={t}
          urgentHref="/service-requests?focus=urgent_today"
          pendingHref="/service-requests?focus=on_hold"
          awaitingHref="/devices?focus=awaiting_customer"
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DashboardColumn title={t("dashboard.col.branchSummary")}>
            <StatRow label={t("dashboard.branchRequests")} value={openCount} />
            <StatRow label={t("dashboard.receivedDevices")} value={deviceCount} />
            <StatRow label={t("dashboard.urgentRequests")} value={urgentCount} />
          </DashboardColumn>
          <DashboardColumn title={t("dashboard.col.branchRequests")}>
            {branchRequests.length === 0 ? (
              <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
                {t("dashboard.noBranchRequests")}
              </p>
            ) : (
              <ul className="space-y-2">
                {branchRequests.map((request) => (
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
                          {request.contactName} · {request.customerMobile} ·{" "}
                          {t("dashboard.deviceCount").replace(
                            "{count}",
                            String(request.devices.length),
                          )}
                        </p>
                        <p className="mt-1 text-xs text-ink-700/60 dark:text-sand-100/60">
                          {request.devices
                            .map(
                              (device) =>
                                `${device.deviceCode}: ${deviceStatusLabel(device.lifecycleStatus, "branch")}`,
                            )
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-sm text-ink-700/70 dark:text-sand-100/70">
                        {request.priority === "urgent"
                          ? t("dashboard.urgent")
                          : t("dashboard.normal")}{" "}
                        · {formatDate(request.receivedAt)}
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
              {(isSystemAdminRole(user.role) || user.role === "maintenance_manager") && (
                <Link
                  href="/spare-parts"
                  className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-sm text-ink-900 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
                >
                  {t("dashboard.quickReceiveSpare")}
                </Link>
              )}
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
      {isMaintenanceManagerRole(user.role) && shippingAttention ? (
        <ShippingAttentionWidgets attention={shippingAttention} t={t} />
      ) : null}
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

function ShippingAttentionWidgets({
  attention,
  t,
}: {
  attention: DashboardOpsShippingAttention;
  t: (key: MessageKey) => string;
}) {
  return (
    <section className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg dark:text-sand-50">
          {t("dashboard.shippingAttention")}
        </h2>
        <Link
          href="/maintenance/shipping"
          className="text-xs text-ink-700/65 underline underline-offset-2 dark:text-sand-100/65"
        >
          {t("dashboard.widget.openShipping")}
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-4 shadow-panel dark:border-emerald-400/40 dark:bg-emerald-950/45">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink-800 dark:text-sand-100">
              {t("dashboard.widget.readyToShipBranches")}
            </p>
            <p className="font-display text-3xl dark:text-sand-50">
              {attention.readyToShipDeviceTotal}
            </p>
          </div>
          {attention.branchesReadyToShip.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700/70 dark:text-sand-100/70">
              {t("dashboard.widget.noReadyBranches")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.branchesReadyToShip.map((branch) => (
                <li key={branch.branchId}>
                  <Link
                    href="/maintenance/shipping"
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2 text-sm transition hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900/40 dark:hover:border-aroma-400"
                  >
                    <span className="font-medium text-ink-900 dark:text-sand-50">
                      {branch.branchName}
                    </span>
                    <span className="text-ink-700/70 dark:text-sand-100/70">
                      {t("dashboard.widget.deviceCountShort").replace(
                        "{count}",
                        String(branch.readyCount),
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-4 shadow-panel dark:border-amber-400/40 dark:bg-amber-950/45">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-ink-800 dark:text-sand-100">
              {t("dashboard.widget.openCarriers")}
            </p>
            <p className="font-display text-3xl dark:text-sand-50">{attention.openBatchTotal}</p>
          </div>
          {attention.carriersWithOpenBatches.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700/70 dark:text-sand-100/70">
              {t("dashboard.widget.noOpenCarriers")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.carriersWithOpenBatches.map((carrier) => {
                const parts = [
                  carrier.toService > 0
                    ? `${t("dashboard.widget.directionToService")} ${carrier.toService}`
                    : null,
                  carrier.returning > 0
                    ? `${t("dashboard.widget.directionReturn")} ${carrier.returning}`
                    : null,
                ].filter(Boolean);
                return (
                  <li key={carrier.carrier}>
                    <Link
                      href="/maintenance/shipping"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-900/10 bg-white/70 px-3 py-2 text-sm transition hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900/40 dark:hover:border-aroma-400"
                    >
                      <span className="font-medium text-ink-900 dark:text-sand-50">
                        {carrier.carrier}
                      </span>
                      <span className="text-ink-700/70 dark:text-sand-100/70">
                        {t("dashboard.widget.batchCountShort").replace(
                          "{count}",
                          String(carrier.total),
                        )}
                        {parts.length ? ` · ${parts.join(" · ")}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
