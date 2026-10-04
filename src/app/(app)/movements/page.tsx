import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

const MOVEMENTS = [
  {
    when: "26 Sep 2026 14:20",
    device: "ARMS-22010",
    type: "Dispatch to service center",
    from: "Cedar Grand",
    to: "Central Service Center",
    receipt: "CR-10025",
    status: "sent_to_service_center",
  },
  {
    when: "26 Sep 2026 09:10",
    device: "ARMS-10041",
    type: "Technician pickup",
    from: "BCD Flagship",
    to: "Technician van — Karim",
    receipt: "CR-10024",
    status: "under_maintenance",
  },
  {
    when: "22 Sep 2026 16:45",
    device: "ARMS-10042",
    type: "Return to branch",
    from: "Technician van — Karim",
    to: "ABC Achrafieh — lobby",
    receipt: "CR-10018",
    status: "returned",
  },
];

export default function MovementsPage() {
  return (
    <div>
      <PageHeader
        title="Device movements"
        description="Dispatch, receive, and return events. A customer receipt number can cover multiple devices."
      />
      <div className="space-y-3">
        {MOVEMENTS.map((item) => (
          <article
            key={`${item.device}-${item.when}`}
            className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.type}</p>
              <StatusBadge value={item.status} />
            </div>
            <p className="mt-2 text-sm text-ink-700/70">
              {item.device} · {item.from} → {item.to}
            </p>
            <p className="mt-1 text-xs text-ink-700/50">
              {item.when} · Receipt {item.receipt}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
