"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { demoDevices } from "@/lib/demo-data";

export default function ScanPage() {
  const [query, setQuery] = useState("");
  const match = useMemo(
    () =>
      demoDevices.find(
        (device) =>
          device.serialNumber.toLowerCase() === query.trim().toLowerCase() ||
          device.deviceCode.toLowerCase() === query.trim().toLowerCase() ||
          device.qrCode.toLowerCase() === query.trim().toLowerCase(),
      ),
    [query],
  );

  return (
    <div>
      <PageHeader
        title="Scan device"
        description="Enter or scan a QR code, barcode, device code, or serial number."
      />
      <div className="max-w-xl rounded-2xl border border-ink-900/10 bg-white p-6 shadow-panel">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SN-88421-A"
          className="w-full rounded-xl border border-ink-900/15 px-3 py-3 font-mono"
        />
        <p className="mt-2 text-xs text-ink-700/60">Demo identifiers: ARMS-10041, SN-88421-A, ARMS-22010</p>
        {query && !match ? <p className="mt-4 text-sm text-rose-700">No device found.</p> : null}
        {match ? (
          <div className="mt-6 space-y-2 text-sm">
            <p className="font-medium">{match.deviceCode}</p>
            <p>{match.serialNumber}</p>
            <StatusBadge value={match.status} />
            <p className="text-ink-700/70">
              {match.customerName} · {match.branchName}
            </p>
            <Link href={`/devices/${match.id}`} className="inline-block text-aroma-700 underline">
              Open device record
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
