import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getDevices, getServiceRequests } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  const devices = await getDevices();
  return devices.map((device) => ({ id: device.id }));
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const device = (await getDevices()).find((item) => item.id === id);
  if (!device) notFound();
  const history = (await getServiceRequests()).filter(
    (request) => request.deviceCode === device.deviceCode,
  );

  return (
    <div>
      <PageHeader title={device.deviceCode} description={`${device.brand} ${device.modelName}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-ink-700/60">Serial number</dt>
              <dd className="font-medium">{device.serialNumber}</dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Status</dt>
              <dd>
                <StatusBadge value={device.status} />
              </dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Customer</dt>
              <dd>{device.customerName}</dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Branch</dt>
              <dd>{device.branchName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-700/60">Current location</dt>
              <dd>{device.currentLocation}</dd>
            </div>
            <div>
              <dt className="text-ink-700/60">QR / barcode</dt>
              <dd className="font-mono">{device.qrCode}</dd>
            </div>
            <div>
              <dt className="text-ink-700/60">Color</dt>
              <dd>{device.color}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl">QR payload</h2>
          <div className="mt-4 flex aspect-square items-center justify-center rounded-xl bg-sand-100 font-mono text-xs">
            {device.qrCode}
          </div>
        </section>
      </div>
      <h2 className="mb-3 mt-10 font-display text-2xl">Service history</h2>
      <div className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-ink-700/70">No linked requests in the current demo set.</p>
        ) : (
          history.map((request) => (
            <div key={request.id} className="rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm">
              <span className="font-medium">{request.requestNumber}</span>
              <span className="mx-2 text-ink-700/50">·</span>
              {request.reportedProblem}
              <span className="mx-2 text-ink-700/50">·</span>
              {formatDate(request.requestedAt)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
