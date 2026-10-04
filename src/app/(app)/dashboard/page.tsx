import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardStats, getServiceRequests } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireSession();
  const [stats, requests] = await Promise.all([getDashboardStats(), getServiceRequests()]);

  const cards = [
    { label: "Open requests", value: stats.openRequests },
    { label: "Under maintenance", value: stats.devicesUnderMaintenance },
    { label: "At service center", value: stats.dispatchedDevices },
    { label: "Low-stock parts", value: stats.lowStockParts },
    { label: "Active devices", value: stats.activeDevices },
    { label: "Completed this month", value: stats.completedThisMonth },
  ];

  return (
    <div>
      <PageHeader
        title={`Good day, ${user.fullName.split(" ")[0]}`}
        description={`${ROLE_LABELS[user.role]} workspace — operational overview for aroma device maintenance.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel">
            <p className="text-sm text-ink-700/70">{card.label}</p>
            <p className="mt-2 font-display text-4xl">{card.value}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-display text-2xl">Recent service requests</h2>
      <div className="space-y-3">
        {requests.map((request) => (
          <a
            key={request.id}
            href={`/service-requests/${request.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-900/10 bg-white px-4 py-4 shadow-panel hover:border-aroma-400"
          >
            <div>
              <p className="font-medium">{request.requestNumber}</p>
              <p className="text-sm text-ink-700/70">
                {request.customerName} · {request.deviceCode} · {request.reportedProblem}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={request.priority} />
              <StatusBadge value={request.status} />
              <span className="text-xs text-ink-700/60">{formatDate(request.requestedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
