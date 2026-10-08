"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBadge } from "@/components/status-badge";
import { subscribeMaintenanceRequestsChanged } from "@/lib/branch-store";
import { getServiceRequests } from "@/lib/data";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDate } from "@/lib/utils";
import type { ServiceRequest } from "@/types/domain";

type QuickFilter =
  | "all"
  | "urgent"
  | "urgent_today"
  | "awaiting_maintenance"
  | "on_hold"
  | "mobile_technician";

const FILTERS: Array<{ id: QuickFilter; labelKey: MessageKey }> = [
  { id: "all", labelKey: "serviceRequests.filter.all" },
  { id: "urgent", labelKey: "serviceRequests.filter.urgent" },
  { id: "urgent_today", labelKey: "dashboard.widget.urgentToday" },
  { id: "awaiting_maintenance", labelKey: "serviceRequests.filter.awaitingMaintenance" },
  { id: "on_hold", labelKey: "serviceRequests.filter.onHold" },
  { id: "mobile_technician", labelKey: "serviceRequests.filter.mobileTechnician" },
];

function parseFocusFilter(raw: string | null): QuickFilter {
  if (!raw) return "all";
  if (raw === "urgent_today") return "urgent_today";
  if (raw === "urgent") return "urgent";
  if (raw === "awaiting_maintenance") return "awaiting_maintenance";
  if (raw === "on_hold" || raw === "pending_supervisor") return "on_hold";
  if (raw === "mobile_technician") return "mobile_technician";
  return "all";
}

function matchesFilter(request: ServiceRequest, filter: QuickFilter) {
  const today = new Date().toISOString().slice(0, 10);
  switch (filter) {
    case "urgent":
      return request.priority === "urgent";
    case "urgent_today":
      return (
        request.priority === "urgent" &&
        String(request.requestedAt ?? "").startsWith(today)
      );
    case "awaiting_maintenance":
      return request.hasAwaitingMaintenance === true || request.status === "at_service_center";
    case "on_hold":
      return request.hasOnHold === true || request.status === "in_review";
    case "mobile_technician":
      return request.assignmentPath === "mobile_technician";
    default:
      return true;
  }
}

export default function ServiceRequestsPage() {
  const { t, locale } = usePreferences();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuickFilter>(() =>
    parseFocusFilter(searchParams?.get("focus") ?? null),
  );

  useEffect(() => {
    setFilter(parseFocusFilter(searchParams?.get("focus") ?? null));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const load = (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      void getServiceRequests(locale).then((rows) => {
        if (cancelled) return;
        setRequests(rows);
        setLoading(false);
      });
    };
    load();
    const onSyncStatus = () => load({ quiet: true });
    window.addEventListener("arms-sync-status", onSyncStatus);
    const unsubscribe = subscribeMaintenanceRequestsChanged(() => load({ quiet: true }));
    return () => {
      cancelled = true;
      window.removeEventListener("arms-sync-status", onSyncStatus);
      unsubscribe();
    };
  }, [locale]);

  const filtered = useMemo(
    () => requests.filter((request) => matchesFilter(request, filter)),
    [requests, filter],
  );

  return (
    <div>
      <PageHeader
        title={t("serviceRequests.title")}
        description={t("serviceRequests.description")}
        action={
          <Link
            href="/service-requests/new"
            className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white dark:bg-aroma-600"
          >
            {t("serviceRequests.new")}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={
                active
                  ? "rounded-full bg-ink-900 px-3.5 py-1.5 text-sm text-white dark:bg-aroma-600"
                  : "rounded-full border border-ink-900/15 bg-white px-3.5 py-1.5 text-sm text-ink-800 hover:border-aroma-400 dark:border-white/15 dark:bg-ink-900 dark:text-sand-50 dark:hover:border-aroma-400"
              }
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          {t("serviceRequests.loading")}
        </p>
      ) : (
        <DataTable
          mobilePrimaryIndex={0}
          mobileBadgeIndexes={[5, 6]}
          columns={[
            t("serviceRequests.col.request"),
            t("serviceRequests.col.opened"),
            t("serviceRequests.col.customer"),
            t("serviceRequests.col.branch"),
            t("serviceRequests.col.deviceCount"),
            t("serviceRequests.col.priority"),
            t("serviceRequests.col.status"),
            t("serviceRequests.col.statusAt"),
            t("serviceRequests.col.technician"),
          ]}
          rows={filtered.map((request) => [
            <Link
              key="n"
              href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
              className="inline-flex font-semibold text-aroma-700 underline decoration-2 decoration-aroma-400/80 underline-offset-4 transition hover:text-aroma-800 hover:decoration-aroma-600 dark:text-aroma-200 dark:decoration-aroma-500/80 dark:hover:text-aroma-100 dark:hover:decoration-aroma-300"
            >
              {request.requestNumber}
            </Link>,
            formatDate(request.requestedAt, locale),
            request.customerName,
            request.branchName,
            String(request.deviceCount ?? 0),
            <StatusBadge key="p" value={request.priority} />,
            <StatusBadge key="s" value={request.status} />,
            formatDate(request.statusAt ?? request.requestedAt, locale),
            request.assignedTechnician ?? t("common.unassigned"),
          ])}
        />
      )}
    </div>
  );
}
