"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBadge } from "@/components/status-badge";
import { getServiceRequests } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { ServiceRequest } from "@/types/domain";

export default function ServiceRequestsPage() {
  const { t, locale } = usePreferences();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      void getServiceRequests(locale).then((rows) => {
        if (cancelled) return;
        setRequests(rows);
        setLoading(false);
      });
    };
    load();
    window.addEventListener("arms-ops-hydrated", load);
    window.addEventListener("arms-sync-status", load);
    return () => {
      cancelled = true;
      window.removeEventListener("arms-ops-hydrated", load);
      window.removeEventListener("arms-sync-status", load);
    };
  }, [locale]);

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
      {loading ? (
        <p className="text-sm text-ink-700/70 dark:text-sand-100/70">
          {t("serviceRequests.loading")}
        </p>
      ) : (
        <DataTable
          columns={[
            t("serviceRequests.col.request"),
            t("serviceRequests.col.customerBranch"),
            t("serviceRequests.col.device"),
            t("serviceRequests.col.problem"),
            t("serviceRequests.col.priority"),
            t("serviceRequests.col.status"),
            t("serviceRequests.col.technician"),
            t("serviceRequests.col.opened"),
          ]}
          rows={requests.map((request) => [
            <Link
              key="n"
              href={`/service-requests/detail/?id=${encodeURIComponent(request.id)}`}
              className="font-medium text-aroma-700 dark:text-aroma-200"
            >
              {request.requestNumber}
            </Link>,
            `${request.customerName} · ${request.branchName}`,
            `${request.deviceCode} / ${request.serialNumber}`,
            request.reportedProblem,
            <StatusBadge key="p" value={request.priority} />,
            <StatusBadge key="s" value={request.status} />,
            request.assignedTechnician ?? t("common.unassigned"),
            formatDate(request.requestedAt, locale),
          ])}
        />
      )}
    </div>
  );
}
