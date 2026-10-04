"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getServiceRequests } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { ServiceRequest } from "@/types/domain";

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getServiceRequests().then((rows) => {
      setRequests(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Service requests"
        description="Track reported problems from review through local repair or service-center dispatch."
        action={
          <Link
            href="/service-requests/new"
            className="rounded-full bg-ink-900 px-4 py-2 text-sm text-white"
          >
            New request
          </Link>
        }
      />
      {loading ? (
        <p className="text-sm text-ink-700/70">Loading service requests…</p>
      ) : (
        <DataTable
          columns={["Request", "Customer / branch", "Device", "Problem", "Priority", "Status", "Technician", "Opened"]}
          rows={requests.map((request) => [
            <Link key="n" href={`/service-requests/${request.id}`} className="font-medium text-aroma-700">
              {request.requestNumber}
            </Link>,
            `${request.customerName} · ${request.branchName}`,
            `${request.deviceCode} / ${request.serialNumber}`,
            request.reportedProblem,
            <StatusBadge key="p" value={request.priority} />,
            <StatusBadge key="s" value={request.status} />,
            request.assignedTechnician ?? "Unassigned",
            formatDate(request.requestedAt),
          ])}
        />
      )}
    </div>
  );
}
