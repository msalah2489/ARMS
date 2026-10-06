"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { ROLE_LABELS, isBranchRole, isTechnicianRole } from "@/lib/auth";
import {
  deviceStatusLabel,
  listAllRequestDevices,
  listMaintenanceRequests,
} from "@/lib/branch-store";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import { getTechnicianDashboardStats } from "@/lib/technician-store";
import { readSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import type { DashboardStats, MaintenanceRequestRecord, Profile, ServiceRequest } from "@/types/domain";

export default function DashboardPage() {
  const { t } = usePreferences();
  const [user, setUser] = useState<Profile | null>(null);
  const [branchRequests, setBranchRequests] = useState<MaintenanceRequestRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [techStats, setTechStats] = useState<ReturnType<typeof getTechnicianDashboardStats> | null>(
    null,
  );

  useEffect(() => {
    const session = readSession();
    setUser(session);
    if (!session) return;

    if (isBranchRole(session.role)) {
      setBranchRequests(listMaintenanceRequests(session.opsBranchId));
    }

    if (isTechnicianRole(session.role)) {
      setTechStats(getTechnicianDashboardStats(session.id));
    }

    void Promise.all([getDashboardStats(), getServiceRequests()]).then(([nextStats, nextRequests]) => {
      setStats(nextStats);
      setRequests(nextRequests);
    });
  }, []);

  if (!user) {
    return <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{t("dashboard.loading")}</p>;
  }

  const firstName = user.fullName.split(" ")[0];
  const welcome = t("dashboard.welcome").replace("{name}", firstName);

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
        <div className="grid gap-4 lg:grid-cols-3">
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
                    <p className="font-medium dark:text-sand-50">{request.requestNumber}</p>
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
            <Link
              href="/service-requests/new"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
            >
              {t("dashboard.createRequest")}
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
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
                        <p className="font-medium dark:text-sand-50">{request.requestNumber}</p>
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

  return (
    <div>
      <PageHeader
        title={welcome}
        description={t("dashboard.opsDescription").replace("{role}", ROLE_LABELS[user.role])}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    <p className="font-medium dark:text-sand-50">{request.requestNumber}</p>
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
    <section className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel dark:border-white/10 dark:bg-ink-800">
      <h2 className="font-display text-xl dark:text-sand-50">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-ink-900/10 px-3 py-3 dark:border-white/10">
      <p className="text-sm text-ink-700/70 dark:text-sand-100/70">{label}</p>
      <p className="font-display text-3xl dark:text-sand-50">{value}</p>
    </div>
  );
}
