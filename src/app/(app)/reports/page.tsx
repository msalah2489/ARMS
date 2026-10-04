import { PageHeader } from "@/components/page-header";
import { getDashboardStats, getSpareParts } from "@/lib/data";

export default async function ReportsPage() {
  const [stats, parts] = await Promise.all([getDashboardStats(), getSpareParts()]);
  const low = parts.filter((part) => part.stockQuantity < part.minimumStock);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational views for requests, devices, technicians, inventory, and service-center activity. Export to Excel comes with the live data layer."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl">Service load</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>Open requests: {stats.openRequests}</li>
            <li>Completed this month: {stats.completedThisMonth}</li>
            <li>Devices under maintenance: {stats.devicesUnderMaintenance}</li>
            <li>Devices at service center: {stats.dispatchedDevices}</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl">Inventory alerts</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {low.length === 0 ? (
              <li>No parts below minimum.</li>
            ) : (
              low.map((part) => (
                <li key={part.id}>
                  {part.partCode} {part.name} — {part.stockQuantity} / min {part.minimumStock}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
