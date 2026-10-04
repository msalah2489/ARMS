import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getServiceRequests } from "@/lib/data";
import { formatDate } from "@/lib/utils";

const WORKFLOW = [
  "Reported",
  "Review",
  "Assignment",
  "Inspection",
  "Repair or dispatch",
  "Testing",
  "Return",
  "Closure",
];

export async function generateStaticParams() {
  const requests = await getServiceRequests();
  return requests.map((request) => ({ id: request.id }));
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = (await getServiceRequests()).find((item) => item.id === id);
  if (!request) notFound();

  return (
    <div>
      <PageHeader
        title={request.requestNumber}
        description={`${request.customerName} · ${request.branchName}`}
        action={<StatusBadge value={request.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel lg:col-span-2">
          <h2 className="font-display text-xl">Request details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-ink-700/60">Device</dt>
              <dd className="font-medium">
                {request.deviceCode} / {request.serialNumber}
              </dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Priority</dt>
              <dd>
                <StatusBadge value={request.priority} />
              </dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Technician</dt>
              <dd>{request.assignedTechnician ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Opened</dt>
              <dd>{formatDate(request.requestedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-700/60">Reported problem</dt>
              <dd className="mt-1">{request.reportedProblem}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl">Workflow</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {WORKFLOW.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-aroma-100 text-xs text-aroma-700">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
