import { PageHeader } from "@/components/page-header";

export default function NewServiceRequestPage() {
  return (
    <div>
      <PageHeader
        title="New service request"
        description="Capture the customer, branch, device, and reported problem. Assignment happens after review."
      />
      <form className="max-w-2xl space-y-4 rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
        <label className="block text-sm">
          Customer
          <input className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2" defaultValue="Maison Aroma" />
        </label>
        <label className="block text-sm">
          Branch
          <input className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2" defaultValue="BCD Flagship" />
        </label>
        <label className="block text-sm">
          Device serial number
          <input className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2" placeholder="Scan or type SN" />
        </label>
        <label className="block text-sm">
          Reported problem
          <textarea className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2" rows={4} />
        </label>
        <label className="block text-sm">
          Priority
          <select className="mt-1 w-full rounded-xl border border-ink-900/15 px-3 py-2">
            <option>normal</option>
            <option>low</option>
            <option>high</option>
            <option>urgent</option>
          </select>
        </label>
        <button type="button" className="rounded-full bg-ink-900 px-5 py-2 text-sm text-white">
          Save request (demo)
        </button>
      </form>
    </div>
  );
}
