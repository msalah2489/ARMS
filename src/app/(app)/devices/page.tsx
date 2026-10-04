"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getDevices } from "@/lib/data";
import type { Device } from "@/types/domain";

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getDevices().then((rows) => {
      setDevices(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Devices"
        description="Individually identifiable aroma units. Serial number, QR, and barcode are first-class identifiers."
      />
      {loading ? (
        <p className="text-sm text-ink-700/70">Loading devices…</p>
      ) : (
        <DataTable
          columns={["Device", "Serial", "Model", "Customer / branch", "Status", "Location"]}
          rows={devices.map((device) => [
            <Link key="c" href={`/devices/${device.id}`} className="font-medium text-aroma-700">
              {device.deviceCode}
            </Link>,
            device.serialNumber,
            `${device.brand} ${device.modelName}`,
            `${device.customerName} · ${device.branchName}`,
            <StatusBadge key="s" value={device.status} />,
            device.currentLocation,
          ])}
        />
      )}
    </div>
  );
}
